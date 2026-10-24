import { useEffect, useState } from "react";

import type { WinnerCard } from "@/lib/raffila-data";
import { getLiveWinners } from "@/lib/competitions-feed";

/** Shared across mounts (landing + winners page + headers) — one round trip. */
const CACHE_TTL_MS = 60_000;
type CacheEntry = { at: number; winners: WinnerCard[]; live: boolean };
let cache: CacheEntry | null = null;
let inflight: Promise<CacheEntry> | null = null;

async function loadWinners(): Promise<CacheEntry> {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) return cache;
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const res = await getLiveWinners();
      cache = { at: Date.now(), winners: res.winners, live: res.live };
      return cache;
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

export function useWinners() {
  const [winners, setWinners] = useState<WinnerCard[]>(cache?.winners ?? []);
  const [loading, setLoading] = useState(!cache);
  const [live, setLive] = useState(cache?.live ?? false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await loadWinners();
        if (!cancelled) {
          setWinners(res.winners);
          setLive(res.live);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { winners, loading, live };
}
