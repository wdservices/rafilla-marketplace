import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { Home, Ticket, Mail, Search, ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const canonicalBase = "https://raffila.com";
const ogImageDefault = "https://raffila.com/og-default.png";

export const Route = createFileRoute("/$")({
  head: () => {
    const pathname = "/404";
    const canonical = `${canonicalBase}${pathname}`;
    const title = "Page not found — Raffila";
    const description =
      "Page not found (404). The competition, prize or page you requested has ended, been moved or never existed. Browse live draws and prizes on Raffila. raffila.com";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { name: "robots", content: "noindex, follow" },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { property: "og:url", content: canonical },
        { property: "og:site_name", content: "Raffila" },
        { property: "og:image", content: ogImageDefault },
        { property: "og:image:width", content: "1200" },
        { property: "og:image:height", content: "630" },
        { property: "og:locale", content: "en_NG" },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: title },
        { name: "twitter:description", content: description },
        { name: "twitter:image", content: ogImageDefault },
        { name: "twitter:site", content: "@raffilang" },
        { name: "twitter:creator", content: "@raffilang" },
      ],
      links: [
        { rel: "canonical", href: canonical },
        { rel: "alternate", hrefLang: "en", href: canonical },
      ],
    };
  },
  component: NotFoundPage,
});

function NotFoundPage() {
  const router = useRouter();
  const [query, setQuery] = useState("");

  const onSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    router.navigate({
      to: "/competitions",
      search: q ? { query: q } : {},
    });
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-cream text-ink">
      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
        <div className="absolute left-[8%] top-[22%] w-44 rotate-[-6deg] opacity-20 sm:w-56">
          <div className="aspect-[4/5] rounded-[28px] bg-paper p-3 ring-1 ring-ink/10 shadow-sm">
            <div className="aspect-[4/3] rounded-[22px] bg-lemon/40" />
            <div className="mt-3 space-y-2">
              <div className="h-3 w-3/4 rounded-full bg-ink/15" />
              <div className="h-2.5 w-1/2 rounded-full bg-ink/10" />
              <div className="h-2.5 w-5/6 rounded-full bg-ink/10" />
            </div>
          </div>
        </div>

        <div className="absolute right-[6%] top-[18%] w-40 rotate-[7deg] opacity-20 sm:w-52">
          <div className="aspect-[4/5] rounded-[28px] bg-paper p-3 ring-1 ring-ink/10 shadow-sm">
            <div className="aspect-[4/3] rounded-[22px] bg-lilac/40" />
            <div className="mt-3 space-y-2">
              <div className="h-3 w-2/3 rounded-full bg-ink/15" />
              <div className="h-2.5 w-3/5 rounded-full bg-ink/10" />
              <div className="h-2.5 w-4/5 rounded-full bg-ink/10" />
            </div>
          </div>
        </div>

        <div className="absolute bottom-[14%] left-[38%] w-32 rotate-[3deg] opacity-20 sm:w-44">
          <div className="aspect-[4/5] rounded-[28px] bg-paper p-3 ring-1 ring-ink/10 shadow-sm">
            <div className="aspect-[4/3] rounded-[22px] bg-sky/25" />
            <div className="mt-3 space-y-2">
              <div className="h-3 w-5/6 rounded-full bg-ink/15" />
              <div className="h-2.5 w-2/5 rounded-full bg-ink/10" />
              <div className="h-2.5 w-3/4 rounded-full bg-ink/10" />
            </div>
          </div>
        </div>
      </div>

      <main className="relative z-10 mx-auto flex min-h-[calc(100vh-120px)] w-full max-w-4xl flex-col items-center justify-center px-4 py-16 text-center sm:px-6 lg:px-8">
        <div className="font-display font-extrabold leading-none tracking-tight">
          <span
            className="bg-clip-text text-transparent"
            style={{
              fontSize: "clamp(8rem, 22vw, 14rem)",
              WebkitTextStroke: "2px var(--color-coral)",
              color: "var(--color-ink)",
              textShadow: "0 12px 60px -20px rgba(0,0,0,0.3)",
            }}
          >
            404
          </span>
        </div>

        <h1 className="mt-4 font-display text-4xl font-extrabold tracking-tight text-ink sm:text-5xl">
          Competition not found
        </h1>
        <p className="mt-4 max-w-xl text-base leading-relaxed text-ink/65 sm:text-lg">
          The page you're looking for has ended, been moved, or never existed.
        </p>

        <form
          onSubmit={onSearch}
          className="mt-10 flex w-full max-w-md items-center gap-2 rounded-full bg-paper px-2 py-1.5 ring-1 ring-ink/10 focus-within:ring-2 focus-within:ring-coral/60"
        >
          <label htmlFor="nf-search" className="sr-only">
            Search competitions
          </label>
          <Search className="ml-3 size-4 shrink-0 text-ink/40" />
          <Input
            id="nf-search"
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search competitions, prizes…"
            className="h-10 border-0 bg-transparent px-2 py-2 text-sm font-bold text-ink outline-none placeholder:text-ink/40 focus-visible:ring-0 shadow-none"
          />
          <Button type="submit" variant="primary" size="sm">
            Search
          </Button>
        </form>

        <div className="mt-8 flex w-full max-w-md flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
          <Button asChild variant="primary" size="lg" className="flex-1">
            <a href="/">
              <Home className="size-4" /> Back to Home
            </a>
          </Button>
          <Button asChild variant="outline" size="lg" className="flex-1">
            <a href="/competitions">
              <Ticket className="size-4" /> Browse competitions
            </a>
          </Button>
          <Button asChild variant="ghost" size="lg" className="flex-1">
            <a href="/contact">
              <Mail className="size-4" /> Contact us
            </a>
          </Button>
        </div>

        <a
          href="/competitions"
          className="mt-12 inline-flex items-center gap-1.5 text-xs font-extrabold text-coral hover:underline"
        >
          Or jump right to the live prize list <ArrowRight className="size-3.5" />
        </a>
      </main>
    </div>
  );
}
