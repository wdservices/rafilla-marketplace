import { useState, useEffect } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  ShieldCheck,
  PhoneCall,
  KeyRound,
  Lock,
  Mail,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  Building2,
  Sparkles,
  LogOut,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuthActions, useAuthSession } from "@/hooks/useAuthSession";
import {
  getCurrentStaffSession,
  validateStaffLogin,
  clearStaffSession,
  StaffMember,
} from "@/lib/crm-service";

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path
        fill="#EA4335"
        d="M5.266 9.765A7.077 7.077 0 0 1 12 4.909c1.69 0 3.218.6 4.418 1.582L19.91 3C17.782 1.145 15.055 0 12 0 7.27 0 3.198 2.698 1.24 6.65l4.026 3.115Z"
      />
      <path
        fill="#34A853"
        d="M16.04 18.013c-1.09.703-2.474 1.078-4.04 1.078a7.077 7.077 0 0 1-6.723-4.823l-4.04 3.067A11.965 11.965 0 0 0 12 24c2.933 0 5.735-1.043 7.834-3l-3.793-2.987Z"
      />
      <path
        fill="#4A90E2"
        d="M19.834 21c2.195-2.048 3.62-5.096 3.62-9 0-.71-.109-1.473-.272-2.182H12v4.637h6.436c-.317 1.559-1.17 2.766-2.395 3.558L19.834 21Z"
      />
      <path
        fill="#FBBC05"
        d="M5.277 14.268A7.12 7.12 0 0 1 4.909 12c0-.782.125-1.533.357-2.235L1.24 6.65A11.934 11.934 0 0 0 0 12c0 1.92.445 3.73 1.237 5.335l4.04-3.067Z"
      />
    </svg>
  );
}

export function StaffPortal() {
  const navigate = useNavigate();
  const { user, isAdmin } = useAuthSession();
  const { signIn, signInWithGoogle } = useAuthActions();

  const [activeRole, setActiveRole] = useState<"sales" | "admin">("sales");
  const [salesKey, setSalesKey] = useState("");
  const [salesError, setSalesError] = useState("");
  const [salesLoading, setSalesLoading] = useState(false);

  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [adminError, setAdminError] = useState("");
  const [adminLoading, setAdminLoading] = useState(false);

  const [currentStaff, setCurrentStaff] = useState<StaffMember | null>(() =>
    getCurrentStaffSession(),
  );

  useEffect(() => {
    // Check URL parameters for role hint
    try {
      const url = new URL(window.location.href);
      const roleParam = url.searchParams.get("role");
      if (roleParam === "admin") {
        setActiveRole("admin");
      } else if (roleParam === "sales") {
        setActiveRole("sales");
      }
    } catch {
      // ignore
    }
  }, []);

  const handleSalesSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSalesError("");
    setSalesLoading(true);

    const trimmed = salesKey.trim().toUpperCase();
    if (!trimmed) {
      setSalesError("Please enter your assigned Staff Access Key");
      setSalesLoading(false);
      return;
    }

    const res = validateStaffLogin(trimmed);
    setSalesLoading(false);

    if (!res.success || !res.staff) {
      setSalesError(
        res.error || "Invalid or inactive access key. Please check with your Operations Admin.",
      );
      toast.error("Access Key Error", { description: res.error });
      return;
    }

    toast.success(`Welcome back, ${res.staff.name}!`, {
      description: "Routing to your Sales & Outreach CRM…",
    });
    setCurrentStaff(res.staff);
    void navigate({ to: "/crm" });
  };

  const handleAdminSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminError("");
    setAdminLoading(true);

    if (!adminEmail.trim() || !adminPassword) {
      setAdminError("Please enter both administrator email and password");
      setAdminLoading(false);
      return;
    }

    const res = await signIn({
      email: adminEmail.trim(),
      password: adminPassword,
      remember: true,
      redirectTo: false,
    });

    setAdminLoading(false);

    if (!res.ok) {
      setAdminError(res.message || "Failed to sign in as Administrator.");
      toast.error("Admin Sign In Failed", { description: res.message });
      return;
    }

    if (res.user.role !== "admin") {
      setAdminError("Access denied. This account does not have Platform Administrator privileges.");
      toast.error("Unauthorized Role", {
        description: "The specified account is not an Administrator.",
      });
      return;
    }

    toast.success("Administrator Authenticated", {
      description: "Entering Platform Operations Console…",
    });
    void navigate({ to: "/admin" });
  };

  const handleAdminGoogleSignIn = async () => {
    setAdminLoading(true);
    setAdminError("");
    const res = await signInWithGoogle({ redirectTo: false });
    setAdminLoading(false);

    if (!res.ok) {
      setAdminError(res.message || "Google sign in failed.");
      toast.error("Google Sign In Failed", { description: res.message });
      return;
    }

    if (res.user.role !== "admin") {
      setAdminError(
        "Access denied. Your Google account does not have Platform Administrator privileges.",
      );
      toast.error("Unauthorized Role", {
        description: "Please sign in with an authorized admin account.",
      });
      return;
    }

    toast.success("Administrator Authenticated", {
      description: "Entering Platform Operations Console…",
    });
    void navigate({ to: "/admin" });
  };

  const handleStaffLogout = () => {
    clearStaffSession();
    setCurrentStaff(null);
    setSalesKey("");
    toast.info("Logged out from Sales CRM session");
  };

  return (
    <div className="min-h-screen bg-[#111915] text-stone-100 flex flex-col justify-between selection:bg-emerald-500/30">
      {/* Top Header */}
      <header className="border-b border-stone-800/80 bg-stone-950/40 backdrop-blur-md px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3 group">
            <span className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 font-black text-xl group-hover:scale-105 transition-transform">
              R
            </span>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-xl tracking-tight text-white">Raffila</span>
                <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Internal Portal
                </span>
              </div>
              <p className="text-[11px] text-stone-400">Staff & Operations Gateway</p>
            </div>
          </Link>

          <Link
            to="/"
            className="text-xs text-stone-400 hover:text-stone-200 transition-colors flex items-center gap-1.5"
          >
            ← Return to public website
          </Link>
        </div>
      </header>

      {/* Main Content Card */}
      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-lg space-y-6">
          <div className="text-center space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-stone-800/80 border border-stone-700/80 text-xs text-stone-300">
              <Building2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>Unified Management & Outreach Portal</span>
            </div>
            <h1 className="text-3xl font-display font-extrabold text-white tracking-tight">
              Select Your Role
            </h1>
            <p className="text-xs text-stone-400 max-w-md mx-auto leading-relaxed">
              Sales representatives access the standalone outreach CRM with an assigned key.
              Platform admins sign in to the full operations console.
            </p>
          </div>

          {/* Role Selector Tabs */}
          <div className="grid grid-cols-2 gap-2 p-1.5 rounded-2xl bg-stone-900/90 border border-stone-800">
            <button
              type="button"
              onClick={() => setActiveRole("sales")}
              className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs font-bold transition-all ${
                activeRole === "sales"
                  ? "bg-emerald-600 text-white shadow-lg shadow-emerald-950/50"
                  : "text-stone-400 hover:text-white hover:bg-stone-800/60"
              }`}
            >
              <PhoneCall className="w-4 h-4" />
              <span>Sales Staff (CRM)</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveRole("admin")}
              className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs font-bold transition-all ${
                activeRole === "admin"
                  ? "bg-stone-100 text-stone-950 shadow-lg"
                  : "text-stone-400 hover:text-white hover:bg-stone-800/60"
              }`}
            >
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Platform Admin</span>
            </button>
          </div>

          {/* Tab 1: Sales Staff Login with Key */}
          {activeRole === "sales" && (
            <div className="bg-stone-900/95 border border-stone-800 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl space-y-6">
              {currentStaff ? (
                <div className="space-y-5 text-center">
                  <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 mx-auto flex items-center justify-center">
                    <CheckCircle2 className="w-7 h-7" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-white">Active Session Detected</h2>
                    <p className="text-xs text-stone-300 mt-1">
                      Signed in as <strong className="text-white">{currentStaff.name}</strong> (
                      {currentStaff.role})
                    </p>
                    <p className="text-[11px] font-mono text-emerald-400 mt-1">
                      Key: {currentStaff.key}
                    </p>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3 pt-2">
                    <Button
                      type="button"
                      onClick={() => void navigate({ to: "/crm" })}
                      className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-5 text-xs flex items-center justify-center gap-2"
                    >
                      <span>Open Sales CRM</span>
                      <ArrowRight className="w-4 h-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleStaffLogout}
                      className="border-stone-700 hover:bg-stone-800 text-stone-300 text-xs py-5"
                    >
                      <LogOut className="w-4 h-4 mr-1.5 text-stone-400" />
                      Sign Out
                    </Button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSalesSubmit} className="space-y-5">
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-stone-200">
                        Staff Access Key
                      </label>
                      <span className="text-[11px] text-stone-400 font-mono">
                        RAF-SALES-XXXX-XXXX
                      </span>
                    </div>
                    <div className="relative">
                      <KeyRound className="w-4 h-4 text-stone-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <Input
                        required
                        value={salesKey}
                        onChange={(e) => setSalesKey(e.target.value.toUpperCase())}
                        placeholder="RAF-SALES-XXXX-XXXX"
                        className="pl-10 font-mono bg-stone-950/80 border-stone-700 text-stone-100 placeholder:text-stone-600 uppercase text-center text-sm py-5 tracking-wider focus:border-emerald-500 focus:ring-emerald-500/20"
                        autoFocus
                      />
                    </div>
                  </div>

                  {salesError && (
                    <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2.5">
                      <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                      <div className="leading-relaxed">{salesError}</div>
                    </div>
                  )}

                  <Button
                    type="submit"
                    disabled={salesLoading}
                    className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-5 text-xs tracking-wide shadow-lg shadow-emerald-950/60"
                  >
                    {salesLoading ? "Validating Key…" : "Access Standalone Sales CRM"}
                  </Button>

                  <div className="rounded-2xl bg-stone-950/60 border border-stone-800/80 p-4 space-y-2 text-[11px] text-stone-400 leading-relaxed">
                    <div className="flex items-center gap-2 text-stone-300 font-semibold">
                      <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Sales Staff Direct Access</span>
                    </div>
                    <p>
                      Sales team members use their unique 16-character access key to log customer
                      calls, track participant follow-ups, and review real platform leads without
                      accessing the primary Admin Console.
                    </p>
                    <p className="text-[10px] text-stone-500 border-t border-stone-800 pt-2">
                      Need an access key? Contact your Raffila Operations Manager.
                    </p>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* Tab 2: Platform Administrator Login */}
          {activeRole === "admin" && (
            <div className="bg-stone-900/95 border border-stone-800 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl space-y-6">
              {isAdmin && user ? (
                <div className="space-y-5 text-center">
                  <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 mx-auto flex items-center justify-center">
                    <ShieldCheck className="w-7 h-7" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-white">Administrator Signed In</h2>
                    <p className="text-xs text-stone-300 mt-1">
                      Authenticated as <strong className="text-white">{user.email}</strong>
                    </p>
                  </div>

                  <Button
                    type="button"
                    onClick={() => void navigate({ to: "/admin" })}
                    className="w-full bg-stone-100 hover:bg-white text-stone-950 font-bold py-5 text-xs flex items-center justify-center gap-2"
                  >
                    <span>Enter Admin Dashboard</span>
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleAdminSubmit} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-stone-200">
                      Admin Email Address
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-stone-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <Input
                        type="email"
                        required
                        value={adminEmail}
                        onChange={(e) => setAdminEmail(e.target.value)}
                        placeholder="Raffilamarketplace@gmail.com"
                        className="pl-10 bg-stone-950/80 border-stone-700 text-stone-100 placeholder:text-stone-600 text-sm py-5"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-stone-200">Admin Password</label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-stone-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <Input
                        type="password"
                        required
                        value={adminPassword}
                        onChange={(e) => setAdminPassword(e.target.value)}
                        placeholder="••••••••"
                        className="pl-10 bg-stone-950/80 border-stone-700 text-stone-100 placeholder:text-stone-600 text-sm py-5"
                      />
                    </div>
                  </div>

                  {adminError && (
                    <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2.5">
                      <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                      <div className="leading-relaxed">{adminError}</div>
                    </div>
                  )}

                  <Button
                    type="submit"
                    disabled={adminLoading}
                    className="w-full bg-stone-100 hover:bg-white text-stone-950 font-bold py-5 text-xs tracking-wide"
                  >
                    {adminLoading ? "Authenticating Admin…" : "Sign In to Admin Console"}
                  </Button>

                  <div className="relative my-4">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-stone-800" />
                    </div>
                    <div className="relative flex justify-center text-[10px] uppercase font-bold text-stone-500">
                      <span className="bg-stone-900 px-3">or continue with</span>
                    </div>
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleAdminGoogleSignIn}
                    disabled={adminLoading}
                    className="w-full border-stone-700 hover:bg-stone-800 text-stone-200 py-5 text-xs font-semibold flex items-center justify-center gap-2.5"
                  >
                    <GoogleIcon className="w-4 h-4" />
                    <span>Google Workspace SSO (raffila.dev@gmail.com)</span>
                  </Button>

                  <div className="pt-2 text-center text-[11px] text-stone-400">
                    <p>
                      Admins generate staff keys inside{" "}
                      <span className="text-stone-300 font-mono">
                        Admin Settings &gt; Staff & CRM
                      </span>
                    </p>
                  </div>
                </form>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-stone-900 bg-stone-950/60 py-4 px-6 text-center text-xs text-stone-400">
        <p>© 2026 Raffila Limited. Internal Staff & Administration Services.</p>
      </footer>
    </div>
  );
}
