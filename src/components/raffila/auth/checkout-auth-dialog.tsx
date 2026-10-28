import { useState } from "react";
import { ShieldCheck, X } from "lucide-react";

import { AuthTabs } from "@/components/raffila/auth/tabs";
import { LoginForm } from "@/components/raffila/auth/login-form";
import { RegisterForm } from "@/components/raffila/auth/register-form";
import { formatNaira } from "@/lib/raffila-data";
import { cn } from "@/lib/utils";

/**
 * Sign-in / sign-up shown at the payment step for guests.
 *
 * The cart (and whichever competition the visitor picked) stays exactly where
 * it is — the selection is held in local storage, so a refresh loses nothing.
 * On success the caller resumes checkout in place: no page redirect, no
 * re-picking tickets.
 */
export function CheckoutAuthDialog({
  open,
  onClose,
  onAuthenticated,
  totalKobo,
  ticketCount,
  competitionTitle,
}: {
  open: boolean;
  onClose: () => void;
  onAuthenticated: () => void;
  totalKobo: number;
  ticketCount: number;
  competitionTitle?: string | undefined;
}) {
  const [tab, setTab] = useState<"login" | "register">("login");
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-ink/50 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="relative mx-0 flex max-h-[92vh] w-full max-w-md flex-col overflow-hidden rounded-t-[28px] bg-white ring-1 ring-ink/10 sm:mx-4 sm:max-h-[88vh] sm:rounded-[28px]"
        style={{ maxHeight: "92vh" }}
      >
        <button
          onClick={onClose}
          aria-label="Close sign in"
          className="absolute right-4 top-4 z-10 grid size-9 place-items-center rounded-full bg-paper text-ink/50 hover:text-ink"
        >
          <X className="size-4" />
        </button>

        <div className="flex-1 overflow-y-auto px-5 pb-6 pt-6 sm:px-7">
          <div className="space-y-5">
            <header>
              <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-coral">
                Last step
              </p>
              <h2 className="mt-1.5 font-display text-2xl font-extrabold tracking-tight text-ink">
                Sign in to pay
              </h2>
              <p className="mt-2 text-sm font-bold text-ink/55">
                Sign in or create an account — your selection waits right here and payment comes
                straight back up.
              </p>
            </header>

            <div
              className={cn(
                "rounded-2xl bg-cream p-4 ring-1 ring-ink/5",
                "flex items-center gap-3",
              )}
            >
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-mint/30 text-ink">
                <ShieldCheck className="size-5" />
              </span>
              <div className="min-w-0">
                <p className="truncate font-display text-sm font-extrabold text-ink">
                  {ticketCount} {ticketCount === 1 ? "ticket" : "tickets"} ·{" "}
                  {formatNaira(totalKobo)}
                </p>
                <p className="truncate text-[11px] font-bold text-ink/50">
                  {competitionTitle ? `${competitionTitle} · ` : ""}Saved while you sign in
                </p>
              </div>
            </div>

            <AuthTabs activeTab={tab} onTabChange={setTab} />

            <div key={tab} className="raf-rise">
              {tab === "login" ? (
                <LoginForm
                  onSwitchToRegister={() => setTab("register")}
                  onSuccess={onAuthenticated}
                />
              ) : (
                <RegisterForm onSwitchToLogin={() => setTab("login")} onSuccess={onAuthenticated} />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
