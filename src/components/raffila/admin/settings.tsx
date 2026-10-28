import { useCallback, useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  setDoc,
  updateDoc,
  where,
  serverTimestamp,
} from "firebase/firestore";
import {
  ShieldCheck,
  SlidersHorizontal,
  UserPlus,
  UserMinus,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Mail,
  Crown,
  Search,
  Activity,
  Copy,
  Check,
  Trash2,
  ExternalLink,
} from "lucide-react";

import { AdminShell } from "@/components/raffila/admin/admin-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { db } from "@/lib/firebase";
import { logActivity, sendAdminInvite, cancelAdminInvite } from "@/lib/activity-log";
import { FEATURE_META, DEFAULT_FEATURES, PLATFORM_CONFIG_DOC_ID } from "@/lib/platform-config";
import { getEmailDocKey, normalizeEmail } from "@/lib/user-validation";
import { useAuthSession } from "@/hooks/useAuthSession";
import { cn } from "@/lib/utils";
import {
  assignStaffToUser,
  getStaffList,
  fetchStaffAssignments,
  revokeStaffAccess,
  reactivateStaffAccess,
  StaffMember,
} from "@/lib/crm-service";

interface AdminRow {
  id: string;
  email: string;
  name: string;
  handle: string;
  createdAt: string;
}

function Section({
  icon: Icon,
  tone,
  title,
  description,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  tone: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[24px] bg-white p-6 ring-1 ring-ink/5 sm:p-8">
      <div className="flex items-start gap-4">
        <div className={cn("grid size-12 shrink-0 place-items-center rounded-2xl", tone)}>
          <Icon className="size-5 text-coral" />
        </div>
        <div className="min-w-0 flex-1 pt-0.5">
          <h2 className="font-display text-xl font-extrabold text-ink">{title}</h2>
          <p className="mt-1 text-xs font-bold leading-relaxed text-ink/55">{description}</p>
        </div>
      </div>
      <Separator className="my-5 bg-ink/8" />
      {children}
    </section>
  );
}

export function AdminSettingsPage() {
  const { user } = useAuthSession();
  const selfUid = user?.id?.startsWith("firebase_")
    ? user.id.slice("firebase_".length)
    : (user?.id ?? "");

  // ---- Administrators ----
  const [admins, setAdmins] = useState<AdminRow[]>([]);
  const [adminsLoading, setAdminsLoading] = useState(true);
  const [adminsError, setAdminsError] = useState<string | null>(null);
  const [newEmail, setNewEmail] = useState("");
  const [adding, setAdding] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [confirmRevokeId, setConfirmRevokeId] = useState<string | null>(null);
  const [inviteCandidate, setInviteCandidate] = useState<string | null>(null);
  const [inviting, setInviting] = useState(false);
  const [invites, setInvites] = useState<
    Array<{ email: string; invitedBy: string; createdAt: string }>
  >([]);
  const [cancellingInvite, setCancellingInvite] = useState<string | null>(null);

  // ---- Staff & CRM Keys ----
  const [staffList, setStaffList] = useState<StaffMember[]>(() => getStaffList());
  const [isStaffModalOpen, setIsStaffModalOpen] = useState(false);

  // ---- Assign staff to existing Firestore user ----
  const [staffSearchQuery, setStaffSearchQuery] = useState("");
  const [staffSearchResults, setStaffSearchResults] = useState<Array<{
    id: string;
    email: string;
    name: string;
    role: string;
  }>>([]);
  const [staffSearchLoading, setStaffSearchLoading] = useState(false);
  const [staffSearchSelected, setStaffSearchSelected] = useState<{
    id: string;
    email: string;
    name: string;
    role: string;
  } | null>(null);
  const [staffGeneratingKey, setStaffGeneratingKey] = useState(false);
  const [assignedStaff, setAssignedStaff] = useState<{ name: string; email: string } | null>(null);

  const refreshStaff = useCallback(async () => {
    const rows = await fetchStaffAssignments();
    setStaffList(
      rows.map((r) => ({
        id: r.id,
        key: r.key,
        name: r.name,
        email: r.email,
        role: "Sales Representative",
        status: r.status,
        createdAt: r.createdAt,
        ...(r.lastUsedAt ? { lastLoginAt: r.lastUsedAt } : {}),
      })),
    );
  }, []);

  const handleSearchUsers = async () => {
    const q = staffSearchQuery.trim();
    if (!q) {
      setStaffSearchResults([]);
      return;
    }
    setStaffSearchLoading(true);
    try {
      const snap = await getDocs(query(collection(db, "users"), limit(100)));
      const qLower = q.toLowerCase();
      const results: Array<{ id: string; email: string; name: string; role: string }> = [];
      snap.docs.forEach((d) => {
        const data = d.data() as Record<string, unknown>;
        const email = (data["email"] as string) || "";
        const name =
          (data["displayName"] as string) ||
          [data["firstName"], data["lastName"]].filter(Boolean).join(" ") ||
          (data["handle"] as string) ||
          "";
        const role = (data["role"] as string) || "user";
        if (
          email.toLowerCase().includes(qLower) ||
          name.toLowerCase().includes(qLower)
        ) {
          results.push({ id: d.id, email, name, role });
        }
      });
      // Exclude existing admins and already-staff users from assignment
      setStaffSearchResults(results.filter((r) => r.role !== "admin" && r.role !== "staff"));
    } catch {
      setStaffSearchResults([]);
    } finally {
      setStaffSearchLoading(false);
    }
  };

  const handleAssignStaff = async () => {
    if (!staffSearchSelected) return;
    setStaffGeneratingKey(true);
    try {
      const res = await assignStaffToUser(
        staffSearchSelected.id,
        staffSearchSelected.email,
        staffSearchSelected.name,
      );

      if (res.key) {
        setAssignedStaff({
          name: staffSearchSelected.name,
          email: staffSearchSelected.email,
        });
        setStaffGeneratingKey(false);
        toast.success(`${staffSearchSelected.name} is now a staff member`);
        void logActivity({
          eventType: "USER_UPDATE",
          targetType: "user",
          targetId: staffSearchSelected.id,
          summary: `Assigned CRM staff access to ${staffSearchSelected.email}`,
          details: {
            role: "staff",
            action: "staff_assigned",
          },
        });
        void refreshStaff();
      } else {
        toast.error("Could not assign staff access", {
          description: res.error || "Unknown error",
        });
        setStaffGeneratingKey(false);
      }
    } catch (err: any) {
      toast.error("Could not assign staff access", {
        description: err?.message || "Unknown error",
      });
      setStaffGeneratingKey(false);
    }
  };

  const handleToggleStaffStatus = async (staff: StaffMember) => {
    if (staff.status === "active") {
      const ok = await revokeStaffAccess(staff.key);
      if (!ok) {
        toast.error("Could not revoke access", {
          description: "Firestore rejected the change. Check your connection and try again.",
        });
        return;
      }
      toast.warning(`Revoked CRM access for ${staff.name}`, {
        description: "Their account now returns to the normal customer dashboard.",
      });
      void logActivity({
        eventType: "USER_UPDATE",
        targetType: "user",
        targetId: staff.id,
        summary: `Revoked CRM staff access for ${staff.email}`,
        details: { staffKey: staff.key, action: "staff_revoked" },
      });
    } else {
      const ok = await reactivateStaffAccess(staff.key);
      if (!ok) {
        toast.error("Could not re-activate access");
        return;
      }
      toast.success(`Re-activated CRM access for ${staff.name}`);
      void logActivity({
        eventType: "USER_UPDATE",
        targetType: "user",
        targetId: staff.id,
        summary: `Re-activated CRM staff access for ${staff.email}`,
        details: { staffKey: staff.key, action: "staff_reactivated" },
      });
    }
    void refreshStaff();
  };

  const handleDeleteStaffKey = async (staff: StaffMember) => {
    if (confirm(`Are you sure you want to remove CRM access for ${staff.name}?`)) {
      const ok = await revokeStaffAccess(staff.key);
      if (!ok) {
        toast.error("Could not remove access");
        return;
      }
      toast.success(`Removed ${staff.name} from the sales team`);
      void logActivity({
        eventType: "USER_UPDATE",
        targetType: "user",
        targetId: staff.id,
        summary: `Removed CRM staff access for ${staff.email}`,
        details: { staffKey: staff.key, action: "staff_removed" },
      });
      void refreshStaff();
    }
  };

  const fetchAdmins = useCallback(async () => {
    setAdminsLoading(true);
    setAdminsError(null);
    try {
      const snap = await getDocs(
        query(collection(db, "users"), where("role", "==", "admin"), limit(50)),
      );
      const rows: AdminRow[] = snap.docs.map((d) => {
        const v = d.data() as Record<string, unknown>;
        const first = (v["firstName"] as string) || "";
        const last = (v["lastName"] as string) || "";
        const display = (v["displayName"] as string) || `${first} ${last}`.trim();
        let created = "";
        try {
          const c: any = v["createdAt"];
          created =
            typeof c?.toDate === "function" ? (c.toDate() as Date).toISOString() : String(c ?? "");
        } catch {
          created = "";
        }
        return {
          id: d.id,
          email: (v["email"] as string) || "",
          name: display || (v["handle"] as string) || d.id.slice(0, 8),
          handle: (v["handle"] as string) || "",
          createdAt: created,
        };
      });
      rows.sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
      setAdmins(rows);
    } catch (err: any) {
      const code = err?.code as string | undefined;
      setAdminsError(
        code === "permission-denied"
          ? "Firestore denied access. Publish the latest firestore.rules in Firebase Console (Firestore → Rules), then refresh."
          : err?.message || "Could not load administrators",
      );
      setAdmins([]);
    } finally {
      setAdminsLoading(false);
    }
  }, []);

  const fetchInvites = useCallback(async () => {
    try {
      const snap = await getDocs(query(collection(db, "adminInvites"), limit(50)));
      const rows = snap.docs.map((d) => {
        const v = d.data() as Record<string, unknown>;
        let created = "";
        try {
          const c: any = v["createdAt"];
          created = typeof c?.toDate === "function" ? (c.toDate() as Date).toISOString() : "";
        } catch {
          created = "";
        }
        return {
          email: (v["email"] as string) || d.id,
          invitedBy: (v["invitedBy"] as string) || "",
          createdAt: created,
        };
      });
      setInvites(rows);
    } catch {
      setInvites([]);
    }
  }, []);

  useEffect(() => {
    void fetchAdmins();
    void fetchInvites();
    void refreshStaff();
  }, [fetchAdmins, fetchInvites, refreshStaff]);

  const handleSendInvite = async () => {
    if (!inviteCandidate || inviting) return;
    setInviting(true);
    try {
      const { emailed } = await sendAdminInvite(inviteCandidate, {
        id: selfUid,
        email: user?.email ?? "",
        name: [user?.firstName, user?.lastName].filter(Boolean).join(" "),
      });
      setInviteCandidate(null);
      setNewEmail("");
      await fetchInvites();
      toast.success("Admin invite sent", {
        description: emailed
          ? "Invitation email sent — rights apply on first sign-in."
          : "Invite saved. Add EmailJS keys to .env to email invites out — rights still apply on first sign-in.",
      });
    } catch (err: any) {
      toast.error("Could not send invite", { description: permissionHint(err) });
    } finally {
      setInviting(false);
    }
  };

  const handleCancelInvite = async (email: string) => {
    setCancellingInvite(email);
    try {
      await cancelAdminInvite(email);
      await fetchInvites();
      toast.success("Invite cancelled", { description: email });
    } catch (err: any) {
      toast.error("Could not cancel invite", { description: permissionHint(err) });
    } finally {
      setCancellingInvite(null);
    }
  };

  useEffect(() => {
    if (!confirmRevokeId) return;
    const t = setTimeout(() => setConfirmRevokeId(null), 4000);
    return () => clearTimeout(t);
  }, [confirmRevokeId]);

  /** Find a user doc by email: registry first (case-insensitive), then direct query. */
  async function findUserByEmail(
    email: string,
  ): Promise<{ id: string; data: Record<string, unknown> } | null> {
    const clean = normalizeEmail(email);
    try {
      const regSnap = await getDoc(doc(db, "registeredEmails", getEmailDocKey(clean)));
      if (regSnap.exists()) {
        const uid = (regSnap.data() as Record<string, unknown>)["uid"] as string | undefined;
        if (uid) {
          const userSnap = await getDoc(doc(db, "users", uid));
          if (userSnap.exists()) {
            return { id: userSnap.id, data: userSnap.data() as Record<string, unknown> };
          }
        }
      }
    } catch {
      // fall through to query
    }
    const snap = await getDocs(
      query(collection(db, "users"), where("email", "==", clean), limit(1)),
    );
    if (!snap.empty) {
      const d = snap.docs[0]!;
      return { id: d.id, data: d.data() as Record<string, unknown> };
    }
    // Last resort: exact raw input (catches docs stored before normalization).
    const raw = email.trim();
    if (raw !== clean) {
      const snap2 = await getDocs(
        query(collection(db, "users"), where("email", "==", raw), limit(1)),
      );
      if (!snap2.empty) {
        const d = snap2.docs[0]!;
        return { id: d.id, data: d.data() as Record<string, unknown> };
      }
    }
    return null;
  }

  function permissionHint(err: any): string {
    const code = err?.code as string | undefined;
    const msg = err?.message || String(err);
    if (code === "permission-denied" || /permission|insufficient/i.test(msg)) {
      return "Firestore denied the write. Publish the latest firestore.rules in Firebase Console (Firestore → Rules), then retry.";
    }
    return msg;
  }

  const handleAddAdmin = async () => {
    const email = newEmail.trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error("Invalid email", { description: "Enter a valid email address." });
      return;
    }
    setAdding(true);
    try {
      const target = await findUserByEmail(email);
      if (!target) {
        // No account yet — offer an invite instead of a dead end.
        setInviteCandidate(email);
        toast.info("No account found", {
          description: `${email} has no Raffila account yet — send an invite below.`,
        });
        return;
      }
      setInviteCandidate(null);
      const data = target.data;
      if (data["role"] === "admin") {
        toast.info("Already an administrator", { description: email });
        return;
      }
      await updateDoc(doc(db, "users", target.id), {
        role: "admin",
        isAdmin: true,
        verified: true,
        updatedAt: serverTimestamp(),
      });
      await logActivity({
        eventType: "USER_UPDATE",
        targetType: "user",
        targetId: target.id,
        summary: `Granted admin access to ${email}`,
        oldValue: { role: (data["role"] as string) ?? "user" },
        newValue: { role: "admin" },
      });
      setNewEmail("");
      await fetchAdmins();
      toast.success("Administrator added", { description: `${email} can now sign in to /admin.` });
    } catch (err: any) {
      toast.error("Could not add administrator", { description: permissionHint(err) });
    } finally {
      setAdding(false);
    }
  };

  const handleRevokeAdmin = async (row: AdminRow) => {
    if (confirmRevokeId !== row.id) {
      setConfirmRevokeId(row.id);
      return;
    }
    if (row.id === selfUid) {
      toast.error("Not allowed", { description: "You cannot revoke your own admin access." });
      setConfirmRevokeId(null);
      return;
    }
    if (admins.length <= 1) {
      toast.error("Not allowed", { description: "At least one administrator must remain." });
      setConfirmRevokeId(null);
      return;
    }
    setRevoking(true);
    try {
      const snap = await getDoc(doc(db, "users", row.id));
      const prev = snap.exists()
        ? ((snap.data() as Record<string, unknown>)["role"] ?? "admin")
        : "admin";
      await updateDoc(doc(db, "users", row.id), {
        role: "user",
        isAdmin: false,
        updatedAt: serverTimestamp(),
      });
      await logActivity({
        eventType: "USER_UPDATE",
        targetType: "user",
        targetId: row.id,
        summary: `Revoked admin access from ${row.email || row.name}`,
        oldValue: { role: prev },
        newValue: { role: "user" },
      });
      setConfirmRevokeId(null);
      await fetchAdmins();
      toast.success("Admin access revoked", { description: row.email || row.name });
    } catch (err: any) {
      toast.error("Could not revoke access", { description: permissionHint(err) });
    } finally {
      setRevoking(false);
    }
  };

  // ---- Feature availability ----
  const [features, setFeatures] = useState<Record<string, boolean>>({ ...DEFAULT_FEATURES });
  const [featuresLoading, setFeaturesLoading] = useState(true);
  const [featuresSaving, setFeaturesSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const snap = await getDoc(doc(db, "platformSettings", PLATFORM_CONFIG_DOC_ID));
        if (!cancelled && snap.exists()) {
          const stored =
            ((snap.data() as Record<string, unknown>)["features"] as Record<string, unknown>) ?? {};
          setFeatures((prev) => {
            const next = { ...prev };
            for (const { key } of FEATURE_META) {
              if (typeof stored[key] === "boolean") next[key] = stored[key] as boolean;
            }
            return next;
          });
        }
      } catch (err) {
        console.warn("Could not load feature flags:", err);
      } finally {
        if (!cancelled) setFeaturesLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /** Persist a feature-flag patch. Shared by the toggle handler and the
   *  explicit Save button so both write through the same path. */
  const persistFeatures = async (
    next: Record<string, boolean>,
    opts: { silent?: boolean } = {},
  ) => {
    setFeaturesSaving(true);
    try {
      await setDoc(
        doc(db, "platformSettings", PLATFORM_CONFIG_DOC_ID),
        { features: next, updatedAt: serverTimestamp() },
        { merge: true },
      );
      await logActivity({
        eventType: "CONFIG_CHANGE",
        targetType: "platformSettings",
        targetId: PLATFORM_CONFIG_DOC_ID,
        summary: "Updated feature availability",
        details: { features: next },
      });
      if (!opts.silent) {
        toast.success("Feature availability saved", {
          description: "User dashboard navigation updates immediately.",
        });
      }
      return true;
    } catch (err: any) {
      toast.error("Save failed", { description: err?.message || String(err) });
      // Re-read the truth so the UI can't keep showing an unsaved state.
      try {
        const snap = await getDoc(doc(db, "platformSettings", PLATFORM_CONFIG_DOC_ID));
        const stored =
          ((snap.data() as Record<string, unknown> | undefined)?.["features"] as
            Record<string, unknown> | undefined) ?? {};
        const rolled: Record<string, boolean> = { ...DEFAULT_FEATURES };
        for (const { key } of FEATURE_META) {
          if (typeof stored[key] === "boolean") rolled[key] = stored[key] as boolean;
        }
        setFeatures(rolled);
      } catch {
        /* keep local state if the re-read also fails */
      }
      return false;
    } finally {
      setFeaturesSaving(false);
    }
  };

  const saveFeatures = () => persistFeatures(features);

  /** Toggling a switch persists immediately — the switch must never claim to
   *  be off while Firestore still says on. */
  const toggleFeature = async (key: string, value: boolean) => {
    const next = { ...features, [key]: value };
    setFeatures(next);
    const ok = await persistFeatures(next, { silent: true });
    if (ok) {
      const label = FEATURE_META.find((f) => f.key === key)?.label ?? key;
      toast.success(`${label} ${value ? "enabled" : "disabled"}`, {
        description: value
          ? "Visible on the user dashboard again."
          : "Hidden from the user dashboard immediately.",
      });
    }
  };

  // ---- Payments & API status ----
  interface HealthReport {
    ok: boolean;
    message?: string;
    time?: string;
    paystack?: { secretKeySet?: boolean; mode?: string };
    firebaseAdmin?: {
      credentialsSet?: boolean;
      projectId?: string | null;
      firestore?: string;
    };
    walletFunding?: { ready?: boolean };
  }
  const [apiStatus, setApiStatus] = useState<HealthReport | null>(null);
  const [apiChecking, setApiChecking] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  const checkApiStatus = useCallback(async () => {
    setApiChecking(true);
    setApiError(null);
    try {
      const res = await fetch("/api/health", { cache: "no-store" });
      const data = (await res.json()) as HealthReport;
      setApiStatus(data);
    } catch (err: any) {
      setApiStatus(null);
      setApiError(err?.message || "Could not reach /api/health — is the Node server running?");
    } finally {
      setApiChecking(false);
    }
  }, []);

  useEffect(() => {
    void checkApiStatus();
  }, [checkApiStatus]);

  function StatusRow({ good, label, value }: { good: boolean; label: string; value: string }) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-2xl bg-cream/50 px-4 py-3 ring-1 ring-ink/8">
        <p className="text-sm font-extrabold text-ink">{label}</p>
        <p className="flex shrink-0 items-center gap-1.5 text-xs font-extrabold">
          <span
            className={cn(
              "inline-block size-2.5 rounded-full",
              good ? "bg-emerald-500" : "bg-coral",
            )}
          />
          <span className={good ? "text-emerald-700" : "text-coral"}>{value}</span>
        </p>
      </div>
    );
  }

  return (
    <AdminShell activeNav="settings" title="Settings">
      <div className="space-y-6">
        <header>
          <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-coral">
            Admin · Platform
          </p>
          <h1 className="mt-2 font-display text-4xl font-extrabold tracking-tight text-ink sm:text-5xl">
            Settings
          </h1>
          <p className="mt-2 max-w-2xl text-base font-bold text-ink/60">
            Who can administer Raffila and which platform modules are available — all stored live in
            Firestore, every change written to the audit trail.
          </p>
        </header>

        <Section
          icon={Crown}
          tone="bg-lemon/30"
          title="Administrators"
          description="Grant or revoke admin access by email. The account must already exist — new admins sign in normally and land on this dashboard. Roles live on the user's Firestore document; nothing is hardcoded."
        >
          <div className="flex flex-col gap-2.5 sm:flex-row">
            <div className="relative flex-1">
              <Mail className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-ink/40" />
              <Input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void handleAddAdmin();
                }}
                placeholder="admin@example.com"
                className="h-12 rounded-2xl border-0 bg-white pl-11 pr-4 text-sm font-bold text-ink ring-1 ring-ink/10 placeholder:text-ink/35 focus-visible:ring-coral focus-visible:ring-2"
              />
            </div>
            <Button
              variant="primary"
              onClick={() => void handleAddAdmin()}
              disabled={adding}
              className="h-12 shrink-0 rounded-2xl px-6 font-bold"
            >
              {adding ? (
                <RefreshCw className="mr-1.5 size-4 animate-spin" />
              ) : (
                <UserPlus className="mr-1.5 size-4" />
              )}
              {adding ? "Adding…" : "Add administrator"}
            </Button>
          </div>

          {inviteCandidate && (
            <div className="mt-4 space-y-3 rounded-2xl bg-lemon/20 p-4 ring-1 ring-lemon/50">
              <p className="text-xs font-bold leading-relaxed text-ink/75">
                No Raffila account uses{" "}
                <span className="font-mono font-extrabold text-ink">{inviteCandidate}</span> yet.
                Send an admin invite — they get an email and automatically become administrator when
                they sign in with that address.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="primary"
                  size="sm"
                  disabled={inviting}
                  onClick={() => void handleSendInvite()}
                  className="h-10 rounded-full px-5 text-xs font-bold"
                >
                  {inviting ? (
                    <RefreshCw className="mr-1.5 size-3.5 animate-spin" />
                  ) : (
                    <Mail className="mr-1.5 size-3.5" />
                  )}
                  {inviting ? "Sending…" : "Send admin invite"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setInviteCandidate(null)}
                  className="h-10 rounded-full px-5 text-xs font-bold"
                >
                  Dismiss
                </Button>
              </div>
            </div>
          )}

          <div className="mt-5">
            {adminsLoading ? (
              <div className="flex items-center gap-2 rounded-2xl bg-cream/60 p-4 text-sm font-bold text-ink/55">
                <RefreshCw className="size-4 animate-spin" /> Loading administrators…
              </div>
            ) : adminsError ? (
              <div className="flex items-center gap-2 rounded-2xl bg-coral/10 p-4 text-sm font-bold text-coral">
                <AlertTriangle className="size-4" /> {adminsError}
              </div>
            ) : admins.length === 0 ? (
              <div className="rounded-2xl bg-cream/60 p-4 text-sm font-bold text-ink/55">
                No administrators found.
              </div>
            ) : (
              <ul className="divide-y divide-ink/8 rounded-2xl bg-cream/40 ring-1 ring-ink/8">
                {admins.map((a) => {
                  const isSelf = a.id === selfUid;
                  const arming = confirmRevokeId === a.id;
                  return (
                    <li key={a.id} className="flex flex-wrap items-center gap-3 px-4 py-3.5">
                      <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-coral/15 font-display text-sm font-extrabold text-coral">
                        {(a.name.slice(0, 1) || "A").toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="flex flex-wrap items-center gap-2 text-sm font-extrabold text-ink">
                          <span className="truncate">{a.name}</span>
                          {isSelf && (
                            <Badge className="rounded-full border-0 bg-mint/30 px-2 py-0 text-[10px] font-extrabold uppercase text-ink">
                              You
                            </Badge>
                          )}
                        </p>
                        <p className="truncate font-mono text-[11px] font-bold text-ink/50">
                          {a.email || a.id}
                        </p>
                      </div>
                      <ShieldCheck className="size-4 shrink-0 text-emerald-600" />
                      <Button
                        variant={arming ? "primary" : "outline"}
                        size="sm"
                        disabled={revoking}
                        onClick={() => void handleRevokeAdmin(a)}
                        className={cn(
                          "h-9 rounded-full px-4 text-xs font-bold",
                          arming
                            ? "bg-coral hover:bg-coral/90"
                            : "text-coral ring-coral/30 hover:bg-coral/10",
                        )}
                      >
                        <UserMinus className="mr-1.5 size-3.5" />
                        {arming ? "Click again to confirm" : "Revoke"}
                      </Button>
                    </li>
                  );
                })}
              </ul>
            )}
            <p className="mt-3 text-[11px] font-bold leading-relaxed text-ink/50">
              {admins.length} administrator{admins.length === 1 ? "" : "s"} · revoking yourself or
              the last remaining admin is blocked.
            </p>

            {invites.length > 0 && (
              <div className="mt-4">
                <p className="mb-2 text-[10px] font-extrabold uppercase tracking-[0.14em] text-ink/45">
                  Pending invites · {invites.length}
                </p>
                <ul className="divide-y divide-ink/8 rounded-2xl bg-white ring-1 ring-ink/8">
                  {invites.map((inv) => (
                    <li key={inv.email} className="flex flex-wrap items-center gap-3 px-4 py-3">
                      <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-lemon/40">
                        <Mail className="size-4 text-ink/70" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-mono text-xs font-extrabold text-ink">
                          {inv.email}
                        </p>
                        <p className="text-[11px] font-bold text-ink/50">
                          Invited{inv.invitedBy ? ` by ${inv.invitedBy}` : ""} · applies on first
                          sign-in
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={cancellingInvite === inv.email}
                        onClick={() => void handleCancelInvite(inv.email)}
                        className="h-8 rounded-full px-3 text-[11px] font-bold text-ink/60 hover:text-coral"
                      >
                        {cancellingInvite === inv.email ? "Cancelling…" : "Cancel"}
                      </Button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </Section>

        {/* Staff & CRM Access */}
        <Section
          icon={UserPlus}
          tone="bg-mint/30"
          title="Staff & CRM Access"
          description="Give registered users CRM access. Staff keep their normal Raffila login but are routed to the Sales CRM instead of the customer dashboard."
        >
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-ink/8">
              <div>
                <span className="text-xs font-extrabold text-ink">
                  Active Sales Personnel ({staffList.filter((s) => s.status === "active").length})
                </span>
                <p className="text-[11px] font-bold text-ink/50 mt-0.5">
                  Staff keep their normal Raffila login but land in the CRM, never the admin console.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Link
                  to="/crm"
                  className="inline-flex items-center gap-1.5 h-10 px-4 rounded-full border border-ink/10 bg-cream/50 hover:bg-cream text-xs font-bold text-ink transition-colors"
                >
                  <ExternalLink className="size-3.5 text-coral" />
                  View CRM Portal
                </Link>
                <Button
                  variant="primary"
                  onClick={() => {
                    setStaffSearchQuery("");
                    setStaffSearchResults([]);
                    setStaffSearchSelected(null);
                    setAssignedStaff(null);
                    setIsStaffModalOpen(true);
                  }}
                  className="h-10 rounded-full px-5 text-xs font-bold gap-1.5"
                >
                  <UserPlus className="size-3.5" />
                  Add a Staff
                </Button>
              </div>
            </div>

            {staffList.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-ink/15 p-8 text-center text-xs font-bold text-ink/55 space-y-1">
                <p className="font-extrabold text-ink text-sm">No Staff Assigned Yet</p>
                <p>
                  Click &quot;Add a Staff&quot; above to search for a registered user and give them
                  CRM access.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-2xl ring-1 ring-ink/8 bg-white">
                <table className="w-full text-left text-xs">
                  <thead className="bg-cream/40 text-ink/60 font-extrabold border-b border-ink/8">
                    <tr>
                      <th className="py-3 px-4">Sales Rep</th>
                      <th className="py-3 px-4">Role / Scope</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Last Active</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ink/6">
                    {staffList.map((staff) => (
                      <tr key={staff.id} className="hover:bg-cream/20 transition-colors">
                        <td className="py-3.5 px-4">
                          <div className="font-extrabold text-ink">{staff.name}</div>
                          <div className="text-[11px] font-mono text-ink/50">{staff.email}</div>
                        </td>
                        <td className="py-3.5 px-4 font-bold text-ink/75">{staff.role}</td>
                        <td className="py-3.5 px-4">
                          {staff.status === "active" ? (
                            <Badge className="bg-emerald-500/10 text-emerald-700 border-emerald-500/20 text-[10px] font-extrabold">
                              Active
                            </Badge>
                          ) : (
                            <Badge className="bg-coral/10 text-coral border-coral/20 text-[10px] font-extrabold">
                              Revoked
                            </Badge>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-[11px] font-bold text-ink/50">
                          {staff.lastLoginAt
                            ? new Date(staff.lastLoginAt).toLocaleDateString("en-NG", {
                                month: "short",
                                day: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : "Never"}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs px-2.5 rounded-full"
                              onClick={() => handleToggleStaffStatus(staff)}
                            >
                              {staff.status === "active" ? "Revoke" : "Activate"}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 text-coral hover:bg-coral/10 rounded-full"
                              onClick={() => handleDeleteStaffKey(staff)}
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </Section>

        {/* Modal: Assign Staff */}
        <Dialog open={isStaffModalOpen} onOpenChange={setIsStaffModalOpen}>
          <DialogContent className="sm:max-w-md bg-white">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 font-display text-xl text-ink">
                <UserPlus className="size-5 text-coral" />
                Assign CRM Staff Access
              </DialogTitle>
              <DialogDescription className="text-xs text-ink/60">
                Give a registered user access to the Sales CRM. They sign in with their existing
                Raffila email and password.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
                <div className="space-y-1">
                  <Label className="text-xs font-extrabold text-ink">Search by Name or Email</Label>
                  <Input
                    type="search"
                    value={staffSearchQuery}
                    onChange={(e) => setStaffSearchQuery(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") void handleSearchUsers(); }}
                    placeholder="e.g. john.doe@company.com"
                    className="h-10 rounded-xl border-0 bg-cream/50 pl-10 pr-4 text-sm font-bold text-ink ring-1 ring-ink/10 placeholder:text-ink/35 focus-visible:ring-coral focus-visible:ring-2"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void handleSearchUsers()}
                    disabled={staffSearchLoading}
                    className="mt-2 h-9 px-4 text-xs font-bold w-full"
                  >
                    {staffSearchLoading ? <RefreshCw className="mr-1 size-3 animate-spin" /> : <Search className="mr-1 size-3.5" />}
                    Search Users
                  </Button>
                </div>

                {staffSearchLoading && (
                  <div className="mt-3 flex items-center gap-2 rounded-xl bg-cream/40 p-3 text-xs font-bold text-ink/60">
                    <RefreshCw className="mr-1 size-3 animate-spin" />
                    Searching registered users…
                  </div>
                )}

                {staffSearchSelected && (
                  <div className="mt-4 rounded-2xl border border-ink/8 bg-white p-4">
                    <div className="flex flex-col gap-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs font-extrabold text-ink">Selected User</p>
                          <p className="font-bold text-ink text-sm">{staffSearchSelected.name}</p>
                          <p className="text-[11px] font-mono text-ink/50">{staffSearchSelected.email}</p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setStaffSearchSelected(null)}
                          className="h-8 px-3 text-xs text-coral"
                        >
                          Clear
                        </Button>
                      </div>
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => void handleAssignStaff()}
                        disabled={staffGeneratingKey}
                        className="h-10 w-full text-xs font-bold gap-1.5"
                      >
                        {staffGeneratingKey ? (
                          <RefreshCw className="mr-1 size-3 animate-spin" />
                        ) : (
                          <UserPlus className="mr-1 size-3.5" />
                        )}
                        Assign Staff
                      </Button>
                      <p className="text-[11px] font-bold text-ink/50">
                        This gives them CRM access and sets their role to &quot;staff&quot;. Their
                        normal login will route to the CRM, not the customer dashboard.
                      </p>
                    </div>
                  </div>
                )}

                {assignedStaff && (
                  <div className="mt-4 rounded-2xl border border-ink/8 bg-white p-4">
                    <div className="text-center space-y-4">
                      <div className="p-4 rounded-2xl bg-mint/30 border border-mint/40 text-center space-y-2">
                        <p className="text-xs font-bold text-ink/75">
                          <strong className="text-ink">{assignedStaff.name}</strong> now has CRM
                          staff access
                        </p>
                        <div className="text-sm font-mono font-black tracking-wide text-ink bg-white py-2 px-3 rounded-xl border border-ink/10 inline-block shadow-xs">
                          www.raffila.com/staff
                        </div>
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => {
                            navigator.clipboard.writeText("https://raffila.com/staff");
                            toast.success("CRM link copied to clipboard");
                          }}
                          className="gap-1.5 text-xs font-bold"
                        >
                          <Copy className="size-3.5 text-white" />
                          Copy CRM Link
                        </Button>
                      </div>

                      <div className="text-xs text-ink/70 space-y-1 bg-cream/40 p-3 rounded-xl font-bold">
                        <p className="text-ink font-extrabold">Dispatch Instructions:</p>
                        <p>
                          1. Send them the link:{" "}
                          <code className="font-mono text-coral">www.raffila.com/staff</code>
                        </p>
                        <p>
                          2. They sign in with their existing Raffila email and password for{" "}
                          <span className="font-mono">{assignedStaff.email}</span>.
                        </p>
                        <p>
                          3. They land straight in the Sales CRM — no key required.
                        </p>
                      </div>

                      <DialogFooter>
                        <Button variant="outline" onClick={() => setAssignedStaff(null)}>
                          Done
                        </Button>
                      </DialogFooter>
                    </div>
                  </div>
                )}

                {staffSearchResults.length > 0 && !staffSearchSelected && !assignedStaff && (
                  <div className="mt-4 rounded-2xl border border-ink/8 bg-white">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-cream/40 text-ink/60 font-extrabold border-b border-ink/8">
                        <tr>
                          <th className="py-3 px-4">Name</th>
                          <th className="py-3 px-4">Email</th>
                          <th className="py-3 px-4 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-ink/6">
                        {staffSearchResults.map((u) => (
                          <tr key={u.id} className="hover:bg-cream/20 transition-colors">
                            <td className="py-3.5 px-4 font-extrabold text-ink">{u.name}</td>
                            <td className="py-3.5 px-4 font-mono text-ink/50">{u.email}</td>
                            <td className="py-3.5 px-4 text-right">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setStaffSearchSelected(u)}
                                className="h-8 px-3 text-xs font-bold text-ink hover:bg-ink/5"
                              >
                                Select
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {staffSearchQuery.trim().length > 0 && staffSearchResults.length === 0 && !staffSearchLoading && !staffSearchSelected && (
                  <div className="mt-3 rounded-xl bg-cream/40 p-3 text-center text-xs font-bold text-ink/60">
                    No registered users found matching that search.
                  </div>
                )}
              </div>
          </DialogContent>
        </Dialog>

        <Section
          icon={SlidersHorizontal}
          tone="bg-sky/20"
          title="Feature availability"
          description="Show or hide platform modules on the user dashboard. Changes apply as soon as users navigate."
        >
          {featuresLoading ? (
            <div className="flex items-center gap-2 rounded-2xl bg-cream/60 p-4 text-sm font-bold text-ink/55">
              <RefreshCw className="size-4 animate-spin" /> Loading feature flags…
            </div>
          ) : (
            <div className="space-y-3">
              {FEATURE_META.map((f) => (
                <div
                  key={f.key}
                  className="flex items-center justify-between gap-3 rounded-2xl bg-cream/50 px-4 py-3.5 ring-1 ring-ink/8"
                >
                  <div className="pr-4">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-extrabold text-ink">{f.label}</p>
                      {!features[f.key] && (
                        <Badge className="rounded-full border-0 bg-ink/10 px-2 py-0 text-[10px] font-extrabold uppercase text-ink/60">
                          Hidden
                        </Badge>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs font-bold text-ink/55">{f.description}</p>
                  </div>
                  <Switch
                    checked={features[f.key] !== false}
                    disabled={featuresSaving}
                    onCheckedChange={(v) => void toggleFeature(f.key, !!v)}
                  />
                </div>
              ))}
              <p className="flex items-center gap-2 text-[11px] font-bold text-ink/50">
                {featuresSaving ? (
                  <>
                    <RefreshCw className="size-3.5 animate-spin" /> Saving…
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="size-3.5 text-mint" /> Changes save automatically.
                  </>
                )}
              </p>
            </div>
          )}
        </Section>

        <Section
          icon={Activity}
          tone="bg-coral/15"
          title="Payments & API status"
          description="Live check that the Node server, Paystack key and Firebase Admin credential are working. Same report is available anytime at /api/health."
        >
          <div className="space-y-2.5">
            {apiChecking && !apiStatus && !apiError ? (
              <div className="flex items-center gap-2 rounded-2xl bg-cream/60 p-4 text-sm font-bold text-ink/55">
                <RefreshCw className="size-4 animate-spin" /> Checking server status…
              </div>
            ) : apiError ? (
              <div className="flex items-center gap-2 rounded-2xl bg-coral/10 p-4 text-sm font-bold text-coral">
                <AlertTriangle className="size-4 shrink-0" /> {apiError}
              </div>
            ) : apiStatus ? (
              <>
                <div
                  className={cn(
                    "rounded-2xl p-4 text-sm font-extrabold ring-1",
                    apiStatus.ok
                      ? "bg-mint/25 text-ink ring-mint/40"
                      : "bg-coral/10 text-coral ring-coral/25",
                  )}
                >
                  {apiStatus.message ?? (apiStatus.ok ? "API running successfully" : "API error")}
                </div>
                <StatusRow good={true} label="Node server" value="Running" />
                <StatusRow
                  good={apiStatus.paystack?.secretKeySet === true}
                  label="Paystack secret key"
                  value={
                    apiStatus.paystack?.secretKeySet
                      ? `Set (${apiStatus.paystack.mode === "live" ? "LIVE" : "TEST"})`
                      : "Missing"
                  }
                />
                <StatusRow
                  good={apiStatus.firebaseAdmin?.credentialsSet === true}
                  label="Firebase Admin credential"
                  value={
                    apiStatus.firebaseAdmin?.credentialsSet
                      ? `Set${apiStatus.firebaseAdmin.projectId ? ` · ${apiStatus.firebaseAdmin.projectId}` : ""}`
                      : "Missing"
                  }
                />
                <StatusRow
                  good={apiStatus.firebaseAdmin?.firestore === "reachable"}
                  label="Firestore (admin read)"
                  value={
                    apiStatus.firebaseAdmin?.firestore === "reachable"
                      ? "Reachable"
                      : (apiStatus.firebaseAdmin?.firestore ?? "Unknown")
                  }
                />
                <StatusRow
                  good={apiStatus.walletFunding?.ready === true}
                  label="Wallet funding"
                  value={apiStatus.walletFunding?.ready ? "Ready" : "Not ready"}
                />
              </>
            ) : null}
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              onClick={() => void checkApiStatus()}
              disabled={apiChecking}
              className="h-10 rounded-full px-5 text-xs font-bold"
            >
              {apiChecking ? (
                <RefreshCw className="mr-1.5 size-3.5 animate-spin" />
              ) : (
                <Activity className="mr-1.5 size-3.5" />
              )}
              {apiChecking ? "Checking…" : "Check status"}
            </Button>
            <a
              href="/api/health"
              target="_blank"
              rel="noreferrer"
              className="font-mono text-[11px] font-bold text-coral hover:underline"
            >
              /api/health
            </a>
            {apiStatus?.time && (
              <span className="text-[11px] font-bold text-ink/45">
                · checked {new Date(apiStatus.time).toLocaleString("en-NG")}
              </span>
            )}
          </div>
        </Section>

        <Section
          icon={ShieldCheck}
          tone="bg-mint/25"
          title="How access control works"
          description="Single source of truth, no hardcoded credentials."
        >
          <ul className="space-y-2 text-xs font-bold leading-relaxed text-ink/65">
            <li>
              · Admin access = <code className="font-mono">role: "admin"</code> on the{" "}
              <code className="font-mono">users/{"{uid}"}</code> Firestore document.
            </li>
            <li>· No account yet? Send an invite — rights apply automatically on first sign-in.</li>
            <li>· New registrations always start as regular users.</li>
            <li>
              · Every grant, revoke, invite and settings change is written to the audit trail.
            </li>
            <li>
              · Platform values (rates, thresholds, partners) live under Config; feature visibility
              lives here.
            </li>
          </ul>
        </Section>
      </div>
    </AdminShell>
  );
}
