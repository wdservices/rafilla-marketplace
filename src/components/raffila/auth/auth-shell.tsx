import type { ReactNode } from "react";
import { ShieldCheck, BadgeCheck, WalletCards, Check } from "lucide-react";
import { cn, formatNaira } from "@/lib/utils";
import { usePrizesPaidOut } from "@/hooks/usePrizesPaidOut";

type AuthVariant = "login" | "register" | "forgot" | "otp" | "complete";

interface AuthShellProps {
  children: ReactNode;
  variant?: AuthVariant;
}

const products = [
  {
    image: "/raffila-mercedes.jpg",
    title: "Mercedes-Benz C-Class 2025",
    tagline: "Executive sedan. Premium everything.",
    value: "\u20A612,000,000",
  },
  {
    image: "/raffila-apartment.jpg",
    title: "Luxury 2-Bed Apartment \u2014 Lekki",
    tagline: "Your next address. Fully finished.",
    value: "\u20A638,000,000",
  },
  {
    image: "/raffila-tech-bundle.jpg",
    title: "Nova X1 Ultimate Tech Bundle",
    tagline: "Flagship phone + connected essentials.",
    value: "\u20A61,950,000",
  },
];

const trustItems = [
  {
    icon: <ShieldCheck className="size-5" />,
    title: "Fair, verified draws",
    text: "Every result is transparent and independently checkable.",
    color: "text-raf-green",
  },
  {
    icon: <BadgeCheck className="size-5" />,
    title: "Real prizes delivered",
    text: "Winners receive their prizes with proof of delivery.",
    color: "text-raf-gold",
  },
  {
    icon: <WalletCards className="size-5" />,
    title: "Secure entries, always",
    text: "Your account and payments are protected end-to-end.",
    color: "text-coral",
  },
];

function ProductCarousel() {
  return (
    <div
      className="relative w-full overflow-hidden rounded-2xl ring-1 ring-ink/5"
      style={{ aspectRatio: "2/1" }}
    >
      {products.map((p, i) => (
        <div
          key={p.title}
          className="absolute inset-0"
          style={{
            animation: `authSlide 12s ${i * 4}s ease-in-out infinite`,
            opacity: i === 0 ? 1 : 0,
          }}
        >
          <img src={p.image} alt={p.title} className="size-full object-cover" />
        </div>
      ))}
      <div className="absolute inset-0 bg-gradient-to-t from-ink/40 to-transparent" />

      <div className="absolute bottom-0 left-0 right-0 p-4">
        <div className="relative h-[70px]">
          {products.map((p, i) => (
            <div
              key={p.title}
              className="absolute bottom-0 left-0 right-0"
              style={{
                animation: `authSlide 12s ${i * 4}s ease-in-out infinite`,
                opacity: i === 0 ? 1 : 0,
              }}
            >
              <div className="flex items-center gap-2 mb-1.5">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-mint/90 px-2.5 py-0.5 text-[10px] font-extrabold text-ink">
                  <span className="size-1.5 rounded-full bg-green-600 animate-pulse" />
                  Live
                </span>
                <span className="font-display text-lg font-extrabold text-white">{p.value}</span>
              </div>
              <h3 className="font-display text-lg font-extrabold text-white leading-tight">
                {p.title}
              </h3>
              <p className="text-xs text-white/70">{p.tagline}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function AuthShell({ children, variant = "login" }: AuthShellProps) {
  const prizesPaidKobo = usePrizesPaidOut();
  return (
    <div className="min-h-screen bg-paper flex flex-col lg:flex-row">
      <div className="lg:hidden px-4 pt-6 pb-2">
        <div className="flex items-center gap-2">
          <img
            src="/Raffila-logo.png"
            alt=""
            className="size-8 shrink-0 rounded-xl shadow-sm"
            width={32}
            height={32}
          />
          <span className="font-display text-lg font-extrabold tracking-tight text-ink">
            Raffila
          </span>
        </div>
      </div>

      <div className="lg:hidden px-4 pb-6">
        <div className="rounded-2xl bg-white p-5 ring-1 ring-ink/5 shadow-lg">{children}</div>
      </div>

      <div className="hidden lg:flex w-[45%] shrink-0 flex-col h-screen sticky top-0 rounded-l-[32px] bg-cream p-7 xl:p-9 ring-1 ring-ink/5 overflow-hidden">
        <div className="flex items-center gap-2 mb-5">
          <img
            src="/Raffila-logo.png"
            alt=""
            className="size-10 shrink-0 rounded-2xl shadow-sm"
            width={40}
            height={40}
          />
          <span className="font-display text-2xl font-extrabold tracking-tight text-ink">
            Raffila
          </span>
        </div>

        <ProductCarousel />

        <div className="mt-5">
          <h2 className="font-display text-[28px] xl:text-[34px] font-extrabold leading-tight tracking-tight text-ink">
            Fair draws.
            <br />
            <span className="text-coral">Real prizes.</span>
          </h2>
          <p className="mt-3 text-[15px] leading-relaxed text-ink/60">
            Join thousands across Africa playing for premium homes, cars, cash, and lifestyle prizes
            — with complete peace of mind.
          </p>
        </div>

        <ul className="mt-5 space-y-3.5">
          {trustItems.map((item, i) => (
            <li key={i} className="flex items-start gap-3">
              <span
                className={cn(
                  "mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl bg-white/70 ring-1 ring-ink/5",
                  item.color,
                )}
              >
                {item.icon}
              </span>
              <div>
                <h3 className="text-[15px] font-extrabold text-ink">{item.title}</h3>
                <p className="mt-0.5 text-[13px] leading-relaxed text-ink/50">{item.text}</p>
              </div>
              <Check className="mt-1 ml-auto size-4 text-raf-green" aria-hidden />
            </li>
          ))}
        </ul>

        <div className="mt-auto pt-5">
          <div className="flex items-center gap-3 rounded-xl bg-white/60 p-4 ring-1 ring-ink/5">
            <span className="grid size-10 place-items-center rounded-xl bg-raf-gold text-ink">
              <BadgeCheck className="size-5" />
            </span>
            <div>
              <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-ink/45">
                Prizes paid out
              </p>
              <p className="mt-0.5 font-display text-xl font-extrabold text-ink">
                {prizesPaidKobo === null ? "\u20A6…" : `${formatNaira(prizesPaidKobo)}+`}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="hidden lg:flex flex-1 items-center justify-center p-8 xl:p-12">
        <div className="w-full max-w-[460px]">
          {children}

          <div className="mt-8 pt-6 border-t border-ink/5">
            <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
              {[
                { icon: <ShieldCheck className="size-4" />, label: "Fair draws" },
                { icon: <BadgeCheck className="size-4" />, label: "Real prizes" },
                { icon: <WalletCards className="size-4" />, label: "Secure payments" },
              ].map((item) => (
                <span
                  key={item.label}
                  className="inline-flex items-center gap-1.5 text-[11px] font-bold text-ink/45"
                >
                  <span className="text-mint">{item.icon}</span>
                  {item.label}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
