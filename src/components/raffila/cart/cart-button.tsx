import { useEffect, useState } from "react";
import { ShoppingCart } from "lucide-react";

import { openCart, useCartCount } from "@/lib/cart-store";
import { cn } from "@/lib/utils";

/**
 * Cart trigger with a ticket-count badge. Shared by the public site header and
 * both dashboard shells so a cart icon is never missing from a surface where
 * someone can add tickets.
 */
export function CartButton({ className }: { className?: string }) {
  const [mounted, setMounted] = useState(false);
  const count = useCartCount();

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <button
      type="button"
      onClick={openCart}
      aria-label={mounted && count > 0 ? `Open cart, ${count} tickets` : "Open cart"}
      data-testid="cart-button"
      className={cn(
        "relative grid size-10 shrink-0 place-items-center rounded-full bg-white text-ink ring-1 ring-ink/10 transition-colors hover:ring-coral/40",
        className,
      )}
    >
      <ShoppingCart className="size-5" />
      {mounted && count > 0 && (
        <span className="absolute -right-1 -top-1 grid min-w-5 place-items-center rounded-full bg-coral px-1 py-0.5 font-display text-[10px] font-extrabold leading-none text-white">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </button>
  );
}
