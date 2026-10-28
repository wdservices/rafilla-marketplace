import { signInWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../src/lib/firebase";

// Usage:
//   $env:SEED_STAFF_EMAIL="staff@raffila.com"; $env:SEED_STAFF_PASSWORD="secret"; $env:SEED_STAFF_FIRST_NAME="John"; $env:SEED_STAFF_LAST_NAME="Doe"; npm run seed:staff
async function main() {
  console.log("--------------------------------------------------");
  console.log("Raffila Staff Seeder");
  console.log("--------------------------------------------------");

  const email = process.env.SEED_STAFF_EMAIL?.trim();
  const password = process.env.SEED_STAFF_PASSWORD ?? "";
  const firstName = process.env.SEED_STAFF_FIRST_NAME ?? "Staff";
  const lastName = process.env.SEED_STAFF_LAST_NAME ?? "Member";

  if (!email || !password) {
    console.error("Missing credentials. Set SEED_STAFF_EMAIL and SEED_STAFF_PASSWORD first.");
    console.error(
      'Example: $env:SEED_STAFF_EMAIL="staff@raffila.com"; $env:SEED_STAFF_PASSWORD="secret"; $env:SEED_STAFF_FIRST_NAME="John"; $env:SEED_STAFF_LAST_NAME="Doe"; npm run seed:staff',
    );
    process.exit(1);
  }

  const cred = await signInWithEmailAndPassword(auth, email, password);
  const uid = cred.user.uid;
  console.log(`[AUTH] Authenticated as ${cred.user.email} (UID: ${uid})`);

  const handle = `${firstName.toLowerCase().replace(/\s+/g, "_")}_${lastName.toLowerCase().replace(/\s+/g, "_")}`;
  const monogram = (firstName.slice(0, 1) + lastName.slice(0, 1)).toUpperCase();

  await setDoc(
    doc(db, "users", uid),
    {
      email,
      firstName,
      lastName,
      displayName: `${firstName} ${lastName}`,
      handle,
      avatarMonogram: monogram,
      phone: "",
      address: "",
      dob: "",
      role: "staff",
      isAdmin: false,
      verified: true,
      referralCode: `RAF-${monogram}`,
      walletBalanceKobo: 0,
      referralEarningsKobo: 0,
      updatedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
    },
    { merge: true },
  );

  console.log(`[SEED] users/${uid} upserted with role "staff".`);
  console.log("Done. Log in with the staff email to reach /crm.");
  process.exit(0);
}

main().catch((err) => {
  console.error("Fatal seed error:", err?.message || err);
  process.exit(1);
});
