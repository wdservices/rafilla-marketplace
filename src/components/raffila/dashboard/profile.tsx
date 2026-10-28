import { useState, useEffect, useRef } from "react";
import {
  Camera,
  Mail,
  Phone,
  ShieldCheck,
  BadgeCheck,
  Check,
  Lock,
  Ticket,
  Users,
  Trophy,
  Loader2,
  Gift,
  Zap,
  Percent,
  Sparkles,
  Award,
  Crown,
} from "lucide-react";
import { toast } from "sonner";

import { DashboardAppShell } from "@/components/raffila/dashboard/app-shell";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuthSession } from "@/hooks/useAuthSession";

export type Badge = {
  id: string;
  name: string;
  icon: React.ReactNode;
  desc: string;
  earned: boolean;
  tone: string;
  perk: string;
  perkTag: string;
  progress?: { current: number; target: number; unit: string };
};

const badges: Badge[] = [
  {
    id: "verified",
    name: "Verified Account",
    icon: <ShieldCheck className="size-4.5" />,
    desc: "Account created and profile confirmed",
    earned: true,
    tone: "bg-mint/30 text-ink ring-mint/40",
    perk: "Verified participant badge on public draw sheets",
    perkTag: "Verified Entrant",
  },
  {
    id: "phone",
    name: "Phone Verified",
    icon: <Phone className="size-4.5" />,
    desc: "Mobile number confirmed via secure OTP",
    earned: true,
    tone: "bg-mint/30 text-ink ring-mint/40",
    perk: "Instant SMS & WhatsApp draw notifications directly to your phone",
    perkTag: "Direct Alerts",
  },
  {
    id: "email",
    name: "Email Verified",
    icon: <Mail className="size-4.5" />,
    desc: "Primary email address confirmed at signup",
    earned: true,
    tone: "bg-mint/30 text-ink ring-mint/40",
    perk: "Official digital draw certificate & ticket proof sent to your email",
    perkTag: "Email Receipts",
  },
  {
    id: "first_entry",
    name: "First Entry",
    icon: <Ticket className="size-4.5" />,
    desc: "Entered your very first prize competition",
    earned: true,
    tone: "bg-mint/30 text-ink ring-mint/40",
    perk: "Active entrant badge displayed on your member profile",
    perkTag: "Active Entrant",
  },
  {
    id: "active_contender",
    name: "Active Contender (10+ Entries)",
    icon: <Sparkles className="size-4.5" />,
    desc: "Reach 10 entries across all competitions",
    earned: false,
    tone: "bg-paper text-ink ring-ink/10",
    perk: "Early email alert when new prize draws and campaigns launch",
    perkTag: "Launch Alerts",
    progress: { current: 3, target: 10, unit: "entries" },
  },
  {
    id: "dedicated_player",
    name: "Dedicated Player (50+ Entries)",
    icon: <Award className="size-4.5" />,
    desc: "Reach 50 entries across competitions",
    earned: false,
    tone: "bg-paper text-ink ring-ink/10",
    perk: "Featured milestone badge displayed in the community circle",
    perkTag: "Community Badge",
    progress: { current: 3, target: 50, unit: "entries" },
  },
  {
    id: "social_ambassador",
    name: "Community Advocate (10+ Referrals)",
    icon: <Users className="size-4.5" />,
    desc: "Invite 10 friends who join and play",
    earned: false,
    tone: "bg-paper text-ink ring-ink/10",
    perk: "Custom referral link handle & personal invitation badge",
    perkTag: "Custom Link",
    progress: { current: 0, target: 10, unit: "referrals" },
  },
  {
    id: "grand_winner",
    name: "Winner's Circle",
    icon: <Trophy className="size-4.5" />,
    desc: "Win at least one Raffila competition prize",
    earned: false,
    tone: "bg-paper text-ink ring-ink/10",
    perk: "Permanent feature in the verified Winners Showcase gallery",
    perkTag: "Winners Showcase",
    progress: { current: 0, target: 1, unit: "win" },
  },
];

export function DashboardProfilePage() {
  const { user } = useAuthSession();
  const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(" ") || "User";
  const [form, setForm] = useState({
    displayName: fullName,
    username: user?.handle || "",
    email: user?.email || "",
    phone: user?.phone || "",
    address: "",
    dob: "",
  });
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [phoneModal, setPhoneModal] = useState(false);
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);

  // Avatar Upload State & Ref
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl || "");

  useEffect(() => {
    if (user?.avatarUrl) setAvatarUrl(user.avatarUrl);
  }, [user?.avatarUrl]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please select a valid image file (PNG, JPG, WEBP).");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      toast.error("Image file must be under 8MB.");
      return;
    }

    setUploadingImage(true);
    try {
      const { uploadToCloudinary } = await import("@/lib/cloudinary-upload");
      const result = await uploadToCloudinary(file);
      const newUrl = result.secure_url;
      setAvatarUrl(newUrl);

      const uid = user?.id?.replace("firebase_", "");
      if (uid) {
        const { createUserProfile } = await import("@/lib/firebase-auth");
        await createUserProfile(uid, { avatarUrl: newUrl });
      }

      const { setFirebaseSession } = await import("@/lib/auth-store");
      if (user) {
        setFirebaseSession({
          ...user,
          avatarUrl: newUrl,
        });
      }
      toast.success("Profile picture updated successfully!");
    } catch (err: any) {
      toast.error(err?.message || "Failed to upload image. Please try again.");
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  useEffect(() => {
    const uid = user?.id?.replace("firebase_", "");
    if (!uid) return;
    import("@/lib/firebase-auth").then(({ getUserProfile }) =>
      getUserProfile(uid).then((profile) => {
        if (!profile) return;
        setForm((f) => ({
          ...f,
          phone: (profile["phone"] as string) || f.phone,
          address: (profile["address"] as string) || f.address,
          dob: (profile["dob"] as string) || f.dob,
          username: (profile["handle"] as string) || f.username,
        }));
        if (profile["avatarUrl"] && typeof profile["avatarUrl"] === "string") {
          setAvatarUrl(profile["avatarUrl"]);
        }
      }),
    );
  }, [user?.id]);

  const update = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    try {
      setSaveError("");
      const { createUserProfile } = await import("@/lib/firebase-auth");
      const uid = user?.id?.replace("firebase_", "");
      if (uid) {
        await createUserProfile(uid, {
          phone: form.phone,
          address: form.address,
          dob: form.dob,
          handle: form.username,
        });

        const [{ setFirebaseSession }, { logActivity }] = await Promise.all([
          import("@/lib/auth-store"),
          import("@/lib/activity-log"),
        ]);
        setFirebaseSession({
          ...user!,
          handle: form.username,
          phone: form.phone,
        });
        void logActivity({
          eventType: "USER_UPDATE",
          targetType: "user",
          targetId: uid,
          summary: "Updated profile details",
        });
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2200);
    } catch (err: any) {
      setSaveError(err?.message || "Failed to save changes");
    }
  };

  const sendOtp = () => {
    setOtpSent(true);
  };

  const verifyOtp = () => {
    if (otp.length >= 4) {
      setOtpVerified(true);
      setTimeout(() => {
        setPhoneModal(false);
        setOtpSent(false);
        setOtpVerified(false);
        setOtp("");
      }, 1200);
    }
  };

  return (
    <DashboardAppShell
      title="Profile"
      breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Profile" }]}
    >
      <div className="space-y-6">
        <p className="max-w-2xl text-sm leading-relaxed text-ink/60 -mt-3">
          Keep your identity fresh so prize claims and support are fast and smooth.
        </p>

        <div className="overflow-hidden rounded-[24px] bg-white ring-1 ring-ink/5">
          <div className="relative h-28 bg-gradient-to-r from-coral/25 via-lemon/25 to-mint/25 sm:h-36">
            <div className="absolute -top-16 -right-10 size-52 rounded-full bg-coral/20 blur-3xl" />
            <div className="absolute -bottom-20 -left-10 size-60 rounded-full bg-lemon/20 blur-3xl" />
          </div>

          <div className="px-6 pb-6 sm:px-8 sm:pb-8">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
              <div className="flex flex-col gap-4 sm:-mt-12 sm:flex-row sm:items-end sm:gap-5">
                <div
                  onClick={() => !uploadingImage && fileInputRef.current?.click()}
                  className="relative mx-auto block size-[108px] shrink-0 cursor-pointer group sm:mx-0 sm:size-28"
                  title="Click to upload profile picture"
                >
                  <div className="absolute inset-0 overflow-hidden rounded-3xl bg-lilac/30 ring-4 ring-white shadow-[0_12px_30px_-14px_rgba(0,0,0,0.35)]">
                    {avatarUrl ? (
                      <img src={avatarUrl} alt="" className="size-full object-cover" />
                    ) : (
                      <div className="grid h-full w-full place-items-center font-display text-5xl font-extrabold text-ink sm:text-4xl">
                        {user?.avatarMonogram || "U"}
                      </div>
                    )}
                    {uploadingImage && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 backdrop-blur-xs text-white">
                        <Loader2 className="size-6 animate-spin text-white" />
                        <span className="mt-1 text-[9px] font-extrabold uppercase">Uploading</span>
                      </div>
                    )}
                  </div>
                  <span className="absolute bottom-1 right-1 grid size-8 place-items-center rounded-2xl bg-coral text-paper shadow-[0_6px_14px_-6px_var(--coral)] ring-2 ring-white group-hover:scale-105 transition-transform">
                    {uploadingImage ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Camera className="size-3.5" />
                    )}
                  </span>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleImageUpload}
                    disabled={uploadingImage}
                  />
                </div>

                <div className="text-center sm:text-left sm:pb-2">
                  <h2 className="font-display text-2xl font-extrabold text-ink sm:text-[1.7rem]">
                    {fullName}
                  </h2>
                  <p className="mt-0.5 text-sm font-bold text-ink/45">@{form.username}</p>

                  <div className="mt-3 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-mint/30 px-3 py-1 text-[11px] font-extrabold text-ink ring-1 ring-mint/20">
                      <BadgeCheck className="size-3.5" /> Email verified
                    </span>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-mint/30 px-3 py-1 text-[11px] font-extrabold text-ink ring-1 ring-mint/20">
                      <BadgeCheck className="size-3.5" /> Phone verified
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex flex-col items-center gap-2 sm:items-end sm:pb-2">
                <p className="text-xs font-bold text-ink/45">Member since · 14 Jan 2026</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingImage}
                  className="cursor-pointer"
                >
                  {uploadingImage ? (
                    <>
                      <Loader2 className="size-3.5 animate-spin" /> Uploading…
                    </>
                  ) : (
                    <>
                      <Camera className="size-3.5" /> Edit profile picture
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-[24px] bg-white p-6 ring-1 ring-ink/5 sm:p-8">
          <div className="flex items-end justify-between gap-4 flex-wrap">
            <div>
              <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-ink/45">
                Personal information
              </p>
              <h2 className="mt-1.5 font-display text-xl font-extrabold text-ink">
                Account details
              </h2>
            </div>
            <p className="text-xs font-bold text-ink/45">Last updated · 3 days ago</p>
          </div>

          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            <Field
              label="Display name"
              value={form.displayName}
              onChange={(v) => update("displayName", v)}
            />
            <Field
              label="Username"
              value={form.username}
              onChange={(v) => update("username", v)}
              leading="@"
            />
            <Field
              label="Email address"
              value={form.email}
              readOnly
              trailing={
                <button className="inline-flex items-center gap-1 rounded-full bg-lilac/25 px-3 py-1 text-[11px] font-extrabold text-ink ring-1 ring-lilac/20 hover:bg-lilac/40">
                  Change
                </button>
              }
            />
            <Field
              label="Phone number"
              value={form.phone}
              readOnly
              trailing={
                <button
                  onClick={() => setPhoneModal(true)}
                  className="inline-flex items-center gap-1 rounded-full bg-lemon/30 px-3 py-1 text-[11px] font-extrabold text-ink ring-1 ring-lemon/25 hover:bg-lemon/45"
                >
                  Verify
                </button>
              }
            />
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-xs font-extrabold uppercase tracking-[0.12em] text-ink/45">
                Residential address
              </label>
              <textarea
                value={form.address}
                onChange={(e) => update("address", e.target.value)}
                rows={3}
                className="w-full resize-none rounded-2xl bg-cream px-4 py-3 text-sm font-bold text-ink ring-1 ring-ink/5 outline-none placeholder:text-ink/35 focus:ring-2 focus:ring-coral"
              />
            </div>
            <Field
              label="Date of birth"
              type="date"
              value={form.dob}
              onChange={(v) => update("dob", v)}
            />
            <div className="hidden sm:block" />
          </div>

          <div className="mt-8 flex items-center justify-end gap-3 border-t border-ink/10 pt-6">
            {saveError && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-coral/10 px-3 py-1.5 text-xs font-extrabold text-coral ring-1 ring-coral/20">
                {saveError}
              </span>
            )}
            {saved && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-mint/30 px-3 py-1.5 text-xs font-extrabold text-ink ring-1 ring-mint/20">
                <Check className="size-3.5" /> Changes saved
              </span>
            )}
            <Button variant="primary" size="lg" onClick={save}>
              Save changes
            </Button>
          </div>
        </div>

        <div className="rounded-[24px] bg-white p-6 ring-1 ring-ink/5 sm:p-8">
          <div className="flex items-end justify-between gap-4 flex-wrap">
            <div>
              <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-coral">
                Client Loyalty & Achievements
              </p>
              <h2 className="mt-1.5 font-display text-2xl font-extrabold text-ink">
                Raffila Badges & Milestones
              </h2>
            </div>
            <p className="max-w-md text-xs font-bold leading-relaxed text-ink/55">
              Badges celebrate your activity on Raffila, providing verified draw credentials,
              priority alerts, and community recognition.
            </p>
          </div>

          {/* Active Status Summary Banner */}
          <div className="mt-5 rounded-2xl bg-gradient-to-r from-mint/25 via-lemon/20 to-mint/25 p-4 ring-1 ring-mint/25 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="grid size-9 place-items-center rounded-xl bg-forest text-white shadow-xs">
                <ShieldCheck className="size-4.5 text-cream" />
              </span>
              <div>
                <p className="text-xs font-extrabold text-ink">
                  4 Active Badges Unlocked on Your Account
                </p>
                <p className="text-[11px] font-bold text-ink/55">
                  Verified Entrant • Direct SMS Alerts • Digital Draw Certificates • Active Player
                  Badge
                </p>
              </div>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-[11px] font-extrabold text-ink ring-1 ring-ink/10 shadow-xs">
              <Sparkles className="size-3.5 text-forest" /> Badges Active
            </span>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {badges.map((b) => (
              <div
                key={b.id}
                className={cn(
                  "relative flex flex-col justify-between rounded-[24px] p-5 ring-1 transition-all duration-200 hover:shadow-md",
                  b.earned ? "bg-mint/20 ring-mint/30" : "bg-paper/70 ring-ink/5",
                )}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <div
                      className={cn(
                        "relative grid size-11 place-items-center rounded-2xl ring-1",
                        b.earned
                          ? "bg-white text-forest ring-mint/30 shadow-xs"
                          : "bg-white/80 text-ink/40 ring-ink/10",
                      )}
                    >
                      {b.icon}
                      {!b.earned && (
                        <div className="absolute -bottom-1 -right-1 grid size-4 place-items-center rounded-full bg-white ring-1 ring-ink/10">
                          <Lock className="size-2.5 text-ink/50" />
                        </div>
                      )}
                    </div>
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-extrabold ring-1",
                        b.earned
                          ? "bg-mint/40 text-ink ring-mint/30"
                          : "bg-white text-ink/60 ring-ink/10",
                      )}
                    >
                      {b.earned ? (
                        <>
                          <Check className="size-3 text-forest" /> EARNED
                        </>
                      ) : (
                        "LOCKED"
                      )}
                    </span>
                  </div>

                  <h3 className="mt-4 font-display text-[15px] font-extrabold text-ink leading-tight">
                    {b.name}
                  </h3>
                  <p className="mt-1 text-xs font-medium leading-relaxed text-ink/60">{b.desc}</p>
                </div>

                {/* Real Perk Box */}
                <div className="mt-4 pt-3 border-t border-ink/5">
                  <div
                    className={cn(
                      "rounded-xl p-2.5 ring-1",
                      b.earned
                        ? "bg-white/90 ring-mint/25 text-ink"
                        : "bg-cream/50 ring-ink/5 text-ink/70",
                    )}
                  >
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-coral flex items-center gap-1">
                        <Gift className="size-3 text-coral" /> Real Perk
                      </span>
                      <span
                        className={cn(
                          "rounded-full px-1.5 py-0.2 text-[9px] font-extrabold uppercase",
                          b.earned ? "bg-mint/40 text-forest" : "bg-ink/10 text-ink/50",
                        )}
                      >
                        {b.perkTag}
                      </span>
                    </div>
                    <p className="text-xs font-bold leading-snug">{b.perk}</p>
                  </div>

                  {b.progress && !b.earned && (
                    <div className="mt-3">
                      <div className="flex items-center justify-between text-[10px] font-bold text-ink/50 mb-1">
                        <span>Progress</span>
                        <span>
                          {b.progress.current} / {b.progress.target} {b.progress.unit}
                        </span>
                      </div>
                      <div className="h-1.5 w-full bg-ink/10 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-coral rounded-full"
                          style={{
                            width: `${Math.min(100, (b.progress.current / b.progress.target) * 100)}%`,
                          }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {phoneModal && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-4 sm:items-center"
          onClick={() => setPhoneModal(false)}
        >
          <div
            className="w-full max-w-md rounded-[24px] bg-white p-6 ring-1 ring-ink/5 sm:p-8"
            onClick={(e) => e.stopPropagation()}
          >
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-ink/45">
                Verify phone
              </p>
              <h2 className="mt-1 font-display text-2xl font-extrabold text-ink">
                Confirm your number
              </h2>
              <p className="mt-2 text-xs font-bold leading-relaxed text-ink/55">
                We'll send a 6-digit OTP to {form.phone}.
              </p>
            </div>

            {!otpSent ? (
              <Button variant="primary" size="lg" className="mt-6 w-full" onClick={sendOtp}>
                Send verification code
              </Button>
            ) : otpVerified ? (
              <div className="mt-6 flex items-center gap-3 rounded-2xl bg-mint/30 p-4 ring-1 ring-mint/20">
                <div className="grid size-10 place-items-center rounded-full bg-white ring-1 ring-ink/10">
                  <Check className="size-5 text-coral" />
                </div>
                <p className="font-display font-extrabold text-ink">Phone verified!</p>
              </div>
            ) : (
              <div className="mt-6">
                <label className="mb-1.5 block text-xs font-extrabold uppercase tracking-[0.12em] text-ink/45">
                  Enter OTP
                </label>
                <input
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.slice(0, 6))}
                  placeholder="123456"
                  maxLength={6}
                  className="min-h-12 w-full rounded-2xl bg-cream px-4 text-center font-display text-2xl font-extrabold tracking-[0.2em] text-ink ring-1 ring-ink/5 outline-none focus:ring-2 focus:ring-coral"
                />
                <Button
                  variant="primary"
                  size="lg"
                  className="mt-5 w-full"
                  onClick={verifyOtp}
                  disabled={otp.length < 4}
                >
                  Verify number
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </DashboardAppShell>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  readOnly = false,
  trailing,
  leading,
}: {
  label: string;
  value: string;
  onChange?: (v: string) => void;
  placeholder?: string;
  type?: string;
  readOnly?: boolean;
  trailing?: React.ReactNode;
  leading?: string;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <label className="text-xs font-extrabold uppercase tracking-[0.12em] text-ink/45">
          {label}
        </label>
        {trailing}
      </div>
      <div className="flex min-h-11 items-center gap-2 rounded-2xl bg-cream px-4 ring-1 ring-ink/5 focus-within:ring-2 focus-within:ring-coral/20 transition-all">
        {leading && <span className="font-extrabold text-ink/45">{leading}</span>}
        <input
          type={type}
          value={value}
          placeholder={placeholder}
          readOnly={readOnly}
          onChange={onChange ? (e) => onChange(e.target.value) : undefined}
          className={cn(
            "w-full bg-transparent text-sm font-bold text-ink outline-none placeholder:text-ink/35",
            readOnly && "opacity-80",
          )}
        />
      </div>
    </div>
  );
}
