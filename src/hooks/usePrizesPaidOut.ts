import { useEffect, useState } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";

import { db } from "@/lib/firebase";

const CACHE_TTL_MS = 5 * 60 * 1000;

let cached: { totalKobo: number; at: number } | null = null;
let inFlight: Promise<number> | null = null;

/**
 * Total value of prizes already crowns to winners: sum of marketValueKobo
 * over every competition that has been drawn/won (WINNER_SELECTED) or
 * manually marked COMPLETED. Cached module-wide so the auth panel, landing
 * page and any future caller share one Firestore round trip.
 */
async function fetchPrizesPaidKobo(): Promise<number> {
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.totalKobo;
  if (inFlight) return inFlight;
  inFlight = (async () => {
    try {
      const snap = await getDocs(
        query(
          collection(db, "competitions"),
          where("status", "in", ["COMPLETED", "WINNER_SELECTED"]),
        ),
      );
      let total = 0;
      snap.forEach((d) => {
        total += Number(d.data()?.["marketValueKobo"] ?? 0) || 0;
      });
      cached = { totalKobo: total, at: Date.now() };
      return total;
    } finally {
      inFlight = null;
    }
  })();
  return inFlight;
}

export function usePrizesPaidOut(): number | null {
  const [totalKobo, setTotalKobo] = useState<number | null>(cached?.totalKobo ?? null);
  useEffect(() => {
    let alive = true;
    void fetchPrizesPaidKobo()
      .catch(() => 0)
      .then((t) => {
        if (alive) setTotalKobo(t);
      });
    return () => {
      alive = false;
    };
  }, []);
  return totalKobo;
}
