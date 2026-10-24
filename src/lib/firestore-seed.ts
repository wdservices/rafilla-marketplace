import { collection, doc, writeBatch, getDocs } from "firebase/firestore";
import { db } from "./firebase";
import { winnerCards, partners, REWARD_POOL } from "./raffila-data";

export interface SeedProgress {
  stage: string;
  count: number;
  total: number;
  completed: boolean;
  error?: string;
}

/** Fixed number of days before now, as an ISO stamp — used by the seed fixtures. */
function daysAgoIso(days: number): string {
  return new Date(Date.now() - days * 86400000).toISOString();
}

export const SEED_USERS = [
  {
    id: "usr_tunmise_adebayo_001",
    email: "tunmise.adebayo@raffila.com",
    displayName: "Tunmise Adebayo",
    handle: "tunmise_adebayo",
    role: "user",
    phone: "+234 801 234 5678",
    avatarMonogram: "TA",
    walletBalanceKobo: 5000000, // ₦50,000
    referralEarningsKobo: 1250000, // ₦12,500
    referralCode: "RAF-TUNMISE",
    verified: true,
    createdAt: new Date("2026-01-15T10:00:00Z").toISOString(),
  },
  {
    id: "usr_chioma_okeke_002",
    email: "chioma.okeke@raffila.com",
    displayName: "Chioma Okeke",
    handle: "chioma_okeke",
    role: "user",
    phone: "+234 802 987 6543",
    avatarMonogram: "CO",
    walletBalanceKobo: 8200000,
    referralEarningsKobo: 450000,
    referralCode: "RAF-CHIOMA",
    verified: true,
    createdAt: new Date("2026-02-01T12:00:00Z").toISOString(),
  },
  {
    id: "usr_emeka_nwosu_003",
    email: "emeka.nwosu@raffila.com",
    displayName: "Emeka Nwosu",
    handle: "emeka_nwosu",
    role: "user",
    phone: "+234 803 112 2334",
    avatarMonogram: "EN",
    walletBalanceKobo: 15000000,
    referralEarningsKobo: 2100000,
    referralCode: "RAF-EMEKA",
    verified: true,
    createdAt: new Date("2026-02-14T09:30:00Z").toISOString(),
  },
  {
    id: "usr_amina_bello_004",
    email: "amina.bello@raffila.com",
    displayName: "Amina Bello",
    handle: "amina_bello",
    role: "user",
    phone: "+234 805 443 3221",
    avatarMonogram: "AB",
    walletBalanceKobo: 3400000,
    referralEarningsKobo: 800000,
    referralCode: "RAF-AMINA",
    verified: true,
    createdAt: new Date("2026-03-01T14:15:00Z").toISOString(),
  },
  {
    id: "adm_aisha_ola_001",
    email: "admin@raffila.com",
    displayName: "Aisha Olamide",
    handle: "admin_aisha",
    role: "admin",
    phone: "+234 802 345 6789",
    avatarMonogram: "AO",
    walletBalanceKobo: 0,
    referralEarningsKobo: 0,
    referralCode: "RAF-ADMIN",
    verified: true,
    createdAt: new Date("2026-01-01T00:00:00Z").toISOString(),
  },
];

/**
 * Sample money payouts — covers every shape the payout queue handles (winner /
 * partner / referral × paid, pending, under review, processing, failed) with the
 * full audit trail: amount, recipient, why, when it was paid and by whom.
 * IDs are fixed so re-seeding updates instead of duplicating.
 */
export const SEED_PAYOUTS: Array<{
  id: string;
  type: "WINNER" | "PARTNER" | "REFERRAL";
  status: string;
  userId: string;
  userName: string;
  userEmail: string;
  amountKobo: number;
  reason: string;
  bank: string;
  accountNumber: string;
  accountName: string;
  createdAt: string;
  updatedAt: string;
  reviewedBy?: string;
  reviewedAt?: string;
  paidAt?: string;
  paidBy?: string;
  paidByName?: string;
  processedAt?: string;
  processedBy?: string;
  paymentReference?: string;
}> = [
  {
    id: "po_seed_winner_paid",
    type: "WINNER",
    status: "PAID",
    userId: "usr_tunmise_adebayo_001",
    userName: "Tunmise Adebayo",
    userEmail: "tunmise.adebayo@raffila.com",
    amountKobo: 25000000,
    reason: "Prize payout · iPhone 15 Pro Max",
    bank: "Guaranty Trust Bank",
    accountNumber: "0123456789",
    accountName: "TUNMISE ADEBAYO",
    createdAt: daysAgoIso(7),
    updatedAt: daysAgoIso(5),
    reviewedBy: "adm_aisha_ola_001",
    reviewedAt: daysAgoIso(6),
    paidAt: daysAgoIso(5),
    paidBy: "adm_aisha_ola_001",
    paidByName: "Aisha Olamide",
    processedAt: daysAgoIso(5),
    processedBy: "adm_aisha_ola_001",
    paymentReference: "TRF-20261014-8841",
  },
  {
    id: "po_seed_winner_pending",
    type: "WINNER",
    status: "PENDING",
    userId: "usr_chioma_okeke_002",
    userName: "Chioma Okeke",
    userEmail: "chioma.okeke@raffila.com",
    amountKobo: 15000000,
    reason: "Prize payout · Sony PlayStation 5",
    bank: "Access Bank",
    accountNumber: "0987654321",
    accountName: "CHIOMA OKEKE",
    createdAt: daysAgoIso(2),
    updatedAt: daysAgoIso(2),
  },
  {
    id: "po_seed_partner_review",
    type: "PARTNER",
    status: "UNDER_REVIEW",
    userId: "",
    userName: "Lagos Tech Hub",
    userEmail: "finance@lagostechhub.com",
    amountKobo: 8500000,
    reason: "Partner settlement · Monthly revenue share",
    bank: "Zenith Bank",
    accountNumber: "3019876543",
    accountName: "LAGOS TECH HUB LTD",
    createdAt: daysAgoIso(3),
    updatedAt: daysAgoIso(1),
  },
  {
    id: "po_seed_partner_processing",
    type: "PARTNER",
    status: "PROCESSING",
    userId: "",
    userName: "Sunrise Logistics",
    userEmail: "accounts@sunriselogistics.ng",
    amountKobo: 12000000,
    reason: "Partner settlement · Draw entry commissions",
    bank: "First Bank",
    accountNumber: "3021456789",
    accountName: "SUNRISE LOGISTICS",
    createdAt: daysAgoIso(4),
    updatedAt: daysAgoIso(4),
    reviewedBy: "adm_aisha_ola_001",
    reviewedAt: daysAgoIso(4),
    processedAt: daysAgoIso(4),
    processedBy: "adm_aisha_ola_001",
  },
  {
    id: "po_seed_referral_paid",
    type: "REFERRAL",
    status: "PAID",
    userId: "usr_emeka_nwosu_003",
    userName: "Emeka Nwosu",
    userEmail: "emeka.nwosu@raffila.com",
    amountKobo: 1250000,
    reason: "Level 1 referral commission",
    bank: "Guaranty Trust Bank",
    accountNumber: "0112233445",
    accountName: "EMEKA NWOSU",
    createdAt: daysAgoIso(8),
    updatedAt: daysAgoIso(3),
    reviewedBy: "adm_aisha_ola_001",
    reviewedAt: daysAgoIso(5),
    paidAt: daysAgoIso(3),
    paidBy: "adm_aisha_ola_001",
    paidByName: "Aisha Olamide",
    processedAt: daysAgoIso(3),
    processedBy: "adm_aisha_ola_001",
    paymentReference: "PSP-20261016-2231",
  },
  {
    id: "po_seed_referral_failed",
    type: "REFERRAL",
    status: "FAILED",
    userId: "usr_amina_bello_004",
    userName: "Amina Bello",
    userEmail: "amina.bello@raffila.com",
    amountKobo: 800000,
    reason: "Level 2 referral commission",
    bank: "United Bank for Africa",
    accountNumber: "0334455667",
    accountName: "AMINA BELLO",
    createdAt: daysAgoIso(6),
    updatedAt: daysAgoIso(4),
    reviewedBy: "adm_aisha_ola_001",
    reviewedAt: daysAgoIso(4),
    processedAt: daysAgoIso(4),
    processedBy: "adm_aisha_ola_001",
    paymentReference: "TRF-20261015-1174",
  },
];

export async function seedFirestoreDatabase(
  onProgress?: (progress: SeedProgress) => void,
): Promise<{ success: boolean; stats: Record<string, number>; error?: string }> {
  const stats: Record<string, number> = {
    competitions: 0,
    draws: 0,
    tickets: 0,
    users: 0,
    winners: 0,
    payouts: 0,
    partners: 0,
    platformSettings: 0,
  };

  try {
    // 1. Seed Platform Settings
    onProgress?.({
      stage: "Platform Settings & Community Pool",
      count: 0,
      total: 1,
      completed: false,
    });
    const poolBatch = writeBatch(db);
    // Merge only the labels — never totalKobo, or re-seeding would wipe the
    // live balance that ticket purchases have accrued.
    poolBatch.set(
      doc(db, "platformSettings", "rewardPool"),
      {
        label: REWARD_POOL.label,
        seasonLabel: REWARD_POOL.seasonLabel,
        tagline: REWARD_POOL.tagline,
        updatedAt: new Date().toISOString(),
      },
      { merge: true },
    );
    await poolBatch.commit();
    stats.platformSettings = 1;

    // 2. Seed Users
    onProgress?.({
      stage: "User Accounts & Profiles",
      count: 0,
      total: SEED_USERS.length,
      completed: false,
    });
    const userBatch = writeBatch(db);
    for (const u of SEED_USERS) {
      userBatch.set(doc(db, "users", u.id), u);
      stats.users++;
    }
    await userBatch.commit();

    // 3. Seed Partners
    onProgress?.({
      stage: "Partner Organizations",
      count: 0,
      total: partners.length,
      completed: false,
    });
    const partnerBatch = writeBatch(db);
    for (const p of partners) {
      const partnerDocId = p.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      partnerBatch.set(doc(db, "partner_profiles", partnerDocId), {
        businessName: p,
        verificationStatus: "APPROVED",
        createdAt: new Date().toISOString(),
      });
      stats.partners++;
    }
    await partnerBatch.commit();

    // 4. Competitions are NOT seeded.
    // There is no hardcoded catalogue any more: a competition exists only if an
    // operator created it in the admin dashboard. Seeding fixtures here is what
    // made deleted competitions reappear, so this step is intentionally absent.

    // 5. Seed Past Winners
    onProgress?.({
      stage: "Verified Past Winners",
      count: 0,
      total: winnerCards.length,
      completed: false,
    });
    const winnerBatch = writeBatch(db);
    for (let w = 0; w < winnerCards.length; w++) {
      const win = winnerCards[w];
      const winRef = doc(db, "winners", win.id || `winner-${w + 1}`);
      const createdAt = new Date().toISOString();
      // Alternate received / outstanding so both fulfillment states are visible.
      const received = w % 2 === 0;
      winnerBatch.set(winRef, {
        id: win.id || `winner-${w + 1}`,
        competitionTitle: win.competition,
        winnerName: win.winnerName,
        prize: win.prize,
        location: win.location,
        drawDate: win.drawDate,
        amount: win.amount,
        claimStatus: received ? "DISBURSED" : "PENDING_CLAIM",
        verified: true,
        createdAt,
        // Prize handover tracking (@/lib/payout-tracking)
        fulfillmentStatus: received ? "RECEIVED" : "PENDING_CLAIM",
        ...(received
          ? {
              receivedAt: createdAt,
              receivedBy: "adm_aisha_ola_001",
              receivedByName: "Aisha Olamide",
              deliveryMethod: "COURIER",
              fulfillmentNote: "Prize handed over and confirmed by the winner.",
            }
          : {}),
        fulfillmentUpdatedAt: createdAt,
        fulfillmentUpdatedBy: "adm_aisha_ola_001",
      });
      stats.winners++;
    }
    await winnerBatch.commit();

    // 6. Sample payouts — "how much, to whom, when, and why". The payouts
    // collection rejects client writes by design, so prefer the Admin SDK and
    // fall back to the signed-in admin session (needs open rules while seeding).
    onProgress?.({
      stage: "Payout & Fulfillment Records",
      count: 0,
      total: SEED_PAYOUTS.length,
      completed: false,
    });
    let seededPayouts = 0;
    try {
      const { getAdminDb } = await import("./firebase-admin");
      const adminDb = getAdminDb();
      for (const p of SEED_PAYOUTS) {
        await adminDb.collection("payouts").doc(p.id).set(p, { merge: true });
        seededPayouts++;
      }
    } catch (adminErr) {
      try {
        const payoutBatch = writeBatch(db);
        for (const p of SEED_PAYOUTS) {
          payoutBatch.set(doc(db, "payouts", p.id), p, { merge: true });
          seededPayouts++;
        }
        await payoutBatch.commit();
      } catch (clientErr) {
        const msg = (clientErr as Error)?.message || String(clientErr);
        seededPayouts = 0;
        console.warn(
          `[SEED] Sample payouts skipped — ${msg}. ` +
            `Admin SDK: ${(adminErr as Error)?.message || "unavailable"}. ` +
            "Add FIREBASE_SERVICE_ACCOUNT_JSON to .env, or temporarily open Firestore rules while seeding.",
        );
      }
    }
    stats["payouts"] = seededPayouts;

    onProgress?.({
      stage: "Database Seeding Completed Successfully!",
      count: winnerCards.length,
      total: winnerCards.length,
      completed: true,
    });

    return { success: true, stats };
  } catch (err: any) {
    const errorMsg = err?.message || String(err);
    onProgress?.({
      stage: "Error seeding database",
      count: 0,
      total: 0,
      completed: false,
      error: errorMsg,
    });
    return { success: false, stats, error: errorMsg };
  }
}

export async function checkFirestoreStatus(): Promise<{
  connected: boolean;
  competitionsCount: number;
  usersCount: number;
  drawsCount: number;
  error?: string;
}> {
  try {
    const [compSnap, userSnap, drawSnap] = await Promise.all([
      getDocs(collection(db, "competitions")),
      getDocs(collection(db, "users")),
      getDocs(collection(db, "draws")),
    ]);

    return {
      connected: true,
      competitionsCount: compSnap.size,
      usersCount: userSnap.size,
      drawsCount: drawSnap.size,
    };
  } catch (err: any) {
    return {
      connected: false,
      competitionsCount: 0,
      usersCount: 0,
      drawsCount: 0,
      error: err?.message || String(err),
    };
  }
}
