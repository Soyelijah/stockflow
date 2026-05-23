import admin from "firebase-admin";
import * as dotenv from "dotenv";

// Cargar variables de entorno desde .env.local en la raíz
dotenv.config({ path: ".env.local" });

// Inicializar la aplicación con las credenciales locales
if (!admin.apps.length) {
  const projectId = process.env.FIREBASE_PROJECT_ID || "workspace-mcp-493503";
  console.log(`ℹ️ Inicializando Firebase Admin para el proyecto: ${projectId}`);
  admin.initializeApp({
    projectId,
    credential: admin.credential.applicationDefault()
  });
}

const db = admin.firestore();

async function bootstrap() {
  const email = process.argv[2];
  
  if (!email) {
    console.error("❌ Por favor provee el correo del super administrador.");
    console.error("Uso: pnpm tsx scripts/bootstrap-admin.ts <correo>");
    process.exit(1);
  }

  try {
    console.log(`🔍 Buscando usuario con correo: ${email}...`);
    const userRecord = await admin.auth().getUserByEmail(email);
    
    console.log(`✅ Usuario encontrado (UID: ${userRecord.uid}). Promoviendo a 'owner'...`);
    
    // 1. Asignar Custom Claim 'owner'
    await admin.auth().setCustomUserClaims(userRecord.uid, { role: "owner" });
    
    // 2. Forzar documento de Firestore (Legacy/Redundancia)
    await db.collection("users").doc(userRecord.uid).set({
      role: "owner"
    }, { merge: true });

    // 3. Crear Log de Auditoría Bootstrapped
    const auditRef = db.collection("role_audit").doc();
    await auditRef.set({
      targetUid: userRecord.uid,
      assignedRole: "owner",
      assignedBy: "system_bootstrap",
      assignedByEmail: "system",
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log(`🎉 ¡Éxito! El usuario ${email} ahora es OWNER (Super Admin).`);
    console.log("👉 IMPORTANTE: El usuario debe cerrar sesión y volver a entrar para refrescar su token.");
    process.exit(0);

  } catch (err: any) {
    if (err.code === "auth/user-not-found") {
      console.error(`❌ El usuario ${email} no existe en Firebase Auth.`);
      console.error("Regístrate en la app primero, y luego vuelve a correr el script.");
    } else {
      console.error("❌ Error inesperado:", err);
    }
    process.exit(1);
  }
}

bootstrap();
