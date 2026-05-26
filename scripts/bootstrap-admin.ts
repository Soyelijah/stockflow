// Bootstrap the first owner of a fresh StockFlow deployment.
//
// Usage:
//   GOOGLE_APPLICATION_CREDENTIALS=./serviceAccountKey.json \
//     pnpm tsx scripts/bootstrap-admin.ts <email> [name]
//
// Behaviour:
//   - If the email already exists in Firebase Auth: sets role=owner, branchId=*
//     custom claim, mirrors to /users/{uid}, writes /role_audit entry.
//   - If the email does NOT exist: generates a strong random password, creates
//     the Auth user, applies the same claim + mirror, and prints the password
//     ONCE to stdout. The operator is expected to copy it immediately, login,
//     and change it. The password is not stored anywhere else.
//
// Security:
//   - No email or password is hardcoded.
//   - The owner role is the only privilege bootstrap path that bypasses
//     setUserRole's "admin/owner required" check (see functions/src/index.ts).
//     Once an owner exists, all other roles must be assigned via setUserRole
//     (cloud function with caller-auth check + role_audit logging).

import * as crypto from "crypto";
import { adminDb } from "../server/services/firebaseAdmin";
import { getAuth } from "firebase-admin/auth";
import { FieldValue } from "firebase-admin/firestore";

function usage(): never {
  console.error("Usage: pnpm tsx scripts/bootstrap-admin.ts <email> [display-name]");
  console.error("");
  console.error("  <email>         The Google account / email that should become the first owner.");
  console.error("  [display-name]  Optional display name. Defaults to the email's local part.");
  console.error("");
  console.error("Requires GOOGLE_APPLICATION_CREDENTIALS env var pointing to a service account JSON.");
  process.exit(2);
}

function generateStrongPassword(): string {
  // 20 chars, URL-safe base64, ~119 bits of entropy.
  return crypto.randomBytes(15).toString("base64url");
}

function isValidEmail(s: string): boolean {
  return /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/.test(s);
}

async function bootstrap() {
  const email = process.argv[2];
  const displayName = process.argv[3] || (email ? email.split("@")[0] : "");

  if (!email) usage();
  if (!isValidEmail(email)) {
    console.error(`❌ Invalid email format: ${email}`);
    process.exit(2);
  }

  const normalizedEmail = email.trim().toLowerCase();
  const auth = getAuth();

  console.log(`🚀 [Bootstrap Admin] Provisioning owner for ${normalizedEmail} ...`);

  let userRecord;
  let generatedPassword: string | null = null;

  try {
    userRecord = await auth.getUserByEmail(normalizedEmail);
    console.log(`👤 Existing Auth user uid=${userRecord.uid}`);
  } catch (err: any) {
    if (err.code !== "auth/user-not-found") {
      console.error(`❌ Auth lookup failed: ${err.message}`);
      process.exit(1);
    }
    generatedPassword = generateStrongPassword();
    console.log(`ℹ️ Auth user does not exist. Creating with a generated strong password.`);
    userRecord = await auth.createUser({
      email: normalizedEmail,
      emailVerified: true,
      password: generatedPassword,
      displayName,
    });
    console.log(`✅ Created Auth user uid=${userRecord.uid}`);
  }

  // 1. Custom claim — authoritative source for rules + Cloud Function checks.
  await auth.setCustomUserClaims(userRecord.uid, { role: "owner", branchId: "*" });
  console.log(`✅ Custom claim set: { role: "owner", branchId: "*" }`);

  // 2. Mirror to /users/{uid} for UI display.
  await adminDb.collection("users").doc(userRecord.uid).set(
    {
      uid: userRecord.uid,
      email: normalizedEmail,
      name: displayName,
      role: "owner",
      branchId: "*",
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
  console.log(`✅ /users/${userRecord.uid} mirror written`);

  // 3. Audit log entry (matches setUserRole's audit contract).
  await adminDb.collection("role_audit").add({
    action: "OWNER_BOOTSTRAPPED",
    targetUserId: userRecord.uid,
    newRole: "owner",
    newBranchId: "*",
    operatorUid: "bootstrap-script",
    operatorEmail: "bootstrap-script@stockflow.system",
    operatorRole: "bootstrap-script",
    timestamp: FieldValue.serverTimestamp(),
  });
  console.log(`✅ /role_audit entry written`);

  console.log("");
  console.log("🏁 Done.");
  console.log("");
  if (generatedPassword) {
    console.log("⚠️  TEMPORARY PASSWORD (copy NOW, will not be shown again):");
    console.log("");
    console.log(`    ${generatedPassword}`);
    console.log("");
    console.log("    Login and change it immediately at https://<your-app>/login");
  } else {
    console.log("ℹ️  Existing user — password unchanged. Login with the credentials you already had.");
  }
  console.log("");
  console.log("⚠️  The user must log out + log back in to refresh their token claims.");
}

bootstrap()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("❌ Fatal:", err.message || err);
    process.exit(1);
  });
