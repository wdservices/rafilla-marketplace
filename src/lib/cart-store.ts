import { useSyncExternalStore } from "react";

export type CartItem = {
  competitionSlug: string;
  quantity: number;
};

export const CART_STORAGE_KEY = "raffila:cart:v1";
export const CART_MAX_LINES = 20;
export const CART_MAX_QTY_PER_LINE = 50;

export type CompetitionPrice = {
  slug: string;
  title: string;
  entryPriceKobo: number;
  image?: string;
  totalEntries?: number;
  entriesSold?: number;
};

export type CartLine = {
  competitionSlug: string;
  title: string;
  entryPriceKobo: number;
  image: string;
  quantity: number;
  lineTotalKobo: number;
  remaining?: number;
};

function readStored(): CartItem[] {
  if (typeof window === "undefined" || typeof window.localStorage === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(CART_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (it): it is CartItem =>
          !!it &&
          typeof it === "object" &&
          typeof (it as CartItem).competitionSlug === "string" &&
          Number.isInteger((it as CartItem).quantity),
      )
      .map((it) => ({
        competitionSlug: it.competitionSlug.trim(),
        quantity: Math.max(1, Math.min(CART_MAX_QTY_PER_LINE, it.quantity)),
      }))
      .filter((it) => it.competitionSlug.length > 0)
      .slice(0, CART_MAX_LINES);
  } catch {
    return [];
  }
}

let items: CartItem[] = readStored();
/**
 * Cached copy of `items` with a STABLE identity. `useSyncExternalStore`
 * compares snapshots with Object.is, so returning a fresh array from
 * getSnapshot() on every call would schedule an endless re-render loop
 * ("Maximum update depth exceeded") and freeze the page — killing every
 * click handler on screen. Rebuilt only when the cart actually changes.
 */
let snapshot: CartItem[] = items;
let drawerOpen = false;
const itemListeners = new Set<() => void>();
const drawerListeners = new Set<() => void>();

function persist() {
  try {
    window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
  } catch {
    // Private mode etc. — cart simply doesn't survive reloads.
  }
}

function commitItems() {
  snapshot = [...items];
  persist();
  emitItems();
}

function emitItems() {
  itemListeners.forEach((l) => l());
}

function emitDrawer() {
  drawerListeners.forEach((l) => l());
}

function subscribeItems(listener: () => void): () => void {
  itemListeners.add(listener);
  return () => {
    itemListeners.delete(listener);
  };
}

function subscribeDrawer(listener: () => void): () => void {
  drawerListeners.add(listener);
  return () => {
    drawerListeners.delete(listener);
  };
}

export function getCartItems(): CartItem[] {
  return snapshot;
}

export function getCartCount(): number {
  return items.reduce((n, it) => n + it.quantity, 0);
}

export function addToCart(competitionSlug: string, quantity: number): void {
  const slug = (competitionSlug || "").trim();
  const qty = Math.floor(quantity);
  if (!slug || !Number.isFinite(qty) || qty < 1) return;
  const capped = Math.min(CART_MAX_QTY_PER_LINE, qty);
  const existingIdx = items.findIndex((it) => it.competitionSlug === slug);
  if (existingIdx >= 0) {
    // Replace with a new object rather than mutating in place: the previous
    // snapshot shares these references, and useSyncExternalStore consumers must
    // never see a value change underneath them.
    items = [
      ...items.slice(0, existingIdx),
      {
        competitionSlug: slug,
        quantity: Math.min(CART_MAX_QTY_PER_LINE, items[existingIdx]!.quantity + capped),
      },
      ...items.slice(existingIdx + 1),
    ];
  } else {
    if (items.length >= CART_MAX_LINES) return;
    items = [...items, { competitionSlug: slug, quantity: capped }];
  }
  commitItems();
}

export function setCartQty(competitionSlug: string, quantity: number): void {
  const qty = Math.floor(quantity);
  if (qty < 1) {
    removeFromCart(competitionSlug);
    return;
  }
  const idx = items.findIndex((it) => it.competitionSlug === competitionSlug);
  if (idx < 0) return;
  items = [
    ...items.slice(0, idx),
    {
      competitionSlug: items[idx]!.competitionSlug,
      quantity: Math.min(CART_MAX_QTY_PER_LINE, qty),
    },
    ...items.slice(idx + 1),
  ];
  commitItems();
}

export function removeFromCart(competitionSlug: string): void {
  const next = items.filter((it) => it.competitionSlug !== competitionSlug);
  if (next.length === items.length) return;
  items = next;
  commitItems();
}

export function clearCart(): void {
  if (items.length === 0) return;
  items = [];
  commitItems();
}

export function openCart(): void {
  drawerOpen = true;
  emitDrawer();
}

export function closeCart(): void {
  drawerOpen = false;
  emitDrawer();
}

const EMPTY_CART_SNAPSHOT: CartItem[] = [];

export function useCartItems(): CartItem[] {
  return useSyncExternalStore(subscribeItems, getCartItems, () => EMPTY_CART_SNAPSHOT);
}

export function useCartCount(): number {
  const list = useCartItems();
  return list.reduce((n, it) => n + it.quantity, 0);
}

export function useCartOpen(): boolean {
  return useSyncExternalStore(
    subscribeDrawer,
    () => drawerOpen,
    () => false,
  );
}

/**
 * Join cart lines with the live catalogue (prices/titles always come from
 * here, never from storage). Unknown slugs are dropped.
 */
export function resolveCartLines(
  cart: CartItem[],
  catalogue: CompetitionPrice[],
): { lines: CartLine[]; subtotalKobo: number; totalQty: number } {
  const bySlug = new Map(catalogue.map((c) => [c.slug, c]));
  const lines: CartLine[] = [];
  for (const it of cart) {
    const comp = bySlug.get(it.competitionSlug);
    if (!comp || comp.entryPriceKobo <= 0) continue;
    const remaining =
      typeof comp.totalEntries === "number" && comp.totalEntries > 0
        ? Math.max(0, comp.totalEntries - (comp.entriesSold ?? 0))
        : undefined;
    const quantity =
      typeof remaining === "number" ? Math.min(it.quantity, Math.max(0, remaining)) : it.quantity;
    lines.push({
      competitionSlug: it.competitionSlug,
      title: comp.title,
      entryPriceKobo: comp.entryPriceKobo,
      image: comp.image ?? "",
      quantity,
      lineTotalKobo: comp.entryPriceKobo * quantity,
      ...(typeof remaining === "number" ? { remaining } : {}),
    });
  }
  return {
    lines,
    subtotalKobo: lines.reduce((n, l) => n + l.lineTotalKobo, 0),
    totalQty: lines.reduce((n, l) => n + l.quantity, 0),
  };
}
