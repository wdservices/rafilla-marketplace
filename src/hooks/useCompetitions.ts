import { useEffect, useMemo, useState } from "react";

import type { Competition } from "@/lib/raffila-data";
import { getLiveCompetitions, isCompetitionConcluded } from "@/lib/competitions-feed";

export { isCompetitionConcluded };

/**
 * Module-level cache so landing → competitions → detail → cart all reuse one
 * Firestore round trip instead of re-fetching on every mount (sections used
 * to render empty, then pop in). Short TTL keeps admin views reasonably fresh.
 */
const CACHE_TTL_MS = 30_000;
type CacheEntry = { at: number; competitions: Competition[]; live: boolean };
const cache = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<CacheEntry>>();

async function loadCompetitions(includeDrafts: boolean): Promise<CacheEntry> {
  const key = includeDrafts ? "drafts" : "public";
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit;
  const pending = inflight.get(key);
  if (pending) return pending;
  const p = (async () => {
    try {
      const res = await getLiveCompetitions(includeDrafts);
      const entry: CacheEntry = { at: Date.now(), competitions: res.competitions, live: res.live };
      cache.set(key, entry);
      return entry;
    } finally {
      inflight.delete(key);
    }
  })();
  inflight.set(key, p);
  return p;
}

/** Bypass the cache — used after admin writes so fresh data loads immediately. */
export function invalidateCompetitionsCache() {
  cache.clear();
}

/**
 * Competitions everywhere in the app come from here, and Firestore is the only
 * source: the list starts empty so nothing fictional ever flashes on screen,
 * and deleted documents cannot come back on refresh. `live` is false when the
 * read failed. Pass includeDrafts for the admin management view.
 *
 * activeCompetitions strictly filters out any competition whose draw has concluded,
 * ensuring completed draws are never shown in open competition listings.
 */
export function useCompetitions(includeDrafts = false) {
  const cachedEntry = cache.get(includeDrafts ? "drafts" : "public");
  const [competitions, setCompetitions] = useState<Competition[]>(cachedEntry?.competitions ?? []);
  const [loading, setLoading] = useState(!cachedEntry);
  const [live, setLive] = useState(cachedEntry?.live ?? false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await loadCompetitions(includeDrafts);
        if (!cancelled) {
          setCompetitions(res.competitions);
          setLive(res.live);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [includeDrafts]);

  const activeCompetitions = useMemo(
    () => competitions.filter((c) => !isCompetitionConcluded(c)),
    [competitions],
  );

  return { competitions, activeCompetitions, loading, live };
}

export function findCompetition(list: Competition[], slug: string): Competition | undefined {
  return list.find((c) => c.slug === slug);
}
