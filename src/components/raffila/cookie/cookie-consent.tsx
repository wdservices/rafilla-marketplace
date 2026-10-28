import { useEffect, useState, useCallback } from "react";
import { Cookie, X, ShieldCheck, Settings2, Info, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

const COOKIE_KEY = "raffila.cookieConsent.v1";
const EVENT_OPEN = "raffila:cookie-open";

type CookiePrefs = {
  necessary: boolean;
  functional: boolean;
  analytics: boolean;
  timestamp: number;
};

function readConsent(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(COOKIE_KEY);
  } catch {
    return null;
  }
}

function writeConsent(value: string) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(COOKIE_KEY, value);
  } catch {
    /* ignore storage error */
  }
}

export function showCookieBanner() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(COOKIE_KEY);
  } catch {
    /* ignore storage error */
  }
  document.dispatchEvent(new CustomEvent(EVENT_OPEN));
}

export function CookieConsentBanner() {
  const [show, setShow] = useState(false);
  const [prefsOpen, setPrefsOpen] = useState(false);
  const [functional, setFunctional] = useState(true);
  const [analytics, setAnalytics] = useState(false);

  const check = useCallback(() => {
    const stored = readConsent();
    if (!stored || (stored !== "accepted" && stored !== "rejected")) {
      try {
        const parsed = JSON.parse(stored ?? "{}") as Partial<CookiePrefs>;
        if (!parsed.necessary && !parsed.timestamp) {
          setShow(true);
          return;
        }
      } catch {
        setShow(true);
      }
    }
  }, []);

  useEffect(() => {
    check();
    const onOpen = () => {
      const stored = readConsent();
      if (stored) {
        try {
          const parsed = JSON.parse(stored) as Partial<CookiePrefs>;
          setFunctional(parsed.functional ?? true);
          setAnalytics(parsed.analytics ?? false);
        } catch {
          /* ignore parse error */
        }
      }
      setPrefsOpen(true);
    };
    document.addEventListener(EVENT_OPEN, onOpen);
    return () => document.removeEventListener(EVENT_OPEN, onOpen);
  }, [check]);

  const acceptAll = () => {
    writeConsent("accepted");
    setShow(false);
    toast.success("Thanks! You can change preferences any time in footer.", {
      style: {
        background: "var(--color-paper)",
        border: "1px solid var(--color-mint)",
        color: "var(--color-ink)",
        borderRadius: "9999px",
      },
    });
  };

  const rejectNonNecessary = () => {
    writeConsent("rejected");
    setShow(false);
    toast.message("Only necessary cookies set", {
      style: {
        background: "var(--color-paper)",
        border: "1px solid var(--color-ink/15)",
        color: "var(--color-ink)",
        borderRadius: "9999px",
      },
    });
  };

  const openPrefs = () => {
    const stored = readConsent();
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as Partial<CookiePrefs>;
        setFunctional(parsed.functional ?? true);
        setAnalytics(parsed.analytics ?? false);
      } catch {
        /* ignore parse error */
      }
    }
    setPrefsOpen(true);
  };

  const savePrefs = () => {
    const payload: CookiePrefs = {
      necessary: true,
      functional,
      analytics,
      timestamp: Date.now(),
    };
    writeConsent(JSON.stringify(payload));
    setPrefsOpen(false);
    setShow(false);
    toast.success("Preferences saved", {
      style: {
        background: "var(--color-paper)",
        border: "1px solid var(--color-mint)",
        color: "var(--color-ink)",
        borderRadius: "9999px",
      },
    });
  };

  if (!show && !prefsOpen) return null;

  return (
    <>
      {show && (
        <div className="fixed inset-x-0 bottom-0 z-50 px-4 pb-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl rounded-[28px] bg-paper p-5 shadow-xl ring-1 ring-ink/5 sm:p-6">
            <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
              <div className="flex flex-1 items-start gap-4">
                <span className="grid size-12 shrink-0 place-items-center rounded-full bg-coral text-paper shadow-sm">
                  <Cookie className="size-6" />
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="font-display text-xl font-extrabold text-ink">
                    🍪 Cookie preference
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-ink/65">
                    We use cookies to keep Raffila secure, understand usage, and improve. We never
                    share data. You can choose.
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-mint/25 px-3 py-1.5 text-[11px] font-extrabold text-ink ring-1 ring-mint/30">
                      <ShieldCheck className="size-3.5 text-mint" /> Necessary (always on)
                    </span>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-lilac/30 px-3 py-1.5 text-[11px] font-extrabold text-ink ring-1 ring-lilac/25">
                      <Sparkles className="size-3.5 text-lilac" /> Functional
                    </span>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-sky/20 px-3 py-1.5 text-[11px] font-extrabold text-ink ring-1 ring-sky/25">
                      <Info className="size-3.5 text-sky" /> Analytics
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={rejectNonNecessary}
                  className="grid size-8 shrink-0 place-items-center rounded-full text-ink/40 transition-colors hover:bg-ink/10 hover:text-ink md:hidden"
                  aria-label="Dismiss cookie banner"
                >
                  <X className="size-4" />
                </button>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row md:shrink-0">
                <Button variant="outline" size="md" onClick={openPrefs}>
                  <Settings2 className="size-4" /> Manage preferences
                </Button>
                <Button
                  variant="outline"
                  size="md"
                  onClick={rejectNonNecessary}
                  className="border-coral/30 text-coral hover:bg-coral/10 hover:text-coral"
                >
                  Reject non-necessary
                </Button>
                <Button variant="primary" size="md" onClick={acceptAll}>
                  Accept all
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      <Dialog open={prefsOpen} onOpenChange={setPrefsOpen}>
        <DialogContent className="max-w-lg rounded-[28px] border-0 bg-paper p-6 shadow-2xl ring-1 ring-ink/5 sm:p-8">
          <DialogHeader>
            <div className="flex items-start gap-3">
              <span className="grid size-12 shrink-0 place-items-center rounded-full bg-coral text-paper shadow-sm">
                <Settings2 className="size-6" />
              </span>
              <div className="flex-1 text-left">
                <DialogTitle className="font-display text-2xl font-extrabold text-ink">
                  Cookie preferences
                </DialogTitle>
                <DialogDescription className="mt-1.5 text-sm text-ink/60">
                  Manage your privacy choices.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <Separator className="my-2 bg-ink/10" />

          <div className="space-y-4 py-2">
            <div className="rounded-[22px] bg-cream p-5 ring-1 ring-ink/5">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className="font-display text-base font-extrabold text-ink">
                      Strictly necessary
                    </h4>
                    <span className="rounded-full bg-mint/30 px-2 py-0.5 text-[10px] font-extrabold text-ink">
                      Always on
                    </span>
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-ink/60">
                    Required for site function, cannot be turned off. These cookies enable core
                    features like security, account access, and ticket session state.
                  </p>
                  <button
                    type="button"
                    className="mt-2 inline-flex items-center gap-1 text-xs font-extrabold text-coral hover:underline"
                  >
                    Learn more <Info className="size-3" />
                  </button>
                </div>
                <Switch checked disabled className="shrink-0 data-[state=checked]:bg-coral" />
              </div>
            </div>

            <div className="rounded-[22px] bg-paper p-5 ring-1 ring-ink/5">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <Label className="font-display text-base font-extrabold text-ink">
                    Functional
                  </Label>
                  <p className="mt-2 text-sm leading-relaxed text-ink/60">
                    Remembers preferences, language, ticket cart, and UI customization to give you a
                    smoother experience.
                  </p>
                  <button
                    type="button"
                    className="mt-2 inline-flex items-center gap-1 text-xs font-extrabold text-coral hover:underline"
                  >
                    Learn more <Info className="size-3" />
                  </button>
                </div>
                <Switch
                  checked={functional}
                  onCheckedChange={setFunctional}
                  className="shrink-0 data-[state=checked]:bg-coral"
                />
              </div>
            </div>

            <div className="rounded-[22px] bg-paper p-5 ring-1 ring-ink/5">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <Label className="font-display text-base font-extrabold text-ink">
                    Analytics
                  </Label>
                  <p className="mt-2 text-sm leading-relaxed text-ink/60">
                    Aggregate usage data to improve Raffila. Covers Google Analytics / Plausible
                    style measurement (UI-only in preview).
                  </p>
                  <button
                    type="button"
                    className="mt-2 inline-flex items-center gap-1 text-xs font-extrabold text-coral hover:underline"
                  >
                    Learn more <Info className="size-3" />
                  </button>
                </div>
                <Switch
                  checked={analytics}
                  onCheckedChange={setAnalytics}
                  className="shrink-0 data-[state=checked]:bg-coral"
                />
              </div>
            </div>
          </div>

          <DialogFooter className="mt-2 flex-col-reverse gap-2 sm:flex-row">
            <Button variant="ghost" size="md" onClick={() => setPrefsOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="md" onClick={savePrefs}>
              Save preferences
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
