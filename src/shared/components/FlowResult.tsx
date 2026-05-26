import React, { useEffect, useState } from "react";
import { CheckCircle2, XCircle, Loader2, ArrowRight } from "lucide-react";
import { motion } from "motion/react";
import { db } from "../../lib/firebase";
import { collection, doc, writeBatch, increment, serverTimestamp, arrayUnion } from "firebase/firestore";
import { useAuth } from "../../contexts/AuthContext";
import { STORAGE_KEYS, getStorageJSON, setStorageJSON, removeStorage } from "../../lib/storage";

export function FlowResult() {
  const { profile } = useAuth();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");

    if (!token) {
      setStatus("error");
      setMessage("Token de pago no encontrado.");
      return;
    }

    async function processPayment() {
      try {
        // 1. Verify status with our backend
        const response = await fetch(`/api/flow/payment-status?token=${token}`);
        const flowData = await response.json();

        // status 2 = Aceptado
        if (flowData.status === 2 || flowData.status === "2") {
          // 2. Recover cart and transaction details from storage
          const cart = getStorageJSON<any[] | null>(STORAGE_KEYS.pendingOrderCart, null);
          const payments = getStorageJSON<any[] | null>(STORAGE_KEYS.pendingOrderPayments, null);
          const coupon = getStorageJSON<any | null>(STORAGE_KEYS.pendingOrderCoupon, null);

          if (!cart || !payments) {
            console.error("No pending order data found in storage");
            setStatus("success"); // Still success because money was taken, but log error
            setMessage("Pago exitoso pero hubo un problema recuperando la orden. Por favor contacte a soporte.");
            return;
          }

          // 3. Update Firebase
          const batch = writeBatch(db);
          const orderId = doc(collection(db, "transactions")).id;
          const cartTotal = cart.reduce((sumValue: number, itemValue: any) => sumValue + (itemValue.price * itemValue.quantity), 0);
          const discountApplied = coupon 
            ? (coupon.discountType === "percent" 
                ? Math.round(cartTotal * (coupon.discountValue / 100)) 
                : Number(coupon.discountValue)) 
            : 0;
          const finalOrderTotal = Math.max(0, cartTotal - discountApplied);

          // Retrieve customer from local customer_session
          const customer: any = getStorageJSON<any>(STORAGE_KEYS.customerSession, null);

          cart.forEach((item: any) => {
            const productRef = doc(db, "products", item.id);
            const transactionRef = doc(db, "transactions", `${orderId}_${item.id}`);
            
            batch.update(productRef, {
              stock: increment(-item.quantity),
              updatedAt: serverTimestamp()
            });

            const moveRef = doc(collection(db, "stockMovements"));
            batch.set(moveRef, {
              productId: item.id,
              productName: item.name,
              type: "sale",
              quantity: item.quantity,
              previousStock: Number(item.stock || item.maxStock) || 0,
              newStock: (Number(item.stock || item.maxStock) || 0) - item.quantity,
              reason: `Venta Flow #${orderId}`,
              userId: customer?.id || profile?.uid || "system",
              userName: customer?.name || profile?.name || "Auto System",
              source: "mobile",
              timestamp: serverTimestamp()
            });
            
            batch.set(transactionRef, {
              productId: item.id,
              productName: item.name,
              type: "sale",
              quantity: item.quantity,
              amount: item.price * item.quantity,
              userId: customer?.id || profile?.uid || "system",
              userName: customer?.name || profile?.name || "Auto System",
              customerId: customer?.id || null,
              customerName: customer?.name || "VENTA GENERAL",
              customerTaxId: customer?.taxId || null,
              couponCode: coupon?.code || null,
              discountApplied: discountApplied,
              finalOrderTotal: finalOrderTotal,
              paymentBreakdown: payments,
              timestamp: serverTimestamp(),
              orderId: orderId,
              note: `Venta Flow Procesada. Token: ${token}`
            });
          });

          // Apply points award and tag used coupons
          if (customer && customer.id) {
            const customerRef = doc(db, "customers", customer.id);
            const pointsAwarded = Math.floor(finalOrderTotal / 1000); // 1 point per $1000 CLP
            const totalPoints = (customer.points || 0) + pointsAwarded;
            
            // Calculate tier segment
            let finalSegment = "Bronze";
            if (totalPoints >= 5000) finalSegment = "Platinum";
            else if (totalPoints >= 2000) finalSegment = "Gold";
            else if (totalPoints >= 500) finalSegment = "Silver";

            const customerUpdates: any = {
              points: increment(pointsAwarded),
              totalSpent: increment(finalOrderTotal),
              segment: finalSegment,
              lastPurchaseAt: serverTimestamp(),
              updatedAt: serverTimestamp()
            };

            if (coupon && coupon.code) {
              customerUpdates.usedCoupons = arrayUnion(coupon.code);
            }

            batch.update(customerRef, customerUpdates);

            // Sync updated values to local session storage so they show immediately
            const updatedSession = {
              ...customer,
              points: totalPoints,
              totalSpent: (customer.totalSpent || 0) + finalOrderTotal,
              segment: finalSegment,
              usedCoupons: [...(customer.usedCoupons || []), coupon?.code].filter(Boolean)
            };
            setStorageJSON(STORAGE_KEYS.customerSession, updatedSession);
          }

          await batch.commit();

          // 4. Clear storage
          removeStorage(STORAGE_KEYS.pendingOrderCart);
          removeStorage(STORAGE_KEYS.pendingOrderPayments);
          removeStorage(STORAGE_KEYS.pendingOrderCoupon);

          setStatus("success");
        } else {
          setStatus("error");
          setMessage(`Estado del pago: ${flowData.status}. La transacción no ha sido aprobada.`);
        }
      } catch (err: any) {
        console.error(err);
        setStatus("error");
        setMessage("Error verificando el pago: " + err.message);
      }
    }

    processPayment();
  }, [profile]);

  const goBack = () => {
    window.location.href = "/";
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 text-slate-800">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-[480px] w-full bg-white rounded-[2.5rem] border border-slate-100 shadow-2xl p-10 text-center"
      >
        {status === "loading" && (
          <div className="flex flex-col items-center">
            <Loader2 size={48} className="text-indigo-500 animate-spin mb-6" />
            <h2 className="text-2xl font-black mb-2">Verificando Pago</h2>
            <p className="text-slate-500">Estamos confirmando tu transacción con Flow...</p>
          </div>
        )}

        {status === "success" && (
          <div className="flex flex-col items-center">
            <div className="size-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-6">
              <CheckCircle2 size={40} />
            </div>
            <h2 className="text-2xl font-black mb-2">¡Pago Exitoso!</h2>
            <p className="text-slate-500 mb-2">Tu pago ha sido procesado correctamente.</p>
            {message && <p className="text-amber-600 text-xs font-bold mb-8">{message}</p>}
            {!message && <p className="text-slate-500 mb-8">Stock actualizado y orden registrada.</p>}
            
            <button type="button" 
              onClick={goBack}
              className="w-full h-14 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-widest text-xs flex items-center justify-center space-x-2"
            >
              <span>Volver al Sistema</span>
              <ArrowRight size={16} />
            </button>
          </div>
        )}

        {status === "error" && (
          <div className="flex flex-col items-center">
            <div className="size-20 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mb-6">
              <XCircle size={40} />
            </div>
            <h2 className="text-2xl font-black mb-2">No se pudo procesar</h2>
            <p className="text-slate-500 mb-4">{message || "No pudimos confirmar tu pago o la transacción fue cancelada."}</p>
            <button type="button" 
              onClick={goBack}
              className="w-full h-14 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-widest text-xs"
            >
              Volver al inicio
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
}
