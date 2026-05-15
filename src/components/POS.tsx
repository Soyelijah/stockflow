import React, { useState, useEffect, useMemo } from "react";
import { 
  collection, 
  query, 
  onSnapshot, 
  writeBatch, 
  doc, 
  serverTimestamp,
  increment,
  orderBy
} from "firebase/firestore";
import { motion, AnimatePresence } from "motion/react";
import { db, handleFirestoreError, OperationType } from "../lib/firebase";
import { 
  Search, 
  ShoppingCart, 
  Plus, 
  Minus, 
  Trash2, 
  CheckCircle2, 
  Package, 
  Zap,
  Tag,
  CreditCard,
  Banknote,
  Smartphone,
  X,
  Loader2,
  RefreshCw,
  Cpu
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useAuth } from "../contexts/AuthContext";
import { useSettings } from "../contexts/SettingsContext";
import { cn, formatCurrency } from "../lib/utils";
import confetti from "canvas-confetti";
import { CashRegisterManagement } from "./CashRegister";
import { MercadoPagoWallet } from "./MercadoPagoWallet";

interface CartItem {
  id: string;
  name: string;
  price: number;
  costPrice: number;
  quantity: number;
  maxStock: number;
}

interface PaymentBreakdown {
  efectivo: number;
  tarjeta: number;
  digital: number;
}

export function POS() {
  const { profile } = useAuth();
  const { settings } = useSettings();
  const [products, setProducts] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>("Todos");
  
  // Payment States
  const [payments, setPayments] = useState<PaymentBreakdown>({
    efectivo: 0,
    tarjeta: 0,
    digital: 0
  });
  const [cashReceived, setCashReceived] = useState<string>("");
  const [lastOrder, setLastOrder] = useState<any>(null);

  // Flow QR states
  const [showFlowModal, setShowFlowModal] = useState(false);
  const [flowToken, setFlowToken] = useState("");
  const [flowUrl, setFlowUrl] = useState("");
  const [flowStatus, setFlowStatus] = useState<"pending" | "success" | "error">("pending");

  // NFC / Contactless Sim State
  const [showNFCSim, setShowNFCSim] = useState(false);
  const [nfcState, setNfcState] = useState<"waiting" | "processing" | "success">("waiting");

  // Cash Register State
  const [isCashRegisterOpen, setIsCashRegisterOpen] = useState(false);
  const [currentSession, setCurrentSession] = useState<any>(null);

  useEffect(() => {
    let interval: any;
    if (showFlowModal && flowToken && flowStatus === "pending") {
      interval = setInterval(async () => {
        try {
          const res = await fetch(`/api/flow/payment-status?token=${flowToken}`);
          if (!res.ok) return;
          const statusData = await res.json();
          // status 2 = Aceptado
          if (statusData.status === 2 || statusData.status === "2") {
            setFlowStatus("success");
            clearInterval(interval);
            // Finish order
            await finishOrder(flowToken);
          } else if (statusData.status === 3 || statusData.status === 4) {
            setFlowStatus("error");
            clearInterval(interval);
          }
        } catch (err) {
          console.error("Polling error:", err);
        }
      }, 3000);
    }
    return () => clearInterval(interval);
  }, [showFlowModal, flowToken, flowStatus]);

  useEffect(() => {
    const q = query(collection(db, "products"), orderBy("name"));
    const unsub = onSnapshot(q, (snapshot) => {
      const prods = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setProducts(prods);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "products (POS)");
    });
    return unsub;
  }, []);

  const categories = useMemo(() => {
    const cats = new Set(products.map(p => p.category).filter(Boolean));
    return ["Todos", ...Array.from(cats)];
  }, [products]);

  const filteredProducts = useMemo(() => products.filter(p => {
    if (!p.name) return false;
    const searchLower = searchTerm.toLowerCase();
    const nameMatch = p.name.toLowerCase().includes(searchLower);
    const skuMatch = p.sku && p.sku.toLowerCase().includes(searchLower);
    const categoryMatch = selectedCategory === "Todos" || p.category === selectedCategory;
    return Number(p.stock) > 0 && (nameMatch || skuMatch) && categoryMatch;
  }), [products, searchTerm, selectedCategory]);

  useEffect(() => {
    let barcode = "";
    let lastKeyTime = Date.now();

    const handleKeyDown = (e: KeyboardEvent) => {
      const currentTime = Date.now();
      
      // Typical scanners send characters with very small delay
      if (currentTime - lastKeyTime > 50) {
        barcode = "";
      }
      
      if (e.key === "Enter") {
        if (barcode.length > 2) {
          const product = products.find(p => p.barcode === barcode);
          if (product) {
            addToCart(product);
            // Play a small beep or visual feedback if desired
          }
          barcode = "";
        }
      } else if (e.key.length === 1) {
        barcode += e.key;
      }
      
      lastKeyTime = currentTime;
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [products]);

  const addToCart = (product: any) => {
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        if (existing.quantity >= product.stock) return prev;
        return prev.map(item => 
          item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { 
        id: product.id, 
        name: product.name, 
        price: Number(product.price) || 0, 
        costPrice: Number(product.costPrice) || 0,
        quantity: 1, 
        maxStock: product.stock 
      }];
    });
  };

  const updateQuantity = (id: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.id === id) {
        const newQty = item.quantity + delta;
        if (newQty <= 0) return item;
        if (newQty > item.maxStock) return item;
        return { ...item, quantity: newQty };
      }
      return item;
    }));
  };

  const removeFromCart = (id: string) => {
    setCart(prev => prev.filter(item => item.id !== id));
  };

  const cartTotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const paidTotal = payments.efectivo + payments.tarjeta + payments.digital;
  const remaining = Math.max(0, cartTotal - paidTotal);
  const change = Math.max(0, Number(cashReceived) - payments.efectivo);

  const handlePaymentChange = (key: keyof PaymentBreakdown, value: string) => {
    const num = parseFloat(value) || 0;
    setPayments(prev => ({ ...prev, [key]: num }));
  };

  const handleNumpadClick = (val: string) => {
    setCashReceived(prev => {
      if (val === "C") return "";
      if (val === "⌫") return prev.slice(0, -1);
      if (val === "." && prev.includes(".")) return prev;
      return prev + val;
    });
  };

  const quickPay = () => {
    setPayments({
      efectivo: cartTotal,
      tarjeta: 0,
      digital: 0
    });
    setCashReceived(cartTotal.toString());
  };

  const handlePrint = (order: any) => {
    // Create hidden iframe for printing
    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    document.body.appendChild(iframe);

    const receiptHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Ticket de Venta - ${order.id}</title>
          <style>
            @page { size: 80mm auto; margin: 0; }
            body { 
              font-family: 'Courier New', Courier, monospace; 
              padding: 10px; 
              width: 75mm; 
              color: #000; 
              margin: 0;
              font-size: 12px;
            }
            .header { text-align: center; margin-bottom: 15px; border-bottom: 1px dashed #000; padding-bottom: 10px; }
            .item { display: flex; justify-content: space-between; margin: 3px 0; }
            .total { margin-top: 10px; border-top: 1px solid #000; padding-top: 8px; font-weight: bold; font-size: 14px; }
            .footer { text-align: center; margin-top: 25px; font-size: 10px; border-top: 1px dashed #ccc; pt: 10px; }
            .payment { font-size: 10px; margin-top: 8px; color: #333; }
            .business-name { font-size: 16px; font-weight: 900; margin: 0 0 5px 0; }
            .separator { border-bottom: 1px dashed #000; margin: 10px 0; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1 class="business-name">${settings.businessName.toUpperCase()}</h1>
            <p>${settings.address || ""}</p>
            <p>Ticket No: ${order.id.slice(0, 8)}</p>
            <p>${new Date().toLocaleDateString("es-CL")} ${new Date().toLocaleTimeString("es-CL")}</p>
          </div>
          <div class="items">
            ${order.items.map((item: any) => `
              <div class="item">
                <span>${item.name} x${item.quantity}</span>
                <span>$ ${Math.round(item.price * item.quantity).toLocaleString("es-CL")}</span>
              </div>
            `).join("")}
          </div>
          <div class="total item">
            <span>TOTAL</span>
            <span>$ ${Math.round(order.total).toLocaleString("es-CL")}</span>
          </div>
          <div class="separator"></div>
          <div class="payment">
            ${order.payments.efectivo > 0 ? `<div>Efectivo: $ ${Math.round(order.payments.efectivo).toLocaleString("es-CL")}</div>` : ""}
            ${order.payments.tarjeta > 0 ? `<div>Tarjeta: $ ${Math.round(order.payments.tarjeta).toLocaleString("es-CL")}</div>` : ""}
            ${order.payments.digital > 0 ? `<div>Transferencia/Digital: $ ${Math.round(order.payments.digital).toLocaleString("es-CL")}</div>` : ""}
          </div>
          <div class="footer">
            <p>¡Gracias por su compra!</p>
            <p>SISTEMA DE GESTIÓN STOCKFLOW</p>
          </div>
        </body>
      </html>
    `;

    const doc = iframe.contentWindow?.document;
    if (doc) {
      doc.open();
      doc.write(receiptHtml);
      doc.close();

      // Small delay to ensure content is layouted
      setTimeout(() => {
        if (iframe.contentWindow) {
          iframe.contentWindow.focus();
          iframe.contentWindow.print();
          
          // Cleanup
          setTimeout(() => {
            document.body.removeChild(iframe);
          }, 1000);
        }
      }, 500);
    }
  };

  const handleCheckout = async () => {
    if (cart.length === 0 || isProcessing) return;
    if (paidTotal < cartTotal) {
      alert("El monto pagado es menor al total de la venta.");
      return;
    }

    // Handle Flow QR Payment if there's digital portion
    if (payments.digital > 0) {
      if (payments.digital < 350) {
        alert("El monto mínimo para pagos digitales (Flow) es de $350 CLP por transacción.");
        return;
      }
      setShowNFCSim(true);
      setNfcState("waiting");
      return;
    }

    await finishOrder();
  };

  const startFlowQR = async () => {
    if (payments.digital < 350) {
      alert("El monto mínimo para cobrar con Flow es de $350 CLP.");
      return;
    }
    try {
      setIsProcessing(true);
      const baseUrl = window.location.origin;
      const response = await fetch("/api/flow/create-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: payments.digital,
          email: profile?.email || "caja@stockflow.cl",
          description: `Cobro POS - ${profile?.name || "Caja"}`,
          externalId: `pos_${Date.now()}`,
          baseUrl: baseUrl
        })
      });

      const data = await response.json();
      if (data.url && data.token) {
        setFlowUrl(data.url);
        setFlowToken(data.token);
        setFlowStatus("pending");
        setShowFlowModal(true);
        setIsProcessing(false);
        setShowNFCSim(false);
      } else {
        throw new Error(data.error || "No se pudo generar el QR");
      }
    } catch (err: any) {
      alert("Error Flow: " + err.message);
      setIsProcessing(false);
    }
  };

  const finishOrder = async (token?: string) => {
    setIsProcessing(true);
    try {
      const batch = writeBatch(db);
      const orderId = doc(collection(db, "transactions")).id;
      
      cart.forEach(item => {
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
          previousStock: item.maxStock,
          newStock: item.maxStock - item.quantity,
          reason: `Venta POS #${orderId}`,
          userId: profile?.uid,
          userName: profile?.name,
          source: "web",
          timestamp: serverTimestamp()
        });
        
        batch.set(transactionRef, {
          productId: item.id,
          productName: item.name,
          type: "sale" as const,
          quantity: item.quantity,
          amount: item.price * item.quantity,
          cost: item.costPrice * item.quantity,
          profit: (item.price - item.costPrice) * item.quantity,
          userId: profile?.uid,
          userName: profile?.name,
          paymentBreakdown: payments,
          timestamp: serverTimestamp(),
          orderId: orderId,
          cashRegisterId: currentSession?.id,
          note: token?.startsWith("mercadopago") ? `Pago Contactless (MP: ${token})` : token ? `Pago Flow QR (Token: ${token})` : `Venta Directa`
        });
      });

      await batch.commit();
      
      const orderData = {
        id: orderId,
        items: cart,
        total: cartTotal,
        payments: payments
      };
      
      setLastOrder(orderData);
      setCart([]);
      setPayments({ efectivo: 0, tarjeta: 0, digital: 0 });
      setCashReceived("");
      
      confetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#4f46e5', '#10b981', '#3b82f6']
      });

      if (!showFlowModal) {
        setShowSuccess(true);
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, "checkout");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 h-full max-w-7xl mx-auto">
      <CashRegisterManagement 
        onStatusChange={(isOpen, sess) => {
          setIsCashRegisterOpen(isOpen);
          setCurrentSession(sess);
        }} 
      />
      {/* Product Selection Area */}
      <div className="lg:col-span-7 flex flex-col space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black text-slate-800 tracking-tight">Caja Registradora</h1>
            <p className="text-slate-500 font-medium">Búsqueda rápida y despacho.</p>
          </div>
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Buscar producto o SKU..."
              className="w-full sm:w-72 bg-white border-none rounded-2xl py-3 pl-12 pr-4 text-sm font-bold shadow-sm focus:ring-4 focus:ring-indigo-500/10 focus:bg-white transition-all text-slate-700"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {/* Category Rail */}
        <div className="flex items-center space-x-2 overflow-x-auto pb-2 no-scrollbar">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={cn(
                "px-6 py-2.5 rounded-2xl text-xs font-black uppercase tracking-widest whitespace-nowrap transition-all border",
                selectedCategory === cat 
                  ? "bg-slate-900 text-white border-slate-900 shadow-lg shadow-slate-200" 
                  : "bg-white text-slate-400 border-slate-100 hover:border-slate-300"
              )}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 overflow-y-auto pr-2 pb-10 max-h-[calc(100vh-320px)]">
          <AnimatePresence mode="popLayout">
            {filteredProducts.map((product) => (
              <motion.div
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                key={product.id}
                onClick={() => addToCart(product)}
                className="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm cursor-pointer hover:shadow-xl hover:shadow-indigo-500/5 hover:-translate-y-1 transition-all group relative overflow-hidden"
              >
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-500 transition-colors shrink-0">
                    <Package size={24} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="font-bold text-slate-800 text-sm truncate">{product.name}</h4>
                    <p className="text-xs font-black text-indigo-600 mt-1">{formatCurrency(product.price)}</p>
                  </div>
                  <div className={cn(
                    "px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest",
                    Number(product.stock) <= Number(product.minThreshold) ? "bg-amber-50 text-amber-600" : "bg-emerald-50 text-emerald-600"
                  )}>
                    {product.stock}
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>

      {/* Checkout Area */}
      <div className="lg:col-span-5 lg:sticky lg:top-10 h-fit">
        <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-2xl flex flex-col p-8 relative overflow-hidden">
          
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-slate-100 rounded-xl text-slate-600">
                <ShoppingCart size={20} />
              </div>
              <h2 className="text-xl font-black text-slate-800 tracking-tight">Checkout</h2>
            </div>
            <button 
              onClick={() => setCart([])}
              className="text-[10px] font-bold text-rose-500 border border-rose-100 px-3 py-1 rounded-full uppercase tracking-widest hover:bg-rose-50 transition-colors"
            >
              Vaciar
            </button>
          </div>

          {/* Cart Items */}
          <div className="space-y-3 mb-6 max-h-[160px] overflow-y-auto pr-2">
            {cart.map((item) => (
              <div key={item.id} className="flex items-center justify-between group bg-slate-50 p-3 rounded-2xl">
                <div className="flex-1 min-w-0 pr-4">
                  <p className="font-bold text-slate-800 text-xs truncate">{item.name}</p>
                  <p className="text-[10px] text-slate-400 font-bold mt-0.5">
                    {formatCurrency(item.price)} x {item.quantity}
                  </p>
                </div>
                <div className="flex items-center space-x-1">
                  <button onClick={() => updateQuantity(item.id, -1)} className="p-1 rounded-lg bg-white shadow-sm border border-slate-100"><Minus size={12}/></button>
                  <span className="w-6 text-center text-xs font-black italic">{item.quantity}</span>
                  <button onClick={() => updateQuantity(item.id, 1)} disabled={item.quantity >= item.maxStock} className="p-1 rounded-lg bg-white shadow-sm border border-slate-100 disabled:opacity-30"><Plus size={12}/></button>
                  <button onClick={() => removeFromCart(item.id)} className="ml-2 text-slate-300 hover:text-rose-500 transition-colors"><Trash2 size={14} /></button>
                </div>
              </div>
            ))}
            {cart.length === 0 && (
              <div className="text-center py-6 border-2 border-dashed border-slate-100 rounded-2xl flex flex-col items-center justify-center opacity-40">
                <Zap size={24} className="mb-2 text-slate-300" />
                <p className="text-[10px] font-bold uppercase tracking-widest">Seleccione productos</p>
              </div>
            )}
          </div>

          {/* Payment Breakdown */}
          <div className="space-y-4 pt-6 border-t border-slate-50">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Métodos de Pago (Split)</span>
              <button 
                onClick={quickPay}
                className="text-[10px] font-black text-indigo-600 uppercase tracking-widest hover:underline"
              >
                Pago Total Efectivo
              </button>
            </div>
            
            <div className="grid grid-cols-3 gap-3">
              {[
                { id: "efectivo", label: "Efectivo", icon: Banknote, color: "text-emerald-500" },
                { id: "tarjeta", label: "Tarjeta", icon: CreditCard, color: "text-blue-500" },
                { id: "digital", label: "Transf./Dig.", icon: Smartphone, color: "text-purple-500" }
              ].map((m) => (
                <div key={m.id} className="space-y-1.5">
                  <div className="flex items-center space-x-1.5 text-[10px] font-bold text-slate-500 uppercase px-1">
                    <m.icon size={12} className={m.color} />
                    <span>{m.label}</span>
                  </div>
                  <input 
                    type="number" 
                    placeholder="0"
                    className="w-full bg-slate-50 border-none rounded-xl py-2 px-3 text-xs font-black text-slate-700 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                    value={payments[m.id as keyof PaymentBreakdown] || ""}
                    onChange={(e) => handlePaymentChange(m.id as keyof PaymentBreakdown, e.target.value)}
                  />
                </div>
              ))}
            </div>

            {/* Change Calculator & Numpad */}
            <div className="bg-slate-900 rounded-3xl p-6 text-white space-y-6 shadow-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 blur-3xl rounded-full -mr-16 -mt-16" />
              
              <div className="flex items-center justify-between relative z-10">
                <div>
                  <p className="text-[10px] text-white/40 font-black uppercase tracking-widest mb-1">Monto Recibido</p>
                  <div className="flex items-baseline space-x-1">
                    <span className="text-xl font-black text-white/20">$</span>
                    <input 
                      type="text" 
                      readOnly
                      className="bg-transparent border-none text-3xl font-black p-0 w-32 focus:ring-0 placeholder:text-white/10"
                      placeholder="0"
                      value={cashReceived}
                    />
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-white/40 font-black uppercase tracking-widest mb-1">Vuelto</p>
                  <p className="text-3xl font-black text-emerald-400">{formatCurrency(change)}</p>
                </div>
              </div>

              {/* Touch Numpad */}
              <div className="grid grid-cols-3 gap-2 relative z-10">
                {["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "⌫"].map((btn) => (
                  <button
                    key={btn}
                    onClick={() => handleNumpadClick(btn)}
                    className="h-12 bg-white/5 hover:bg-white/10 rounded-xl font-black text-sm transition-all active:scale-95"
                  >
                    {btn}
                  </button>
                ))}
                <button
                  onClick={() => handleNumpadClick("C")}
                  className="col-span-3 h-10 bg-rose-500/20 text-rose-400 hover:bg-rose-500/30 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all"
                >
                  Limpiar monto
                </button>
              </div>

              <div className="pt-4 border-t border-white/5 space-y-3 relative z-10">
                <div className="flex justify-between text-xs font-bold text-white/60">
                  <span>Total Venta</span>
                  <span className="text-white">{formatCurrency(cartTotal)}</span>
                </div>
                <div className="flex justify-between items-end">
                  <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">Saldo Restante</span>
                  <span className={cn("text-xl font-black", remaining > 0 ? "text-amber-400" : "text-emerald-400 animate-pulse")}>
                    {remaining > 0 ? formatCurrency(remaining) : "FULL PAGADO"}
                  </span>
                </div>
              </div>

              <button
                onClick={handleCheckout}
                disabled={isProcessing || cart.length === 0 || remaining > 0}
                className="w-full h-16 bg-white text-slate-900 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-indigo-50 hover:scale-[1.02] transition-all disabled:opacity-20 disabled:scale-100 flex items-center justify-center space-x-2 shadow-xl shadow-black/20"
              >
                {isProcessing ? <Loader2 className="animate-spin" size={20} /> : "Finalizar y Emitir Ticket"}
              </button>
            </div>
          </div>

          {/* Success / Print Overlay */}
          <AnimatePresence>
            {showSuccess && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-white/95 backdrop-blur-sm z-[20] flex flex-col items-center justify-center p-8 text-center"
              >
                <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-6">
                  <CheckCircle2 size={40} />
                </div>
                <h3 className="text-2xl font-black text-slate-800 mb-2">Venta Procesada</h3>
                <p className="text-slate-500 text-sm font-medium mb-8">Stock actualizado y transacción registrada exitosamente.</p>
                
                <div className="flex flex-col w-full gap-3">
                  <button 
                    onClick={() => handlePrint(lastOrder)}
                    className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-lg shadow-indigo-200"
                  >
                    Imprimir Comprobante
                  </button>
                  <button 
                    onClick={() => setShowSuccess(false)}
                    className="w-full py-4 text-slate-400 font-bold hover:text-slate-600 transition-colors uppercase tracking-widest text-[10px]"
                  >
                    Nueva Venta
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Contactless Payment Modal */}
      <AnimatePresence>
        {showNFCSim && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/80 backdrop-blur-xl z-[100] flex items-center justify-center p-6"
          >
            <motion.div
              initial={{ y: 50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="bg-white rounded-[3rem] shadow-2xl max-w-md w-full p-10 flex flex-col items-center text-center relative"
            >
              <button 
                onClick={() => setShowNFCSim(false)}
                className="absolute top-8 right-8 p-2 text-slate-300 hover:text-slate-900"
              >
                <X size={24} />
              </button>

              <div className="w-20 h-20 bg-indigo-50 text-indigo-500 rounded-[2rem] flex items-center justify-center mb-8">
                <Cpu size={40} className="animate-pulse" />
              </div>
              
              <h3 className="text-2xl font-black text-slate-800 mb-2">Pago Sin Contacto</h3>
              <p className="text-slate-500 mb-8 font-medium">Billetera Digital y Wallets (Google Pay / Apple Pay)</p>
              
              <MercadoPagoWallet 
                amount={payments.digital}
                onSuccess={(paymentId) => {
                  setNfcState("success");
                  setTimeout(async () => {
                    setShowNFCSim(false);
                    await finishOrder(`mercadopago_${paymentId}`);
                  }, 1500);
                }}
                onError={(err) => {
                  alert("Error en el pago: " + err);
                }}
              />

              <div className="mt-8 pt-8 border-t border-slate-50 w-full">
                <button 
                  onClick={startFlowQR}
                  className="w-full h-14 bg-slate-50 text-indigo-600 rounded-2xl font-black uppercase tracking-widest text-[10px] flex items-center justify-center space-x-2 border border-indigo-100 hover:bg-slate-100 transition-all"
                >
                  <Smartphone size={16} />
                  <span>Cambiar a Flow QR</span>
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* QR Flow Payment Modal */}
      <AnimatePresence>
        {showFlowModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-6"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white rounded-[3rem] shadow-2xl max-w-sm w-full p-10 flex flex-col items-center text-center relative overflow-hidden"
            >
              <button 
                onClick={() => {
                  if (flowStatus !== "success") setShowFlowModal(false);
                  else { setShowSuccess(true); setShowFlowModal(false); }
                }}
                className="absolute top-6 right-6 p-2 text-slate-300 hover:text-slate-900 transition-colors"
                disabled={isProcessing}
              >
                <X size={24} />
              </button>

              {flowStatus === "pending" && (
                <>
                  <div className="w-16 h-16 bg-indigo-50 text-indigo-500 rounded-2xl flex items-center justify-center mb-6">
                    <Smartphone size={32} />
                  </div>
                  <h3 className="text-xl font-black text-slate-800 mb-2">Pago por QR</h3>
                  <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mb-8">Cliente debe escanear</p>
                  
                  <div className="p-4 bg-white border-4 border-slate-50 rounded-3xl mb-8">
                    <QRCodeSVG 
                      value={flowUrl} 
                      size={200}
                      level="H"
                      includeMargin={true}
                    />
                  </div>

                  <div className="flex items-center space-x-2 text-indigo-500 font-black text-xs animate-pulse">
                    <RefreshCw size={14} className="animate-spin" />
                    <span>ESPERANDO PAGO...</span>
                  </div>
                </>
              )}

              {flowStatus === "success" && (
                <>
                  <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-6">
                    <CheckCircle2 size={40} />
                  </div>
                  <h3 className="text-2xl font-black text-slate-800 mb-2">¡Pago Recibido!</h3>
                  <p className="text-slate-500 mb-8 font-medium">La transacción ha sido aprobada por Flow.</p>
                  <button 
                    onClick={() => {
                      setShowFlowModal(false);
                      setShowSuccess(true);
                    }}
                    className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-widest text-xs"
                  >
                    Continuar
                  </button>
                </>
              )}

              {flowStatus === "error" && (
                <>
                  <div className="w-20 h-20 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mb-6">
                    <X size={40} />
                  </div>
                  <h3 className="text-2xl font-black text-slate-800 mb-2">Pago Cancelado</h3>
                  <p className="text-slate-500 mb-8 font-medium">No se pudo confirmar o el tiempo expiró.</p>
                  <button 
                    onClick={() => setShowFlowModal(false)}
                    className="w-full py-4 bg-slate-100 text-slate-900 rounded-2xl font-black uppercase tracking-widest text-xs"
                  >
                    Cerrar
                  </button>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
