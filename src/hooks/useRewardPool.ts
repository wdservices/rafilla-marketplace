import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";

import { db } from "@/lib/firebase";
import { REWARD_POOL } from "@/lib/raffila-data";
import { DEFAULT_REWARD_POOL_PCT } from "@/lib/paystack-server";

export type RewardPoolState = {
  totalKobo: number;
  contributionPct: number;
  label: string;
  seasonLabel: string;
  tagline: string;
  updatedAt: string | null;
  loading: boolean;
};

const FALLBACK: RewardPoolState = {
  totalKobo: REWARD_POOL.totalKobo,
  contributionPct: DEFAULT_REWARD_POOL_PCT,
  label: REWARD_POOL.label,
  seasonLabel: REWARD_POOL.seasonLabel,
  tagline: REWARD_POOL.tagline,
  updatedAt: null,
  loading: true,
};

function normalizePct(raw: unknown): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return DEFAULT_REWARD_POOL_PCT;
  return Math.min(100, Math.max(0, n));
}

/**
 * Module-wide shared subscription: the landing page mounts this in both
 * HomePage and the site header, which used to open 4 duplicate Firestore
 * listeners. Now one pair of listeners serves every subscriber and is torn
 * down only when the last subscriber unmounts.
 */
let sharedState: RewardPoolState = FALLBACK;
let pctRawShared: unknown = undefined;
let teardown: (() => void) | null = null;
const subscribers = new Set<() => void>();

function notify() {
  subscribers.forEach((fn) => fn());
}

function ensureSubscribed() {
  if (teardown) return;
  const unsubPool = onSnapshot(
    doc(db, "platformSettings", "rewardPool"),
    (snap) => {
      const d = snap.exists() ? (snap.data() as Record<string, unknown>) : undefined;
      sharedState = {
        totalKobo: d ? Number(d["totalKobo"] ?? 0) || 0 : FALLBACK.totalKobo,
        contributionPct: sharedState.contributionPct,
        label: d?.["label"] ? String(d["label"]) : FALLBACK.label,
        seasonLabel: d?.["seasonLabel"] ? String(d["seasonLabel"]) : FALLBACK.seasonLabel,
        tagline: d?.["tagline"] ? String(d["tagline"]) : FALLBACK.tagline,
        updatedAt: d?.["updatedAt"] ? String(d["updatedAt"]) : null,
        loading: false,
      };
      notify();
    },
    () => {
      sharedState = { ...sharedState, loading: false };
      notify();
    },
  );
  const unsubCfg = onSnapshot(
    doc(db, "platformSettings", "raffila_config"),
    (snap) => {
      const cfg = snap.exists() ? (snap.data() as Record<string, unknown>) : undefined;
      pctRawShared = (cfg?.["rewardPool"] as Record<string, unknown> | undefined)?.[
        "contributionPct"
      ];
      notify();
    },
    () => {
      pctRawShared = undefined;
      notify();
    },
  );
  teardown = () => {
    unsubPool();
    unsubCfg();
    teardown = null;
  };
}

function releaseIfIdle() {
  if (subscribers.size === 0 && teardown) teardown();
}

/**
 * Live reward-pool balance from Firestore (`platformSettings/rewardPool`),
 * with the admin-configured contribution rate from
 * `platformSettings/raffila_config.rewardPool.contributionPct`. Both docs are
 * public-read per firestore.rules, so this works signed-out (homepage) and
 * signed-in (dashboard) alike. Never throws — falls back to the static
 * defaults when the docs or listeners are unavailable.
 */
export function useRewardPool(): RewardPoolState {
  // Local state mirror so the first paint before any snapshot is correct.
  const [state, setState] = useState<RewardPoolState>(sharedState);

  useEffect(() => {
    ensureSubscribed();
    const subscriber = () => setState({ ...sharedState });
    subscribers.add(subscriber);
    // Snapshot may have arrived between render and effect.
    subscriber();
    return () => {
      subscribers.delete(subscriber);
      releaseIfIdle();
    };
  }, []);

  return { ...state, contributionPct: normalizePct(pctRawShared) };
}
