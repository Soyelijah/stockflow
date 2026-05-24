"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.onUserRoleChanged = exports.onClaimResolved = exports.onProductStockChange = exports.setUserRole = void 0;
const firestore_1 = require("firebase-functions/v2/firestore");
const https_1 = require("firebase-functions/v2/https");
const firestore_2 = require("firebase-admin/firestore");
const auth_1 = require("firebase-admin/auth");
const app_1 = require("firebase-admin/app");
const firebaseConfig = __importStar(require("../firebase-applet-config.json"));
const app = (0, app_1.initializeApp)();
const db = (0, firestore_2.getFirestore)(app, firebaseConfig.firestoreDatabaseId);
// 1. HTTP Callable para definir roles (Custom Claims y DB Sync)
exports.setUserRole = (0, https_1.onCall)(async (request) => {
    const { userId, role } = request.data || {};
    if (!userId || !role) {
        throw new https_1.HttpsError("invalid-argument", "userId y role son requeridos.");
    }
    const validRoles = ["admin", "manager", "seller", "logistics", "driver"];
    if (!validRoles.includes(role)) {
        throw new https_1.HttpsError("invalid-argument", "Rol inválido.");
    }
    try {
        // 1. Establecer Custom Claims
        await (0, auth_1.getAuth)().setCustomUserClaims(userId, { role });
        // 2. Actualizar documento de usuario en Firestore
        await db.collection("users").doc(userId).set({
            role: role,
            updatedAt: firestore_2.FieldValue.serverTimestamp()
        }, { merge: true });
        return { success: true, message: `Rol ${role} asignado al usuario ${userId}.` };
    }
    catch (error) {
        console.error("Error en setUserRole:", error);
        throw new https_1.HttpsError("internal", error.message || "Error al asignar rol.");
    }
});
// 2. Firestore Trigger para cambios de stock (Throttled/Batched to prevent excessive writes)
exports.onProductStockChange = (0, firestore_1.onDocumentWritten)("products/{productId}", async (event) => {
    const productId = event.params.productId;
    const snapshot = event.data;
    // We group updates under a central buffer document to avoid excessive individual document writes.
    const batchRef = db.collection("notifications_buffer").doc("low_stock_batch");
    if (!snapshot) {
        // Product deleted: remove from low stock batch Map in transaction
        try {
            await db.runTransaction(async (transaction) => {
                const docSnap = await transaction.get(batchRef);
                if (docSnap.exists) {
                    const items = docSnap.data()?.items || {};
                    if (items[productId]) {
                        delete items[productId];
                        transaction.set(batchRef, { items, updatedAt: firestore_2.FieldValue.serverTimestamp() }, { merge: true });
                    }
                }
            });
        }
        catch (err) {
            console.error("Error setting deleted product in batch queue:", err);
        }
        return;
    }
    const data = snapshot.after.data();
    if (!data) {
        // Product cleared: remove from low stock batch
        try {
            await db.runTransaction(async (transaction) => {
                const docSnap = await transaction.get(batchRef);
                if (docSnap.exists) {
                    const items = docSnap.data()?.items || {};
                    if (items[productId]) {
                        delete items[productId];
                        transaction.set(batchRef, { items, updatedAt: firestore_2.FieldValue.serverTimestamp() }, { merge: true });
                    }
                }
            });
        }
        catch (err) {
            console.error("Error setting cleared product in batch:", err);
        }
        return;
    }
    const stock = Number(data.stock) || 0;
    const minThreshold = Number(data.minThreshold) || 0;
    const name = data.name || "Producto";
    if (stock <= minThreshold) {
        // Add product to consolidated low stock Map inside the single buffer document via transaction
        try {
            await db.runTransaction(async (transaction) => {
                const docSnap = await transaction.get(batchRef);
                const currentItems = docSnap.exists ? (docSnap.data()?.items || {}) : {};
                currentItems[productId] = {
                    name,
                    stock,
                    minThreshold,
                    updatedAt: new Date().toISOString()
                };
                transaction.set(batchRef, {
                    items: currentItems,
                    lastUpdatedProductId: productId,
                    updatedAt: firestore_2.FieldValue.serverTimestamp()
                }, { merge: true });
            });
            // Throttle client notification: check if a consolidated alert was written in client_notifications recently
            const lastNotifRef = db.collection("client_notifications").doc("low-stock-consolidated-alerts");
            await db.runTransaction(async (transaction) => {
                const notifSnap = await transaction.get(lastNotifRef);
                let lastWriteTime = 0;
                if (notifSnap.exists) {
                    const ts = notifSnap.data()?.timestamp;
                    if (ts) {
                        lastWriteTime = ts.toDate ? ts.toDate().getTime() : new Date(ts).getTime();
                    }
                }
                const now = Date.now();
                // If an alert was updated within the last 10 seconds, skip writing to avoid excessive writes
                if (now - lastWriteTime > 10000) {
                    transaction.set(lastNotifRef, {
                        title: "Alerta de Stock Crítico",
                        message: `Se han detectado productos con stock crítico en bodega (Último: "${name}" con ${stock} un.). Por favor revise el panel de Stock Crítico.`,
                        type: "alert",
                        link: "inventory",
                        timestamp: firestore_2.FieldValue.serverTimestamp(),
                        isConsolidated: true
                    });
                }
            });
        }
        catch (err) {
            console.error("Error bundling low stock notification:", err);
        }
    }
    else {
        // Stock is healthy: remove from batch map if present
        try {
            await db.runTransaction(async (transaction) => {
                const docSnap = await transaction.get(batchRef);
                if (docSnap.exists) {
                    const currentItems = docSnap.data()?.items || {};
                    if (currentItems[productId]) {
                        delete currentItems[productId];
                        transaction.set(batchRef, {
                            items: currentItems,
                            updatedAt: firestore_2.FieldValue.serverTimestamp()
                        }, { merge: true });
                    }
                }
            });
        }
        catch (err) {
            console.error("Error removing healthy product from batch:", err);
        }
    }
});
// 3. Firestore Trigger for claims resolution
exports.onClaimResolved = (0, firestore_1.onDocumentUpdated)("claims/{claimId}", async (event) => {
    const claimId = event.params.claimId;
    const snapshot = event.data;
    if (!snapshot)
        return;
    const beforeData = snapshot.before.data();
    const afterData = snapshot.after.data();
    if (!beforeData || !afterData)
        return;
    // Si el campo status cambia a "resolved"
    if (beforeData.status !== "resolved" && afterData.status === "resolved") {
        const customerId = afterData.customerId;
        if (!customerId) {
            console.warn("No customerId found on resolved claim", claimId);
            return;
        }
        try {
            await db.collection("notifications").doc(`${customerId}_claim_${claimId}`).set({
                type: "claim_resolved",
                title: "Reclamo Resuelto",
                message: `Tu reclamo con código #${claimId} ha sido resuelto por soporte.`,
                claimId: claimId,
                customerId: customerId,
                resolvedAt: firestore_2.FieldValue.serverTimestamp(),
                read: false
            });
            console.log(`Notification created for resolved claim: ${claimId} and customer: ${customerId}`);
        }
        catch (err) {
            console.error("Error creating claim resolution notification:", err);
        }
    }
});
// 4. Firestore Trigger for User Role or status changes (Audit real-time Auth block)
exports.onUserRoleChanged = (0, firestore_1.onDocumentUpdated)("users/{userId}", async (event) => {
    const userId = event.params.userId;
    const snapshot = event.data;
    if (!snapshot)
        return;
    const beforeData = snapshot.before.data();
    const afterData = snapshot.after.data();
    if (!beforeData || !afterData)
        return;
    const oldRole = beforeData.role;
    const newRole = afterData.role;
    const oldDisabled = beforeData.disabled || false;
    const newDisabled = afterData.disabled || false;
    // Trigger if role is demoted to customer OR disabled becomes true
    const roleDemotedToCustomer = (oldRole && oldRole !== "customer" && newRole === "customer");
    const accountJustDisabled = (!oldDisabled && newDisabled);
    if (roleDemotedToCustomer || accountJustDisabled) {
        try {
            // 1. Disable the user account in Firebase Authentication in real-time
            await (0, auth_1.getAuth)().updateUser(userId, {
                disabled: true
            });
            console.log(`User ${userId} disabled in Firebase Auth due to role demotion or account deactivation.`);
            // 2. Revoke active refresh tokens immediately to force logout
            await (0, auth_1.getAuth)().revokeRefreshTokens(userId);
            console.log(`Revoked active refresh tokens for user ${userId}.`);
            // 3. Document in audit logs immutably
            await db.collection("role_audit").add({
                action: "REALTIME_AUTH_BLOCK",
                operatorEmail: "SYSTEM_TRIGGER",
                timestamp: firestore_2.FieldValue.serverTimestamp(),
                details: `Usuario ${userId} bloqueado en Firebase Auth en tiempo real. Razón: ${roleDemotedToCustomer ? "Rol descendido a customer" : "Cuenta desactivada por administador"}.`
            });
        }
        catch (err) {
            console.error(`Error deactivating Firebase Auth user ${userId}:`, err.message);
        }
    }
});
//# sourceMappingURL=index.js.map