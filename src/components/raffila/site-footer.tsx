import { ArrowUpRight, Cookie, Instagram, Mail, ShieldCheck } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { showCookieBanner } from "@/components/raffila/cookie";

export function SiteFooter() {
  return (
    <footer className="mx-auto mt-16 w-full max-w-7xl px-4 pb-28 sm:px-6 lg:px-8 lg:pb-10">
      <div className="flex flex-col gap-8 rounded-[28px] bg-ink p-6 text-cream sm:p-8 lg:flex-row lg:items-start lg:justify-between">
        <div className="w-full max-w-md shrink-0">
          <div className="flex items-center gap-2">
            <img
              src="/Raffila-logo.png"
              alt=""
              className="size-9 shrink-0 rounded-2xl shadow-sm"
              width={36}
              height={36}
            />
            <span className="font-display text-xl font-extrabold">Raffila</span>
          </div>
          <p className="mt-4 text-sm leading-relaxed text-cream/70">
            Premium prize competitions, presented with clarity, care, and a commitment to fair
            chances.
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-2 text-xs font-bold text-cream/60">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-cream/15 px-3 py-1.5">
              <ShieldCheck className="size-3.5 text-raf-lime" /> Verifiable draws
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-cream/15 px-3 py-1.5">
              <Mail className="size-3.5 text-raf-gold" /> Secure accounts
            </span>
          </div>
          <div className="mt-5 space-y-1.5 text-sm font-bold text-cream/70">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-cream/40">
              Contact
            </p>
            <a href="mailto:support@raffila.com" className="block hover:text-cream break-all">
              support@raffila.com
            </a>
            <a href="mailto:helpdesk@raffila.com" className="block hover:text-cream break-all">
              helpdesk@raffila.com
            </a>
          </div>
        </div>
        <div className="grid w-full grid-cols-2 gap-x-6 gap-y-3 text-sm font-bold text-cream/65 xs:grid-cols-2 sm:grid-cols-3 lg:mt-0 lg:max-w-xl lg:grid-cols-3">
          <Link to="/competitions" className="hover:text-cream break-words">
            Competitions
          </Link>
          <Link to="/how-it-works" className="hover:text-cream break-words">
            How it works
          </Link>
          <Link to="/winners" className="hover:text-cream break-words">
            Winners
          </Link>
          <Link to="/terms-and-conditions" className="hover:text-cream break-words">
            Terms
          </Link>
          <Link to="/become-a-partner" className="hover:text-cream break-words">
            Partners
          </Link>
          <Link to="/faq" className="hover:text-cream break-words">
            FAQ
          </Link>
          <Link
            to="/auth"
            search={{ tab: "login" } as any}
            className="hover:text-cream break-words"
          >
            Log in
          </Link>
          <Link
            to="/auth"
            search={{ tab: "register" } as any}
            className="font-extrabold text-cream hover:text-raf-lime break-words"
          >
            Create account
          </Link>
          <Link to="/privacy-policy" className="hover:text-cream break-words">
            Privacy
          </Link>
          <Link
            to="/contact"
            className="inline-flex items-center gap-1 hover:text-cream break-words"
          >
            Contact <ArrowUpRight className="size-3.5 shrink-0" />
          </Link>
          <a
            href="https://instagram.com"
            className="inline-flex items-center gap-1 hover:text-cream break-words"
            aria-label="Raffila on Instagram"
          >
            Instagram <Instagram className="size-3.5 shrink-0" />
          </a>
          <Link to="/competition-rules" className="hover:text-cream break-words">
            Competition rules
          </Link>
          <Link to="/trust-safety" className="hover:text-cream break-words">
            Trust & Safety
          </Link>
          <Link to="/dashboard/entries" className="hover:text-cream break-words">
            My Entries
          </Link>
        </div>
      </div>
      <div className="mt-5 flex flex-col gap-3 px-1 text-xs font-bold text-ink/45 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="button"
          onClick={showCookieBanner}
          className="inline-flex w-fit items-center gap-1.5 rounded-full bg-ink/5 px-3 py-1.5 text-ink/55 ring-1 ring-ink/10 transition-colors hover:bg-ink/10 hover:text-ink"
        >
          <Cookie className="size-3.5 text-coral" /> Cookie preferences
        </button>
        <div className="flex flex-col gap-1 sm:items-end">
          <p>© 2026 Raffila. All rights reserved.</p>
          <p>
            Website developed by{" "}
            <a
              href="https://www.bwtng.live"
              target="_blank"
              rel="noopener noreferrer"
              className="font-extrabold underline decoration-ink/25 underline-offset-2 transition-colors hover:decoration-ink/60"
            >
              Bluewaves Technologies
            </a>{" "}
            — www.bwtng.live
          </p>
        </div>
      </div>
    </footer>
  );
}
