import { adminDb } from "../server/services/firebaseAdmin";
import admin from "firebase-admin";

async function bootstrap() {
  console.log("🚀 [Bootstrap Admin] Starting user role setup and claim provisioning...");
  
  const targetEmail = "solier.elijah@gmail.com"; // Principal operator email inside additional metadata
  const fallbackEmail = "admin@stockflow.com";
  
  const auth = admin.auth();
  
  for (const email of [targetEmail, fallbackEmail]) {
    try {
      const userRecord = await auth.getUserByEmail(email);
      console.log(`👤 Found user with email: ${email} (UID: ${userRecord.uid})`);
      
      // 1. Set admin/owner custom claims so they bypass client role checks
      await auth.setCustomUserClaims(userRecord.uid, { role: "owner" });
      console.log(`✅ Set custom claim 'role: "owner"' on Auth module for ${email}`);
      
      // 2. Synced Firestore document to user collection using targeted adminDb
      const userDocRef = adminDb.collection("users").doc(userRecord.uid);
      await userDocRef.set({
        uid: userRecord.uid,
        email: email,
        name: email === targetEmail ? "Elijah Solier" : "Administrador",
        role: "owner",
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
      
      console.log(`✅ Synced 'owner' role inside Firestore users collection for ${email}`);
    } catch (err: any) {
      if (err.code === "auth/user-not-found") {
        console.log(`ℹ️ User ${email} does not exist in Firebase Auth yet. Creating mock/placeholder document...`);
        try {
          const newUser = await auth.createUser({
            email,
            emailVerified: true,
            password: "defaultAdminPassword123!",
            displayName: email === targetEmail ? "Elijah Solier" : "Administrador Principal"
          });
          
          await auth.setCustomUserClaims(newUser.uid, { role: "owner" });
          
          const userDocRef = adminDb.collection("users").doc(newUser.uid);
          await userDocRef.set({
            uid: newUser.uid,
            email: email,
            name: email === targetEmail ? "Elijah Solier" : "Administrador",
            role: "owner",
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          }, { merge: true });
          
          console.log(`🎉 Successfully created user ${email} with password and set 'owner' claims!`);
        } catch (createErr: any) {
          console.error(`❌ Failed to automatically create user ${email}:`, createErr.message);
        }
      } else {
        console.error(`❌ Unexpected error booting user ${email}:`, err.message);
      }
    }
  }
}

bootstrap()
  .then(() => {
    console.log("🏁 [Bootstrap Admin] Finished bootstrap script.");
    process.exit(0);
  })
  .catch((err) => {
    console.error("❌ Fatal Bootstrap Admin failure:", err);
    process.exit(1);
  });
