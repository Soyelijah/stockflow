import { adminDb } from "../server/services/firebaseAdmin";
import admin from "firebase-admin";

async function seed() {
  console.log("🌱 [Seed Driver Data] Starting mock driver and shipment setup...");
  const auth = admin.auth();
  const driverEmail = "driver@stockflow.cl";
  
  let driverUid = "";
  try {
    const userRecord = await auth.getUserByEmail(driverEmail);
    driverUid = userRecord.uid;
    console.log(`👤 Found existing driver user: ${driverEmail} (UID: ${driverUid})`);
  } catch (err: any) {
    if (err.code === "auth/user-not-found") {
      console.log(`ℹ️ Driver user ${driverEmail} does not exist. Creating...`);
      const newUser = await auth.createUser({
        email: driverEmail,
        emailVerified: true,
        password: "driverPassword123!",
        displayName: "Diego Ramos (Chofer)"
      });
      driverUid = newUser.uid;
      console.log(`🎉 Created driver auth user with UID: ${driverUid}`);
    } else {
      throw err;
    }
  }

  // 1. Set driver custom claim
  await auth.setCustomUserClaims(driverUid, { role: "driver" });
  console.log(`✅ Set custom claim 'role: "driver"' on Auth module`);

  // 2. Sync to users collection
  await adminDb.collection("users").doc(driverUid).set({
    uid: driverUid,
    email: driverEmail,
    name: "Diego Ramos (Chofer)",
    role: "driver",
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  }, { merge: true });
  console.log(`✅ Synced 'driver' role in Firestore users collection`);

  // 3. Create a mock shipment for this driver
  const shipmentId = `SHIP_MOCK_${Date.now()}`;
  const shipmentData = {
    id: shipmentId,
    orderId: "ORD-MOCK-9999",
    customerId: "cust_test_customer",
    customerName: "María Ignacia Prado",
    customerPhone: "+56 9 7654 3210",
    address: "Avenida Providencia 1205, Providencia, Santiago, Chile",
    lat: -33.426, // Providencia Coordinates
    lng: -70.612,
    status: "assigned", // 'assigned', 'in_route', 'preparing'
    assignedDriverId: driverUid,
    driverName: "Diego Ramos (Chofer)",
    driverPhone: "+56 9 1111 2222",
    items: [
      "3x Caja de Pisco Capel 1L",
      "1x Bebida Coca-Cola 3L",
      "2x Hielo Cubo 2kg"
    ],
    total: 35000,
    routeIndex: 1,
    currentLat: -33.4449, // Starts at Santiago Warehouse coords
    currentLng: -70.6562,
    locationSource: "gps",
    timestamp: new Date().toISOString()
  };

  await adminDb.collection("shipments").doc(shipmentId).set(shipmentData);
  console.log(`📦 Created mock shipment: ${shipmentId} (Order: ORD-MOCK-9999)`);
  console.log(`🔑 Login Credentials for driver:`);
  console.log(`   Email: ${driverEmail}`);
  console.log(`   Password: driverPassword123!`);
}

seed().then(() => process.exit(0)).catch(err => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});
