import { useEffect, useState } from "react";
import {
  Save,
  UsersRound,
  Gift,
  WalletMinimal,
  Sparkles,
  Bell,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  TestTube,
  Wrench,
  ExternalLink,
  KeyRound,
  Handshake,
  Eye,
  EyeOff,
} from "lucide-react";
import { toast } from "sonner";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { changeAccountPassword } from "@/lib/firebase-auth";
import { logActivity } from "@/lib/activity-log";
import { normalizeMilestonePct } from "@/lib/notify";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { AdminShell } from "@/components/raffila/admin/admin-shell";
import { cn, formatNaira } from "@/lib/utils";

interface GroupProps {
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: "coral" | "sky" | "mint" | "lemon" | "lilac" | "ink";
  children: React.ReactNode;
  onSave?: () => void;
  showSave?: boolean;
}

const toneBg: Record<string, string> = {
  coral: "bg-coral/15",
  sky: "bg-sky/20",
  mint: "bg-mint/25",
  lemon: "bg-lemon/30",
  lilac: "bg-lilac/25",
  ink: "bg-ink/8",
};
const toneText: Record<string, string> = {
  coral: "text-coral",
  sky: "text-ink",
  mint: "text-ink",
  lemon: "text-ink",
  lilac: "text-ink",
  ink: "text-ink",
};

function ConfigGroup({
  title,
  description,
  icon: Icon,
  tone,
  children,
  onSave,
  showSave = true,
}: GroupProps) {
  return (
    <Card className="rounded-[24px] border-0 bg-white p-0 ring-1 ring-ink/8 shadow-sm">
      <CardContent className="p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-4 min-w-0 flex-1">
            <div
              className={cn("grid size-12 shrink-0 place-items-center rounded-2xl", toneBg[tone])}
            >
              <Icon className={cn("size-5", toneText[tone])} />
            </div>
            <div className="min-w-0 flex-1 pt-0.5">
              <h3 className="font-display text-lg font-extrabold text-ink">{title}</h3>
              <p className="mt-1 text-xs font-bold text-ink/55 leading-relaxed">{description}</p>
            </div>
          </div>
          {showSave && (
            <Button variant="outline" size="sm" onClick={onSave} className="rounded-full h-10 px-4">
              <Save className="size-3.5 mr-1.5" /> Save changes
            </Button>
          )}
        </div>
        <Separator className="my-5 bg-ink/8" />
        {children}
      </CardContent>
    </Card>
  );
}

export function AdminPlatformConfigPage() {
  const [saving, setSaving] = useState(false);
  const [l1, setL1] = useState("10");
  const [l2, setL2] = useState("5");
  const [l3, setL3] = useState("3");
  const [l4, setL4] = useState("2");
  const [l5, setL5] = useState("1");
  const [poolPct, setPoolPct] = useState("5");
  const [poolRules, setPoolRules] = useState(
    "5% of every ticket value accrues to the platform reward pool, distributed monthly to eligible winners and community rewards on a proportional basis subject to the published reward pool charter.",
  );
  const [minPayout, setMinPayout] = useState("5000");
  const [minTopup, setMinTopup] = useState("1000");
  const [liveDelay, setLiveDelay] = useState("60");
  const [confirmWindow, setConfirmWindow] = useState("48");
  const [emailNotif, setEmailNotif] = useState(true);
  const [smsNotif, setSmsNotif] = useState(false);
  const [inappNotif, setInappNotif] = useState(true);
  const [milestonePct, setMilestonePct] = useState("25, 50, 75, 90");
  const [drawReminderMin, setDrawReminderMin] = useState("60");
  const [maintenance, setMaintenance] = useState(false);
  const [maintenanceMsg, setMaintenanceMsg] = useState(
    "Raffila is performing scheduled maintenance. The platform will be back online shortly.",
  );
  const [testMode, setTestMode] = useState(false);
  const [configLoaded, setConfigLoaded] = useState(false);

  // Partner settings
  const [partnerCommission, setPartnerCommission] = useState("10");
  const [partnerAutoApprove, setPartnerAutoApprove] = useState(false);
  const [partnerPayoutSchedule, setPartnerPayoutSchedule] = useState("weekly");
  const [partnerMinPayout, setPartnerMinPayout] = useState("50000");

  // Administrator security (password change)
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [pwSaving, setPwSaving] = useState(false);

  const CONFIG_DOC = "raffila_config";

  // Load persisted platform settings once.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const snap = await getDoc(doc(db, "platformSettings", CONFIG_DOC));
        if (cancelled || !snap.exists()) return;
        const d = snap.data() as Record<string, any>;
        const rates = d["referralRates"] as Record<string, any> | undefined;
        if (rates) {
          setL1(String(rates["l1"] ?? "10"));
          setL2(String(rates["l2"] ?? "5"));
          setL3(String(rates["l3"] ?? "3"));
          setL4(String(rates["l4"] ?? "2"));
          setL5(String(rates["l5"] ?? "1"));
        }
        const pool = d["rewardPool"] as Record<string, any> | undefined;
        if (pool) {
          setPoolPct(String(pool["contributionPct"] ?? "5"));
          if (typeof pool["rules"] === "string") setPoolRules(pool["rules"]);
        }
        const thresholds = d["thresholds"] as Record<string, any> | undefined;
        if (thresholds) {
          setMinPayout(String(thresholds["minPayout"] ?? "5000"));
          setMinTopup(String(thresholds["minTopup"] ?? "1000"));
        }
        const draws = d["draws"] as Record<string, any> | undefined;
        if (draws) {
          setLiveDelay(String(draws["liveDelaySec"] ?? "60"));
          setConfirmWindow(String(draws["confirmWindowHrs"] ?? "48"));
        }
        const notifs = d["notifications"] as Record<string, any> | undefined;
        if (notifs) {
          setEmailNotif(!!notifs["email"]);
          setSmsNotif(!!notifs["sms"]);
          setInappNotif(notifs["inapp"] !== false);
          if (notifs["milestonePct"] !== undefined) {
            const raw = notifs["milestonePct"];
            const list = Array.isArray(raw) ? raw : String(raw).split(/[,\s]+/);
            setMilestonePct(
              list
                .map((v: unknown) => Number(v))
                .filter((n: number) => Number.isFinite(n))
                .join(", "),
            );
          }
          if (notifs["drawReminderMin"] !== undefined) {
            setDrawReminderMin(String(notifs["drawReminderMin"]));
          }
        }
        const status = d["status"] as Record<string, any> | undefined;
        if (status) {
          setMaintenance(!!status["maintenance"]);
          if (typeof status["maintenanceMsg"] === "string")
            setMaintenanceMsg(status["maintenanceMsg"]);
          setTestMode(!!status["testMode"]);
        }
        const partners = d["partners"] as Record<string, any> | undefined;
        if (partners) {
          setPartnerCommission(String(partners["commissionPct"] ?? "10"));
          setPartnerAutoApprove(!!partners["autoApprove"]);
          if (typeof partners["payoutSchedule"] === "string")
            setPartnerPayoutSchedule(partners["payoutSchedule"]);
          setPartnerMinPayout(String(partners["minPayout"] ?? "50000"));
        }
      } catch (err) {
        console.warn("Could not load platform config:", err);
      } finally {
        if (!cancelled) setConfigLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function persistConfigSlice(slice: Record<string, any>, label: string) {
    await setDoc(
      doc(db, "platformSettings", CONFIG_DOC),
      { ...slice, updatedAt: serverTimestamp() },
      { merge: true },
    );
    await logActivity({
      eventType: "CONFIG_CHANGE",
      targetType: "platformSettings",
      targetId: CONFIG_DOC,
      summary: `Updated ${label}`,
      details: slice,
    });
  }

  function sliceFor(group: string): { label: string; slice: Record<string, any> } {
    switch (group) {
      case "referrals":
        return {
          label: "Referral rates",
          slice: {
            referralRates: {
              l1: Number(l1) || 0,
              l2: Number(l2) || 0,
              l3: Number(l3) || 0,
              l4: Number(l4) || 0,
              l5: Number(l5) || 0,
            },
          },
        };
      case "pool":
        return {
          label: "Reward pool",
          slice: {
            rewardPool: { contributionPct: Number(poolPct) || 0, rules: poolRules },
          },
        };
      case "thresholds":
        return {
          label: "Minimum thresholds",
          slice: {
            thresholds: {
              minPayout: Number(minPayout) || 0,
              minTopup: Number(minTopup) || 0,
            },
          },
        };
      case "draws":
        return {
          label: "Draw settings",
          slice: {
            draws: {
              liveDelaySec: Number(liveDelay) || 0,
              confirmWindowHrs: Number(confirmWindow) || 0,
            },
          },
        };
      case "notifications":
        return {
          label: "Notification defaults",
          slice: {
            notifications: {
              email: emailNotif,
              sms: smsNotif,
              inapp: inappNotif,
              milestonePct: normalizeMilestonePct(milestonePct),
              drawReminderMin: Math.max(0, Number(drawReminderMin) || 0),
            },
          },
        };
      case "status":
        return {
          label: "Platform status",
          slice: {
            status: { maintenance, maintenanceMsg, testMode },
          },
        };
      case "partners":
        return {
          label: "Partner settings",
          slice: {
            partners: {
              commissionPct: Number(partnerCommission) || 0,
              autoApprove: partnerAutoApprove,
              payoutSchedule: partnerPayoutSchedule,
              minPayout: Number(partnerMinPayout) || 0,
            },
          },
        };
      default:
        return { label: group, slice: {} };
    }
  }

  const groupSave = async (group: string) => {
    const { label, slice } = sliceFor(group);
    try {
      await persistConfigSlice(slice, label);
      toast.success(`${label} saved`, {
        description: "Stored in Firestore · logged to audit trail.",
      });
    } catch (err: any) {
      toast.error(`Failed to save ${label}`, { description: err?.message || String(err) });
    }
  };

  const saveAll = async () => {
    setSaving(true);
    try {
      const merged: Record<string, any> = {};
      const labels: string[] = [];
      for (const g of [
        "referrals",
        "pool",
        "thresholds",
        "draws",
        "notifications",
        "status",
        "partners",
      ]) {
        const { label, slice } = sliceFor(g);
        Object.assign(merged, slice);
        labels.push(label);
      }
      await setDoc(doc(db, "platformSettings", CONFIG_DOC), merged, { merge: true });
      await logActivity({
        eventType: "CONFIG_CHANGE",
        targetType: "platformSettings",
        targetId: CONFIG_DOC,
        summary: `Published all platform settings`,
        details: { groups: labels },
      });
      toast.success("Changes published", {
        description: "All platform configuration groups saved to Firestore.",
      });
    } catch (err: any) {
      toast.error("Publish failed", { description: err?.message || String(err) });
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordChange = async () => {
    if (!currentPw || !newPw || !confirmPw) {
      toast.error("Missing fields", { description: "Enter current, new and confirm password." });
      return;
    }
    if (newPw !== confirmPw) {
      toast.error("Mismatch", { description: "New passwords do not match." });
      return;
    }
    if (newPw.length < 6) {
      toast.error("Too short", { description: "New password must be at least 6 characters." });
      return;
    }
    setPwSaving(true);
    try {
      await changeAccountPassword(currentPw, newPw);
      setCurrentPw("");
      setNewPw("");
      setConfirmPw("");
      await logActivity({
        eventType: "AUTH_PASSWORD_CHANGE",
        targetType: "user",
        summary: "Admin changed account password",
      });
      toast.success("Password updated", { description: "Use the new password on next sign-in." });
    } catch (err: any) {
      const code = err?.code as string | undefined;
      const message =
        code === "auth/wrong-password" || code === "auth/invalid-credential"
          ? "Current password is incorrect"
          : code === "auth/requires-recent-login"
            ? "Session expired — sign out and sign in again, then retry"
            : code === "auth/weak-password"
              ? "New password is too weak"
              : err?.message || "Password change failed";
      toast.error("Password change failed", { description: message });
    } finally {
      setPwSaving(false);
    }
  };

  return (
    <AdminShell activeNav="config" title="Config">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-coral">
            Admin · Platform
          </p>
          <h1 className="mt-2 font-display text-4xl font-extrabold tracking-tight text-ink sm:text-5xl">
            Configuration
          </h1>
          <p className="mt-2 max-w-2xl text-base font-bold text-ink/60">
            Global Raffila platform settings — referral rates, reward pool, thresholds, draws,
            notifications, partners, admin security, and operational status.{" "}
            {configLoaded && <span className="text-emerald-700">Synced from Firestore.</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge className="rounded-full bg-cream px-3 py-1 text-[10px] font-extrabold uppercase tracking-wider text-ink/60 ring-1 ring-ink/10">
            <Wrench className="mr-1 size-3" /> Config v247
          </Badge>
          <Button
            variant="primary"
            onClick={saveAll}
            disabled={saving}
            className="rounded-full h-11 px-5"
          >
            {saving ? (
              <RefreshCw className="size-4 animate-spin mr-1.5" />
            ) : (
              <CheckCircle2 className="size-4 mr-1.5" />
            )}
            {saving ? "Publishing…" : "Save all"}
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <ConfigGroup
          title="Referral rates"
          description="5-tier referral commission structure applied per qualified ticket purchase."
          icon={UsersRound}
          tone="lemon"
          onSave={() => groupSave("referrals")}
        >
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
            {[
              { label: "Level 1", val: l1, set: setL1, tint: "bg-coral/15 text-coral" },
              { label: "Level 2", val: l2, set: setL2, tint: "bg-sky/20 text-ink" },
              { label: "Level 3", val: l3, set: setL3, tint: "bg-mint/25 text-ink" },
              { label: "Level 4", val: l4, set: setL4, tint: "bg-lemon/30 text-ink" },
              { label: "Level 5", val: l5, set: setL5, tint: "bg-lilac/25 text-ink" },
            ].map((t) => (
              <div key={t.label} className="space-y-2.5">
                <Label className="text-[10px] font-extrabold uppercase tracking-wider text-ink/45">
                  {t.label}
                </Label>
                <div className="relative">
                  <Input
                    type="number"
                    value={t.val}
                    onChange={(e) => t.set(e.target.value)}
                    className="h-12 rounded-2xl border-0 bg-white ring-1 ring-ink/10 pr-9 pl-4 text-base font-extrabold text-ink focus-visible:ring-coral focus-visible:ring-2 text-right"
                  />
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-sm font-extrabold text-ink/55">
                    %
                  </span>
                </div>
                <div
                  className={cn(
                    "rounded-xl px-2 py-1.5 text-center text-[10px] font-extrabold uppercase tracking-wider",
                    t.tint,
                  )}
                >
                  Referrer share
                </div>
              </div>
            ))}
          </div>
        </ConfigGroup>

        <ConfigGroup
          title="Reward pool"
          description="Ticket contribution rate and distribution rules for the community reward pool."
          icon={Gift}
          tone="coral"
          onSave={() => groupSave("pool")}
        >
          <div className="space-y-5">
            <div className="space-y-2.5">
              <Label className="text-[10px] font-extrabold uppercase tracking-wider text-ink/45">
                Contribution rate · % of ticket value
              </Label>
              <div className="relative">
                <Input
                  type="number"
                  value={poolPct}
                  onChange={(e) => setPoolPct(e.target.value)}
                  className="h-12 rounded-2xl border-0 bg-white ring-1 ring-ink/10 pr-9 pl-4 text-base font-extrabold text-ink focus-visible:ring-coral focus-visible:ring-2"
                />
                <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-sm font-extrabold text-ink/55">
                  %
                </span>
              </div>
            </div>
            <div className="space-y-2.5">
              <Label className="text-[10px] font-extrabold uppercase tracking-wider text-ink/45">
                Distribution rules
              </Label>
              <Textarea
                rows={4}
                value={poolRules}
                onChange={(e) => setPoolRules(e.target.value)}
                className="rounded-2xl border-0 bg-white ring-1 ring-ink/10 p-4 text-sm font-bold text-ink focus-visible:ring-coral focus-visible:ring-2 resize-none"
              />
            </div>
          </div>
        </ConfigGroup>

        <ConfigGroup
          title="Minimum thresholds"
          description="Wallet and payout minimum amounts, all stored as integer kobo."
          icon={WalletMinimal}
          tone="mint"
          onSave={() => groupSave("thresholds")}
        >
          <div className="grid grid-cols-2 gap-5">
            <div className="space-y-2.5">
              <Label className="text-[10px] font-extrabold uppercase tracking-wider text-ink/45">
                Min payout
              </Label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-extrabold text-ink/55">
                  ₦
                </span>
                <Input
                  type="number"
                  value={minPayout}
                  onChange={(e) => setMinPayout(e.target.value)}
                  className="h-12 rounded-2xl border-0 bg-white ring-1 ring-ink/10 pl-9 pr-4 text-base font-extrabold text-ink focus-visible:ring-coral focus-visible:ring-2"
                />
              </div>
              <p className="text-[11px] font-bold text-ink/50 mt-1">
                {formatNaira(parseInt(minPayout || "0", 10) * 100)} floor
              </p>
            </div>
            <div className="space-y-2.5">
              <Label className="text-[10px] font-extrabold uppercase tracking-wider text-ink/45">
                Min wallet top-up
              </Label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-extrabold text-ink/55">
                  ₦
                </span>
                <Input
                  type="number"
                  value={minTopup}
                  onChange={(e) => setMinTopup(e.target.value)}
                  className="h-12 rounded-2xl border-0 bg-white ring-1 ring-ink/10 pl-9 pr-4 text-base font-extrabold text-ink focus-visible:ring-coral focus-visible:ring-2"
                />
              </div>
              <p className="text-[11px] font-bold text-ink/50 mt-1">
                {formatNaira(parseInt(minTopup || "0", 10) * 100)} minimum
              </p>
            </div>
          </div>
        </ConfigGroup>

        <ConfigGroup
          title="Draw settings"
          description="Live draw broadcast delay and winner confirmation windows."
          icon={Sparkles}
          tone="sky"
          onSave={() => groupSave("draws")}
        >
          <div className="grid grid-cols-2 gap-5">
            <div className="space-y-2.5">
              <Label className="text-[10px] font-extrabold uppercase tracking-wider text-ink/45">
                Live delay · seconds
              </Label>
              <div className="relative">
                <Input
                  type="number"
                  value={liveDelay}
                  onChange={(e) => setLiveDelay(e.target.value)}
                  className="h-12 rounded-2xl border-0 bg-white ring-1 ring-ink/10 pr-14 pl-4 text-base font-extrabold text-ink focus-visible:ring-coral focus-visible:ring-2"
                />
                <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-sm font-extrabold text-ink/55">
                  s
                </span>
              </div>
              <p className="text-[11px] font-bold text-ink/50 mt-1">Broadcast buffer</p>
            </div>
            <div className="space-y-2.5">
              <Label className="text-[10px] font-extrabold uppercase tracking-wider text-ink/45">
                Confirmation window · hours
              </Label>
              <div className="relative">
                <Input
                  type="number"
                  value={confirmWindow}
                  onChange={(e) => setConfirmWindow(e.target.value)}
                  className="h-12 rounded-2xl border-0 bg-white ring-1 ring-ink/10 pr-12 pl-4 text-base font-extrabold text-ink focus-visible:ring-coral focus-visible:ring-2"
                />
                <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-sm font-extrabold text-ink/55">
                  hrs
                </span>
              </div>
              <p className="text-[11px] font-bold text-ink/50 mt-1">Claim deadline</p>
            </div>
          </div>
        </ConfigGroup>

        <ConfigGroup
          title="Notification defaults"
          description="Default channels enabled for new user onboarding."
          icon={Bell}
          tone="lilac"
          onSave={() => groupSave("notifications")}
        >
          <div className="space-y-3">
            {[
              {
                label: "Email notifications",
                desc: "Receipts, draws, results, marketing opt-in.",
                val: emailNotif,
                set: setEmailNotif,
              },
              {
                label: "SMS notifications",
                desc: "High-priority OTP, winner, payout alerts only.",
                val: smsNotif,
                set: setSmsNotif,
              },
              {
                label: "In-app notifications",
                desc: "Activity feed, badges, live draw reminders.",
                val: inappNotif,
                set: setInappNotif,
              },
            ].map((n) => (
              <div
                key={n.label}
                className="flex items-center justify-between rounded-2xl bg-white ring-1 ring-ink/10 px-4.5 py-3.5"
              >
                <div className="pr-4">
                  <p className="text-sm font-extrabold text-ink">{n.label}</p>
                  <p className="text-xs font-bold text-ink/55 mt-0.5">{n.desc}</p>
                </div>
                <Switch checked={n.val} onCheckedChange={(v) => n.set(!!v)} />
              </div>
            ))}
            <div className="grid grid-cols-2 gap-5">
              <div className="space-y-2.5">
                <Label className="text-[10px] font-extrabold uppercase tracking-wider text-ink/45">
                  Milestone alerts · %
                </Label>
                <Input
                  value={milestonePct}
                  onChange={(e) => setMilestonePct(e.target.value)}
                  placeholder="25, 50, 75, 90"
                  className="h-12 rounded-2xl border-0 bg-white ring-1 ring-ink/10 px-4 text-base font-extrabold text-ink focus-visible:ring-coral focus-visible:ring-2"
                />
                <p className="text-[11px] font-bold text-ink/50 mt-1">
                  {normalizeMilestonePct(milestonePct).join("% · ")}% sold — broadcast to all users
                </p>
              </div>
              <div className="space-y-2.5">
                <Label className="text-[10px] font-extrabold uppercase tracking-wider text-ink/45">
                  Draw reminder · minutes before
                </Label>
                <div className="relative">
                  <Input
                    type="number"
                    value={drawReminderMin}
                    onChange={(e) => setDrawReminderMin(e.target.value)}
                    className="h-12 rounded-2xl border-0 bg-white ring-1 ring-ink/10 pr-12 pl-4 text-base font-extrabold text-ink focus-visible:ring-coral focus-visible:ring-2"
                  />
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-sm font-extrabold text-ink/55">
                    min
                  </span>
                </div>
                <p className="text-[11px] font-bold text-ink/50 mt-1">
                  Email + in-app + device push when a draw goes live
                </p>
              </div>
            </div>
          </div>
        </ConfigGroup>

        <ConfigGroup
          title="Platform status"
          description="Operational mode toggles, maintenance messaging, and test/sandbox flags."
          icon={AlertTriangle}
          tone="ink"
          onSave={() => groupSave("status")}
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-2xl bg-white ring-1 ring-ink/10 px-4.5 py-3.5">
              <div className="pr-4">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-extrabold text-ink">Maintenance mode</p>
                  {maintenance && (
                    <Badge className="rounded-full bg-coral/15 px-2 py-0 text-[10px] font-extrabold uppercase text-coral ring-0">
                      Active
                    </Badge>
                  )}
                </div>
                <p className="text-xs font-bold text-ink/55 mt-0.5">
                  Public pages show maintenance landing · admin only available.
                </p>
              </div>
              <Switch checked={maintenance} onCheckedChange={(v) => setMaintenance(!!v)} />
            </div>
            <div className="space-y-2.5">
              <Label className="text-[10px] font-extrabold uppercase tracking-wider text-ink/45">
                Maintenance message
              </Label>
              <Textarea
                rows={3}
                value={maintenanceMsg}
                onChange={(e) => setMaintenanceMsg(e.target.value)}
                className="rounded-2xl border-0 bg-white ring-1 ring-ink/10 p-4 text-sm font-bold text-ink focus-visible:ring-coral focus-visible:ring-2 resize-none"
              />
            </div>
            <Separator className="bg-ink/8" />
            <div className="flex items-center justify-between rounded-2xl bg-white ring-1 ring-ink/10 px-4.5 py-3.5">
              <div className="pr-4">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-extrabold text-ink">Test mode</p>
                  {testMode && (
                    <Badge className="rounded-full bg-lemon/30 px-2 py-0 text-[10px] font-extrabold uppercase text-ink ring-0">
                      <TestTube className="mr-1 size-2.5" /> Sandbox
                    </Badge>
                  )}
                </div>
                <p className="text-xs font-bold text-ink/55 mt-0.5">
                  Mocks all banks and payouts · no real money moves.
                </p>
              </div>
              <Switch checked={testMode} onCheckedChange={(v) => setTestMode(!!v)} />
            </div>
          </div>
        </ConfigGroup>

        <ConfigGroup
          title="Administrator security"
          description="Change the signed-in admin account password. Requires the current password."
          icon={KeyRound}
          tone="coral"
          showSave={false}
        >
          <div className="space-y-3">
            {[
              { id: "cur", label: "Current password", val: currentPw, set: setCurrentPw },
              { id: "new", label: "New password", val: newPw, set: setNewPw },
              { id: "cfm", label: "Confirm new password", val: confirmPw, set: setConfirmPw },
            ].map((f) => (
              <div key={f.id} className="space-y-2">
                <Label className="text-[10px] font-extrabold uppercase tracking-wider text-ink/45">
                  {f.label}
                </Label>
                <div className="relative">
                  <Input
                    type={showPw ? "text" : "password"}
                    value={f.val}
                    onChange={(e) => f.set(e.target.value)}
                    autoComplete={f.id === "cur" ? "current-password" : "new-password"}
                    className="h-12 rounded-2xl border-0 bg-white ring-1 ring-ink/10 pl-4 pr-12 text-sm font-bold text-ink focus-visible:ring-coral focus-visible:ring-2"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-ink/40 hover:text-ink"
                    aria-label={showPw ? "Hide passwords" : "Show passwords"}
                  >
                    {showPw ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>
            ))}
            <Button
              variant="primary"
              onClick={handlePasswordChange}
              disabled={pwSaving}
              className="rounded-full h-11 px-6 text-xs font-bold"
            >
              {pwSaving ? (
                <RefreshCw className="size-4 animate-spin mr-1.5" />
              ) : (
                <KeyRound className="size-4 mr-1.5" />
              )}
              {pwSaving ? "Updating…" : "Update password"}
            </Button>
          </div>
        </ConfigGroup>

        <ConfigGroup
          title="Partner settings"
          description="Defaults applied to prize partners — commission split, approvals and payouts."
          icon={Handshake}
          tone="sky"
          onSave={() => groupSave("partners")}
        >
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-5">
              <div className="space-y-2.5">
                <Label className="text-[10px] font-extrabold uppercase tracking-wider text-ink/45">
                  Default commission · %
                </Label>
                <div className="relative">
                  <Input
                    type="number"
                    value={partnerCommission}
                    onChange={(e) => setPartnerCommission(e.target.value)}
                    className="h-12 rounded-2xl border-0 bg-white ring-1 ring-ink/10 pr-9 pl-4 text-base font-extrabold text-ink focus-visible:ring-coral focus-visible:ring-2 text-right"
                  />
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-sm font-extrabold text-ink/55">
                    %
                  </span>
                </div>
              </div>
              <div className="space-y-2.5">
                <Label className="text-[10px] font-extrabold uppercase tracking-wider text-ink/45">
                  Min partner payout · ₦
                </Label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-extrabold text-ink/55">
                    ₦
                  </span>
                  <Input
                    type="number"
                    value={partnerMinPayout}
                    onChange={(e) => setPartnerMinPayout(e.target.value)}
                    className="h-12 rounded-2xl border-0 bg-white ring-1 ring-ink/10 pl-9 pr-4 text-base font-extrabold text-ink focus-visible:ring-coral focus-visible:ring-2"
                  />
                </div>
                <p className="text-[11px] font-bold text-ink/50 mt-1">
                  {formatNaira(parseInt(partnerMinPayout || "0", 10) * 100)} floor
                </p>
              </div>
            </div>
            <div className="space-y-2.5">
              <Label className="text-[10px] font-extrabold uppercase tracking-wider text-ink/45">
                Payout schedule
              </Label>
              <div className="flex flex-wrap gap-2">
                {["weekly", "biweekly", "monthly"].map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setPartnerPayoutSchedule(opt)}
                    className={cn(
                      "rounded-full px-4 py-2 text-xs font-extrabold capitalize ring-1 transition-colors",
                      partnerPayoutSchedule === opt
                        ? "bg-ink text-white ring-ink"
                        : "bg-white text-ink/60 ring-ink/10 hover:ring-ink/25",
                    )}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-between rounded-2xl bg-white ring-1 ring-ink/10 px-4.5 py-3.5">
              <div className="pr-4">
                <p className="text-sm font-extrabold text-ink">Auto-approve partners</p>
                <p className="text-xs font-bold text-ink/55 mt-0.5">
                  New partner applications go live without manual review.
                </p>
              </div>
              <Switch
                checked={partnerAutoApprove}
                onCheckedChange={(v) => setPartnerAutoApprove(!!v)}
              />
            </div>
          </div>
        </ConfigGroup>
      </div>

      <div className="mt-6 flex justify-end">
        <Button
          variant="primary"
          size="lg"
          onClick={saveAll}
          disabled={saving}
          className="rounded-full h-12 px-7"
        >
          {saving ? (
            <RefreshCw className="size-4 animate-spin mr-2" />
          ) : (
            <CheckCircle2 className="size-4.5 mr-2" />
          )}
          {saving ? "Publishing all changes…" : "Publish all changes"}
        </Button>
      </div>
    </AdminShell>
  );
}
