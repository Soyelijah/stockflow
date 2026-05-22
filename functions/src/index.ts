import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { initializeApp } from "firebase-admin/app";

initializeApp();

const db = getFirestore();

export const onProductStockChange = onDocumentWritten("products/{productId}", async (event) => {
  const productId = event.params.productId;
  const snapshot = event.data;
  
  if (!snapshot) {
    // Document deleted
    try {
      await db.collection("notifications").doc(productId).delete();
    } catch (err) {
      console.error("Error deleting notification:", err);
    }
    return;
  }

  const data = snapshot.after.data();
  if (!data) {
    // Document deleted
    try {
      await db.collection("notifications").doc(productId).delete();
    } catch (err) {
      console.error("Error deleting notification:", err);
    }
    return;
  }

  const stock = Number(data.stock) || 0;
  const minThreshold = Number(data.minThreshold) || 0;
  const name = data.name || "Producto";

  if (stock <= minThreshold) {
    try {
      await db.collection("notifications").doc(productId).set({
        type: "warning",
        title: "Stock Bajo",
        message: `El producto "${name}" tiene stock bajo (${stock} unidades).`,
        productId: productId,
        updatedAt: FieldValue.serverTimestamp()
      });
    } catch (err) {
      console.error("Error writing low-stock notification:", err);
    }
  } else {
    try {
      await db.collection("notifications").doc(productId).delete();
    } catch (err) {
      console.error("Error deleting notification:", err);
    }
  }
});
