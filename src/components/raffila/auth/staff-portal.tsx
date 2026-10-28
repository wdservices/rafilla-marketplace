import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  KeyRound,
  Mail,
  Lock,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  Building2,
  ShieldCheck,
  LogOut,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuthActions, useAuthSession } from "@/hooks/useAuthSession";
import { signOut as clearSession } from "@/lib/auth-store";
import { logoutFirebase } from "@/lib/firebase-auth";

export function StaffPortal() {
  const navigate = useNavigate();
  const actions = useAuthActions();
  const { user, role, isMounted } = useAuthSession();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const res = await actions.signIn({
      email: email.trim().toLowerCase(),
      password,
      redirectTo: false,
    });

    if (!res.ok) {
      setLoading(false);
      setError(res.message);
      return;
    }

    if (res.user.role !== "staff") {
      // Not a staff account — do not leave a half-open session behind.
      await logoutFirebase().catch(() => {});
      clearSession();
      setLoading(false);
      setError(
        "This account does not have CRM staff access. Ask an administrator to add you as staff.",
      );
      return;
    }

    setLoading(false);
    toast.success(`Welcome back, ${res.user.firstName || res.user.email}!`, {
      description: "Routing to your Sales & Outreach CRM…",
    });
    void navigate({ to: "/crm" });
  };

  const handleSignOut = () => {
    actions.signOut({ to: "/staff" });
  };

  const signedIn = isMounted && !!user;
  const isStaff = role === "staff";

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
                  CRM Staff Portal
                </span>
              </div>
              <p className="text-[11px] text-stone-400">Sales Staff Access</p>
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
              <span>Sales Staff Portal</span>
            </div>
            <h1 className="text-3xl font-display font-extrabold text-white tracking-tight">
              Staff Login
            </h1>
            <p className="text-xs text-stone-400 max-w-md mx-auto leading-relaxed">
              Sign in with the email and password you registered with Raffila. Staff accounts are
              routed straight to the Sales CRM.
            </p>
          </div>

          {!isMounted ? null : signedIn && isStaff ? (
            <div className="bg-stone-900/95 border border-stone-800 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl space-y-6 text-center">
              <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 mx-auto flex items-center justify-center">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">Active Session Detected</h2>
                <p className="text-xs text-stone-300 mt-1">
                  Signed in as{" "}
                  <strong className="text-white">
                    {user?.firstName || user?.email}
                  </strong>{" "}
                  (Staff)
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
                  onClick={handleSignOut}
                  className="border-stone-700 hover:bg-stone-800 text-stone-300 text-xs py-5"
                >
                  <LogOut className="w-4 h-4 mr-1.5 text-stone-400" />
                  Sign Out
                </Button>
              </div>
            </div>
          ) : signedIn ? (
            <div className="bg-stone-900/95 border border-stone-800 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl space-y-5 text-center">
              <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 mx-auto flex items-center justify-center">
                <AlertCircle className="w-7 h-7" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">No CRM Access</h2>
                <p className="text-xs text-stone-300 mt-1">
                  You are signed in as <strong className="text-white">{user?.email}</strong> but this
                  account is not a staff account.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={handleSignOut}
                className="border-stone-700 hover:bg-stone-800 text-stone-300 text-xs py-5 w-full"
              >
                <LogOut className="w-4 h-4 mr-1.5 text-stone-400" />
                Sign in with a staff account
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-stone-200">Registered Email</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-stone-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <Input
                    required
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value.toLowerCase())}
                    placeholder="you@email.com"
                    className="pl-10 bg-stone-950/80 border-stone-700 text-stone-100 placeholder:text-stone-600 text-sm py-5 focus:border-emerald-500 focus:ring-emerald-500/20"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-stone-200">Password</label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-stone-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <Input
                    required
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Your Raffila password"
                    className="pl-10 bg-stone-950/80 border-stone-700 text-stone-100 placeholder:text-stone-600 text-sm py-5 focus:border-emerald-500 focus:ring-emerald-500/20"
                  />
                </div>
              </div>

              {error && (
                <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <div className="leading-relaxed">{error}</div>
                </div>
              )}

              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-5 text-xs tracking-wide shadow-lg shadow-emerald-950/60"
              >
                {loading ? "Signing in…" : "Access Sales CRM"}
              </Button>

              <div className="rounded-2xl bg-stone-950/60 border border-stone-800/80 p-4 space-y-2 text-[11px] text-stone-400 leading-relaxed">
                <div className="flex items-center gap-2 text-stone-300 font-semibold">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Staff accounts only</span>
                </div>
                <p>
                  When an administrator adds you as staff, your normal Raffila login sends you here
                  and into the CRM. Customer and admin areas stay locked.
                </p>
                <p className="text-[10px] text-stone-500 border-t border-stone-800 pt-2 flex items-center gap-1.5">
                  <KeyRound className="w-3 h-3" />
                  No access key is required — use your registered password.
                  <Link
                    to="/auth"
                    className="text-emerald-400 hover:text-emerald-300 ml-auto"
                  >
                    Customer login →
                  </Link>
                </p>
              </div>
            </form>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-stone-900 bg-stone-950/60 py-4 px-6 text-center text-xs text-stone-400">
        <p>© 2026 Raffila Limited. CRM Staff Portal.</p>
      </footer>
    </div>
  );
}
