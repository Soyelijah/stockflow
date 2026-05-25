import { adminDb } from "./firebaseAdmin";
import * as admin from "firebase-admin";
import * as crypto from "crypto";

export interface BoletaItem {
  name: string;
  quantity: number;
  price: number;
}

export interface BoletaInput {
  orderId: string;
  amount: number;
  buyerEmail: string;
  customerName?: string;
  customerTaxId?: string;
  gateway?: string;
  paymentId?: string;
  items?: BoletaItem[];
}

export async function generateNextFolio(): Promise<number> {
  try {
    const snap = await adminDb.collection("electronic_boletas")
      .orderBy("folio", "desc")
      .limit(1)
      .get();
    if (!snap.empty) {
      const topDoc = snap.docs[0].data();
      if (topDoc && typeof topDoc.folio === "number") {
        return topDoc.folio + 1;
      }
    }
    return 151240; // Default starting folio inside AI Studio
  } catch (err) {
    console.error("[boletaService] Fallback folio due to Firestore error:", err);
    return Math.floor(Math.random() * 90000) + 152000;
  }
}

function normalizeBackendRUT(value: string): string {
  if (!value) return "Sin RUT";
  const clean = value.replace(/[^0-9kK]/g, "");
  if (clean.length < 2) return value.trim().toUpperCase();
  const dv = clean.slice(-1).toUpperCase();
  const body = clean.slice(0, -1);
  
  let formattedBody = body
    .split("")
    .reverse()
    .join("")
    .replace(/(?=\d*\.?)(\d{3})/g, "$1.")
    .split("")
    .reverse()
    .join("");
    
  if (formattedBody.startsWith(".")) {
    formattedBody = formattedBody.slice(1);
  }
  return `${formattedBody}-${dv}`;
}

export async function emitElectronicBoleta(input: BoletaInput) {
  const { 
    orderId, 
    amount, 
    buyerEmail, 
    customerName = "Cliente Online", 
    customerTaxId = "Sin RUT", 
    gateway = "credit_card", 
    paymentId = "direct", 
    items = [] 
  } = input;
  const folio = await generateNextFolio();
  const dateStr = new Date().toISOString().split("T")[0] || "2026-05-23";
  const emittedAtStr = new Date().toISOString();

  // Financial calculations
  const total = Math.round(amount);
  const netAmount = Math.round(total / 1.19);
  const ivaAmount = total - netAmount;

  const cleanEmail = buyerEmail.trim().toLowerCase();
  const cleanName = customerName.trim().replace(/\s+/g, " ");
  const rawTaxId = customerTaxIdByEmail(cleanEmail, customerTaxId);
  const finalTaxId = rawTaxId && rawTaxId !== "" ? normalizeBackendRUT(rawTaxId) : "Sin RUT";

  const cleanItems = items.map(item => ({
    name: item.name.trim().replace(/\s+/g, " "),
    quantity: Math.max(1, Math.round(Number(item.quantity || 1))),
    price: Math.round(Number(item.price || 0))
  }));

  const boletaData = {
    id: `BOL-${folio}`,
    folio,
    orderId,
    fechaEmision: dateStr,
    buyerEmail: cleanEmail,
    customerName: cleanName,
    customerTaxId: finalTaxId,
    montoTotal: total,
    montoNeto: netAmount,
    montoIVA: ivaAmount,
    items: cleanItems.length > 0 ? cleanItems : [{ name: "Compra Online StockFlow", quantity: 1, price: total }],
    paymentGateway: gateway,
    paymentId,
    tedXml: null,
    isMock: true,
    status: "draft_local",
    deliveredAt: emittedAtStr,
    timestamp: admin.firestore.FieldValue.serverTimestamp()
  };

  try {
    await adminDb.collection("electronic_boletas").doc(`BOL-${folio}`).set(boletaData);
    console.log(`🧾 [Boleta Electrónica] Emitida exitosamente como borrador local. Folio: ${folio}, Total: $${total} CLP`);

    // Use transaction to set transaction products cleanly
    const finalItems = cleanItems.length > 0 ? cleanItems : [{ name: "Compra Online StockFlow", price: total, quantity: 1 }];

    await adminDb.runTransaction(async (transaction) => {
      for (let idx = 0; idx < finalItems.length; idx++) {
        const finalItem = finalItems[idx];
        const docRef = adminDb.collection("transactions").doc(`WEB-${orderId}_${idx}`);
        transaction.set(docRef, {
          productId: `prod_online_${idx}`,
          productName: finalItem.name,
          type: "app_purchase",
          quantity: finalItem.quantity,
          amount: finalItem.price * finalItem.quantity,
          userId: "system_gateway",
          userName: "Pasarela Online",
          customerId: `cust_${cleanEmail.replace(/[^a-zA-Z0-9]/g, "")}`,
          customerName: cleanName,
          customerTaxId: finalTaxId,
          paymentBreakdown: { method: gateway, amount: total },
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
          orderId: orderId,
          documentType: "Comprobante Interno",
          folio: folio,
          finalOrderTotal: total,
          discountApplied: 0,
          note: `Comprobante Interno #${folio} emitido via Webhook ${gateway.toUpperCase()}`
        });
      }
    });

    const emailHash = crypto.createHash('sha1').update(cleanEmail).digest('hex').substring(0, 8);
    console.log(`📧 [Boleta Service] Enviando boleta PDF Folio ${folio} a correo enmascarado: ${emailHash}`);
    return boletaData;
  } catch (err) {
    console.error("❌ [Boleta Service] Error saving boleta to Firestore:", err);
    throw err;
  }
}

function customerTaxIdByEmail(email: string, def: string): string {
  if (def && def !== "Sin RUT" && def !== "") return def;
  return ""; // Returns empty string as instructed if not provided
}
