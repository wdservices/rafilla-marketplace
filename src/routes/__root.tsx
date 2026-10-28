import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  createRootRouteWithContext,
  HeadContent,
  Scripts,
  useLocation,
  redirect,
  type ErrorComponentProps,
  type ParsedLocation,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { SiteFooter } from "@/components/raffila/site-footer";
import { SiteHeader } from "@/components/raffila/site-header";
import { CookieConsentBanner } from "@/components/raffila/cookie";
import { BuildMismatchBanner } from "@/components/raffila/build-mismatch-banner";
import { ScheduledDrawNotification } from "@/components/raffila/draws";
import { CartDrawer } from "@/components/raffila/cart/cart-drawer";
import { Toaster } from "@/components/ui/sonner";
import { ErrorPage } from "@/components/raffila/error-page";
import { canAccessRoute } from "@/lib/auth-store";
import { captureReferralFromLocation } from "@/lib/referral-capture";

/** Baked at release build time; empty in dev. Visible in view-source. */
const BUILD_ID = String(
  (typeof import.meta !== "undefined" && import.meta.env?.["VITE_BUILD_ID"]) || "",
).trim();

function NotFoundComponent() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-cream text-ink">
      <div className="relative z-10 mx-auto flex min-h-[calc(100vh-120px)] w-full max-w-4xl flex-col items-center justify-center px-4 py-16 text-center sm:px-6 lg:px-8">
        <div
          className="font-display font-extrabold leading-none tracking-tight"
          style={{
            fontSize: "clamp(8rem, 22vw, 14rem)",
            color: "var(--color-ink)",
            textShadow: "0 12px 60px -20px rgba(0,0,0,0.3)",
            WebkitTextStroke: "2px var(--color-coral)",
          }}
        >
          404
        </div>
        <h1 className="mt-4 font-display text-4xl font-extrabold tracking-tight text-ink sm:text-5xl">
          Competition not found
        </h1>
        <p className="mt-4 max-w-xl text-base leading-relaxed text-ink/65 sm:text-lg">
          The page you're looking for has ended, been moved, or never existed.
        </p>
        <div className="mt-10 flex w-full max-w-md flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
          <a
            href="/"
            className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-coral px-6 text-sm font-extrabold text-paper shadow-[0_8px_20px_-8px_var(--coral)] transition-transform hover:-translate-y-0.5 active:translate-y-px"
          >
            🏠 Back to Home
          </a>
          <a
            href="/competitions"
            className="inline-flex h-12 items-center justify-center gap-2 rounded-full border border-ink/15 bg-paper px-6 text-sm font-extrabold text-ink transition-transform hover:-translate-y-0.5 hover:bg-lilac/15 active:translate-y-px"
          >
            🎟 Browse competitions
          </a>
          <a
            href="/contact"
            className="inline-flex h-12 items-center justify-center gap-2 rounded-full px-6 text-sm font-extrabold text-ink/65 transition-colors hover:bg-paper hover:text-ink active:translate-y-px"
          >
            ✉️ Contact us
          </a>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: ErrorComponentProps) {
  console.error(error);
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);
  return (
    <ErrorPage error={error instanceof Error ? error : new Error(String(error))} reset={reset} />
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  beforeLoad: ({ location }: { location: ParsedLocation }) => {
    const gate = canAccessRoute({ pathname: location.pathname });
    if (!gate.allowed) {
      throw redirect({
        to: gate.redirect as any,
        ...(gate.search ? { search: gate.search } : {}),
      });
    }
  },
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      ...(BUILD_ID ? [{ name: "build-id", content: BUILD_ID }] : []),
      { title: "Raffila Grand Prizes — Fair draws. Real prizes." },
      {
        name: "description",
        content:
          "Premium prize competitions with publicly verifiable draws, secure entries, and real prizes delivered.",
      },
      { property: "og:title", content: "Raffila Grand Prizes — Fair draws. Real prizes." },
      {
        property: "og:description",
        content:
          "Premium prize competitions with publicly verifiable draws, secure entries, and real prizes delivered.",
      },
      { name: "theme-color", content: "#0E1021" },
      { name: "author", content: "Raffila" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "default" },
      { name: "apple-mobile-web-app-title", content: "Raffila" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Manrope:wght@500;600;700;800&family=Inter:wght@400;500;600;700;800&display=swap",
      },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/Raffila-logo.png" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body suppressHydrationWarning>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const location = useLocation();
  const pathname = location.pathname;

  // Capture referral attribution from ?ref= on any landing URL (the dedicated
  // /invite/$code page saves its own code too). Cheap and idempotent.
  useEffect(() => {
    captureReferralFromLocation();
  }, [pathname, location.searchStr]);

  const hidePublicChrome =
    pathname === "/auth" ||
    pathname.startsWith("/auth/") ||
    pathname === "/dashboard" ||
    pathname.startsWith("/dashboard/") ||
    pathname === "/admin" ||
    pathname.startsWith("/admin/") ||
    pathname === "/partner" ||
    pathname.startsWith("/partner/") ||
    pathname === "/crm" ||
    pathname.startsWith("/crm/") ||
    pathname === "/staff" ||
    pathname.startsWith("/staff/");

  return (
    <QueryClientProvider client={queryClient}>
      <div className="min-h-screen overflow-x-hidden bg-cream text-ink">
        <a
          href="#main-content"
          className="fixed top-4 left-4 z-[100] -translate-y-[200%] rounded-full bg-ink px-6 py-2 text-cream font-extrabold shadow-xl transition-transform focus-visible:translate-y-0"
        >
          Skip to content
        </a>
        <BuildMismatchBanner />
        {!hidePublicChrome && <ScheduledDrawNotification />}
        {!hidePublicChrome && <SiteHeader />}
        <main id="main-content" tabIndex={-1}>
          <Outlet />
        </main>
        {!hidePublicChrome && <SiteFooter />}
        {!hidePublicChrome && <CookieConsentBanner />}
        <CartDrawer />
        <Toaster position="top-center" richColors closeButton />
      </div>
    </QueryClientProvider>
  );
}
