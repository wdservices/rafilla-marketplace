/**
 * One-off backfill: sets platformSettings/rewardPool.totalKobo to the
 * configured percentage of all historical entry revenue (the sum of every
 * CONFIRMED user entry's amountKobo), so purchases made before the reward
 * pool was wired up finally show in the pool.
 *
 * Idempotent: computes target = pct% of all-time entry revenue and only ever
 * RAISES the stored balance to that target (never lowers it), so live
 * accruals that land while the script runs are never wiped. Re-running is
 * safe.
 *
 * Run: npx vite-node scripts/backfill-reward-pool.ts
 */
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadDotEnv(): void {
  try {
    const raw = readFileSync(resolve(process.cwd(), ".env"), "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/);
      if (!m) continue;
      let v = m[2].trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1);
      }
      if (!(m[1] in process.env)) process.env[m[1]] = v;
    }
  } catch {
    // No .env on disk — rely on ambient environment variables.
  }
}

function initAdmin() {
  if (getApps().length > 0) return getFirestore();
  const rawJson = (process.env["FIREBASE_SERVICE_ACCOUNT_JSON"] || "").trim();
  if (rawJson) {
    const p = JSON.parse(rawJson) as Record<string, unknown>;
    return getFirestore(
      initializeApp({
        credential: cert({
          projectId: String(p["project_id"]),
          clientEmail: String(p["client_email"]),
          privateKey: String(p["private_key"]).replace(/\\n/g, "\n"),
        }),
      }),
    );
  }
  const projectId = (process.env["FIREBASE_ADMIN_PROJECT_ID"] || "").trim();
  const clientEmail = (process.env["FIREBASE_ADMIN_CLIENT_EMAIL"] || "").trim();
  const privateKey = (process.env["FIREBASE_ADMIN_PRIVATE_KEY"] || "").trim().replace(/\\n/g, "\n");
  if (!projectId || !clientEmail || !privateKey) {
    throw new Error("Firebase Admin credentials are not set (.env / environment).");
  }
  return getFirestore(initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) }));
}

const DEFAULT_PCT = 5;

async function main() {
  loadDotEnv();
  const db = initAdmin();

  const configSnap = await db.collection("platformSettings").doc("raffila_config").get();
  const cfg = configSnap.data() ?? {};
  const pctRaw = Number(
    (cfg["rewardPool"] as Record<string, unknown> | undefined)?.["contributionPct"] ?? DEFAULT_PCT,
  );
  const pct = Number.isFinite(pctRaw) ? Math.min(100, Math.max(0, pctRaw)) : DEFAULT_PCT;

  let revenueKobo = 0;
  let entryDocs = 0;
  const users = await db.collection("users").listDocuments();
  for (const userRef of users) {
    const entries = await userRef.collection("entries").select("amountKobo", "status").get();
    for (const e of entries.docs) {
      const d = e.data() as Record<string, unknown>;
      if (String(d["status"] ?? "").toUpperCase() !== "CONFIRMED") continue;
      revenueKobo += Number(d["amountKobo"] ?? 0) || 0;
      entryDocs += 1;
    }
  }

  const targetKobo = Math.round((revenueKobo * pct) / 100);
  const poolRef = db.collection("platformSettings").doc("rewardPool");
  const poolSnap = await poolRef.get();
  const currentKobo = Number((poolSnap.data() ?? {})["totalKobo"] ?? 0) || 0;

  console.log(`users scanned:            ${users.length}`);
  console.log(`confirmed entry docs:     ${entryDocs}`);
  console.log(
    `all-time entry revenue:   ₦${(revenueKobo / 100).toLocaleString("en-NG")} (${revenueKobo.toLocaleString("en-NG")} kobo)`,
  );
  console.log(`contribution rate:        ${pct}%`);
  console.log(`target pool:              ₦${(targetKobo / 100).toLocaleString("en-NG")}`);
  console.log(`current pool:             ₦${(currentKobo / 100).toLocaleString("en-NG")}`);

  if (targetKobo <= currentKobo) {
    console.log("Pool already at/above target — no change (idempotent).");
    return;
  }

  await poolRef.set(
    {
      totalKobo: targetKobo,
      backfilledAt: new Date().toISOString(),
      backfillRevenueKobo: revenueKobo,
      backfillContributionPct: pct,
      label: "Current reward pool",
      seasonLabel: "Community reward pool",
      tagline: "Live · Funded by entries",
      updatedAt: new Date().toISOString(),
    },
    { merge: true },
  );
  console.log(`Backfilled pool to ₦${(targetKobo / 100).toLocaleString("en-NG")}.`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Backfill failed:", err?.message || err);
    process.exit(1);
  });
