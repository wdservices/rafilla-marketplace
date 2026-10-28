import { useEffect, useState } from "react";
import { Link, createFileRoute, redirect } from "@tanstack/react-router";
import { ArrowRight, Ticket, UserRound } from "lucide-react";

import { Button } from "@/components/ui/button";
import { formatNaira, trackEvent } from "@/lib/raffila-data";
import { saveReferralCode } from "@/lib/referral-capture";
import { resolveInvite, type ResolveInviteResult } from "@/lib/referral-server";

const canonicalBase = "https://raffila.com";

export const Route = createFileRoute("/invite/$code")({
  validateSearch: (search: Record<string, unknown>): { comp?: string } => {
    const comp = String(search["comp"] ?? "").trim();
    return comp ? { comp } : {};
  },
  beforeLoad: ({ params, search }) => {
    const code = String(params.code ?? "").trim();
    if (typeof window !== "undefined" && code) {
      saveReferralCode(code);
    }
    // Directly send prospects to Create Account page with referral attribution
    throw redirect({
      to: "/auth",
      search: {
        tab: "register",
        ref: code,
        ...(search?.comp ? { comp: search.comp } : {}),
      },
    });
  },
  head: ({ params }) => {
    const code = String(params.code ?? "").toUpperCase();
    const title = `Invited to Raffila — ${code} | Raffila Grand Prizes`;
    return {
      meta: [
        { title },
        {
          name: "description",
          content:
            "You've been invited to a Raffila prize draw. Secure your ticket, transparent draws, real prizes.",
        },
        { property: "og:title", content: title },
        { property: "og:url", content: `${canonicalBase}/invite/${code}` },
        { name: "robots", content: "noindex" },
      ],
    };
  },
  component: InviteLandingPage,
});

function InviteLandingPage() {
  const { code } = Route.useParams();
  const { comp } = Route.useSearch();
  const [state, setState] = useState<
    { phase: "loading" } | { phase: "done"; result: ResolveInviteResult }
  >({ phase: "loading" });

  useEffect(() => {
    let cancelled = false;
    setState({ phase: "loading" });
    void (async () => {
      try {
        const result = await resolveInvite({ data: { code, slug: comp ?? "" } });
        if (cancelled) return;
        // Only persist the code once the server has confirmed it — a typo'd
        // invite link must never overwrite a valid pending attribution.
        if (result.ok) saveReferralCode(result.code);
        trackEvent("invite_view", { code: result.code, valid: result.ok, comp: comp ?? "" });
        setState({ phase: "done", result });
      } catch {
        if (!cancelled) {
          setState({
            phase: "done",
            result: { ok: false, code, referrer: null, competition: null },
          });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [code, comp]);

  const result = state.phase === "done" ? state.result : null;
  const competition = result?.competition ?? null;
  const referrer = result?.referrer ?? null;

  return (
    <div className="mx-auto flex min-h-[70vh] w-full max-w-xl flex-col items-center justify-center px-4 py-16 text-center sm:px-6">
      {state.phase === "loading" ? (
        <div className="flex flex-col items-center gap-4">
          <div className="size-10 animate-spin rounded-full border-4 border-ink/10 border-t-coral" />
          <p className="text-sm font-bold text-ink/55">Checking your invite…</p>
        </div>
      ) : !result?.ok ? (
        <>
          <div className="grid size-16 place-items-center rounded-full bg-cream ring-1 ring-ink/10">
            <Ticket className="size-7 text-ink/40" />
          </div>
          <h1 className="mt-6 font-display text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">
            This invite link isn't valid
          </h1>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-ink/60 sm:text-base">
            The code <span className="font-mono font-bold text-ink">{code.toUpperCase()}</span>{" "}
            doesn't match any Raffila member. Ask your friend for a fresh link, or browse the live
            draws yourself.
          </p>
          <div className="mt-8 flex w-full max-w-sm flex-col gap-3 sm:flex-row sm:justify-center">
            <Button asChild variant="primary" size="lg" className="min-h-12 flex-1">
              <Link to="/competitions">
                Browse competitions <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>
        </>
      ) : (
        <>
          <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-coral">
            You've been invited
          </p>
          <div className="mt-5 flex flex-col items-center">
            <div className="grid size-16 place-items-center rounded-full bg-coral/10 font-display text-lg font-extrabold text-coral ring-2 ring-coral/30">
              {referrer?.initials || <UserRound className="size-7" />}
            </div>
            <h1 className="mt-4 font-display text-3xl font-extrabold leading-tight tracking-tight text-ink sm:text-4xl">
              {referrer?.name || "A friend"} invited you
            </h1>
            {referrer?.handle ? (
              <p className="mt-1 text-sm font-bold text-ink/50">@{referrer.handle}</p>
            ) : null}
          </div>

          {competition ? (
            <div className="mt-8 w-full overflow-hidden rounded-[28px] bg-white text-left ring-1 ring-ink/5">
              {competition.image ? (
                <div className="relative aspect-[16/9] w-full overflow-hidden bg-cream">
                  <img
                    src={competition.image}
                    alt={competition.title}
                    className="size-full object-cover"
                    loading="lazy"
                  />
                </div>
              ) : null}
              <div className="p-5 sm:p-6">
                <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-ink/45">
                  The prize draw they're talking about
                </p>
                <h2 className="mt-2 font-display text-xl font-extrabold text-ink sm:text-2xl">
                  {competition.title}
                </h2>
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  {competition.entryPriceKobo > 0 ? (
                    <span className="inline-flex items-center rounded-full bg-coral/10 px-3 py-1.5 text-xs font-extrabold text-coral">
                      Tickets from {formatNaira(competition.entryPriceKobo)}
                    </span>
                  ) : null}
                  {competition.status ? (
                    <span className="inline-flex items-center rounded-full bg-mint/30 px-3 py-1.5 text-[11px] font-extrabold text-ink">
                      {competition.status.replace(/_/g, " ")}
                    </span>
                  ) : null}
                </div>
                <Button asChild variant="primary" size="lg" className="mt-5 w-full min-h-12">
                  <Link to="/competitions/$slug" params={{ slug: competition.slug }}>
                    View competition & enter <ArrowRight className="size-4" />
                  </Link>
                </Button>
              </div>
            </div>
          ) : (
            <p className="mt-6 max-w-md text-sm leading-relaxed text-ink/60">
              Your invite is applied to this device — create your account (or sign in) and any
              ticket you buy will count for {referrer?.name || "your friend"}.
            </p>
          )}

          <Button asChild variant="outline" size="lg" className="mt-4 w-full max-w-sm min-h-12">
            <Link to="/competitions">Browse all competitions</Link>
          </Button>

          <p className="mt-8 max-w-sm text-[11px] font-bold leading-relaxed text-ink/40">
            New to Raffila? Sign up with the same browser and this invite attaches to your account
            automatically.
          </p>
        </>
      )}
    </div>
  );
}
