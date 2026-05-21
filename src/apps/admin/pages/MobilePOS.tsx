import React, { useState, useEffect, useMemo } from "react";
import { 
  collection, 
  query, 
  onSnapshot, 
  writeBatch, 
  doc, 
  getDoc,
  addDoc,
  serverTimestamp,
  increment,
  orderBy
} from "firebase/firestore";
import { motion, AnimatePresence } from "motion/react";
import { db, handleFirestoreError, OperationType } from "@/src/lib/firebase";
import { 
  Search, 
  ShoppingCart, 
  Plus, 
  Minus, 
  Trash2, 
  CheckCircle2, 
  Package, 
  Tag,
  CreditCard,
  Banknote,
  Smartphone,
  X,
  Loader2,
  ChevronLeft,
  RefreshCw,
  Store,
  User,
  Users,
  LogOut,
  FileText,
  Ticket,
  Camera
} from "lucide-react";
import { useAuth } from "@/src/contexts/AuthContext";
import { useSettings } from "@/src/contexts/SettingsContext";
import { AUTOMATIC_POINT_COUPONS } from "@/src/lib/coupons";
import { BarcodeScanner } from "@/src/components/ui/BarcodeScanner";
import { cn, formatCurrency, formatRUT, formatChileanPhone, formatNumber, calculatePoints, getCustomerTier } from "@/src/lib/utils";
import confetti from "canvas-confetti";
import { printReceipt } from "@/src/lib/printUtils";

interface CartItem {
  id: string;
  name: string;
  price: number;
  costPrice: number;
  quantity: number;
  maxStock: number;
}

export function MobilePOS() {
  const { profile, logout } = useAuth();
  const { settings } = useSettings();
  const [products, setProducts] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [emailSentTo, setEmailSentTo] = useState<string | null>(null);
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [isScanningCustomer, setIsScanningCustomer] = useState(false);
  const [isNewCustomerMode, setIsNewCustomerMode] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [documentType, setDocumentType] = useState<"boleta" | "factura">("boleta");
  const [paymentMethod, setPaymentMethod] = useState<"efectivo" | "tarjeta" | "transferencia" | "digital">("efectivo");
  const [activeTab, setActiveTab] = useState<"shop" | "cart" | "profile">("shop");
  const [selectedCategory, setSelectedCategory] = useState("Todos");
  const [lastOrder, setLastOrder] = useState<any>(null);
  const [visibleCount, setVisibleCount] = useState(16);

  const [newCustomer, setNewCustomer] = useState({
    name: "",
    taxId: "",
    email: "",
    phone: ""
  });

  // Promo Coupons State
  const [promoCode, setPromoCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<any>(null);
  const [couponError, setCouponError] = useState("");

  useEffect(() => {
    const q = query(collection(db, "products"), orderBy("name"));
    const unsubProds = onSnapshot(q, (snapshot) => {
      setProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "products (MobilePOS)");
    });

    const qCust = query(collection(db, "customers"), orderBy("name"));
    const unsubCust = onSnapshot(qCust, (snapshot) => {
      setCustomers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "customers (MobilePOS)");
    });

    return () => { unsubProds(); unsubCust(); };
  }, []);

  const categories = useMemo(() => {
    const cats = new Set(products.map(p => p.category).filter(Boolean));
    return ["Todos", ...Array.from(cats)];
  }, [products]);

  const filteredProducts = products.filter(p => {
    const nameMatch = p.name?.toLowerCase().includes(searchTerm.toLowerCase());
    const skuMatch = p.sku?.toLowerCase().includes(searchTerm.toLowerCase());
    const barcodeMatch = (p.barcode && p.barcode.includes(searchTerm)) || (p.barcodes && p.barcodes.some((bc: string) => bc.includes(searchTerm)));
    const categoryMatch = selectedCategory === "Todos" || p.category === selectedCategory;
    return (nameMatch || skuMatch || barcodeMatch) && categoryMatch && Number(p.stock) > 0;
  });

  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(customerSearch.toLowerCase()) || 
    c.taxId?.includes(customerSearch)
  ).slice(0, 5);

  const cartTotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const couponDiscount = appliedCoupon ? (appliedCoupon.discountType === "percent" ? Math.round(cartTotal * (appliedCoupon.discountValue / 100)) : Number(appliedCoupon.discountValue || 0)) : 0;
  const finalTotal = Math.max(0, cartTotal - couponDiscount);
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  const addToCart = (product: any) => {
    setCart(prev => {
       const existing = prev.find(item => item.id === product.id);
       const stockVal = Number(product.stock) || 0;
       if (existing) {
         if (existing.quantity >= stockVal) return prev;
         return prev.map(item => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
       }
       return [...prev, { 
         id: product.id, 
         name: product.name, 
         price: Number(product.price) || 0, 
         costPrice: Number(product.costPrice) || 0,
         quantity: 1, 
         maxStock: stockVal 
       }];
    });
  };

  const handleApplyCoupon = async () => {
    setCouponError("");
    if (!promoCode.trim()) return;
    try {
      const codeUpper = promoCode.trim().toUpperCase();
      
      // Check if selected customer has already used this coupon
      if (selectedCustomer && selectedCustomer.usedCoupons && selectedCustomer.usedCoupons.includes(codeUpper)) {
        setCouponError("Cupón ya utilizado por este cliente");
        setAppliedCoupon(null);
        return;
      }

      // 1. Check if it's an automatic point-based loyalty coupon
      const autoCoupon = AUTOMATIC_POINT_COUPONS.find(c => c.code === codeUpper);
      if (autoCoupon) {
        if (!selectedCustomer) {
          setCouponError("Asocie cliente para validar puntos");
          setAppliedCoupon(null);
          return;
        }
        const points = selectedCustomer.points || 0;
        if (points < autoCoupon.requiredPoints) {
          setCouponError(`Faltan puntos (${points}/${autoCoupon.requiredPoints} pts)`);
          setAppliedCoupon(null);
          return;
        }
        setAppliedCoupon({
          id: autoCoupon.id,
          code: autoCoupon.code,
          title: autoCoupon.title,
          discountType: autoCoupon.discountType,
          discountValue: autoCoupon.discountValue,
          minTier: "BRONZE",
          active: true,
          img: autoCoupon.img
        });
        setCouponError("");
        return;
      }

      // 2. Otherwise assume it's an enterprise promo coupon in Firestore
      const docRef = doc(db, "coupons", codeUpper);
      const docSnap = await getDoc(docRef);
      if (!docSnap.exists()) {
        setCouponError("Código inválido");
        setAppliedCoupon(null);
        return;
      }
      const data = docSnap.data();
      if (!data.active) {
        setCouponError("Inactivo");
        setAppliedCoupon(null);
        return;
      }
      
      // Verify min loyalty tier if customer is selected
      if (selectedCustomer) {
        const points = selectedCustomer.points || 0;
        const customerTier = getCustomerTier(points);
        const tiersOrder = { BRONZE: 0, SILVER: 1, GOLD: 2, PLATINUM: 3 };
        const reqTierRank = tiersOrder[data.minTier as keyof typeof tiersOrder] || 0;
        const curTierRank = tiersOrder[customerTier.name.toUpperCase() as keyof typeof tiersOrder] || 0;
        
        if (curTierRank < reqTierRank) {
          setCouponError(`Requiere ${data.minTier}`);
          setAppliedCoupon(null);
          return;
        }
      } else if (data.minTier !== "BRONZE") {
        setCouponError(`Requiere cliente ${data.minTier}`);
        setAppliedCoupon(null);
        return;
      }

      setAppliedCoupon({ id: docSnap.id, ...data });
      setCouponError("¡Cupón aplicado!");
      setTimeout(() => setCouponError(""), 3000);
    } catch (err) {
      setCouponError("Error al validar");
    }
  };

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const docRef = await addDoc(collection(db, "customers"), {
        ...newCustomer,
        createdAt: serverTimestamp()
      });
      setSelectedCustomer({ id: docRef.id, ...newCustomer });
      setIsCustomerModalOpen(false);
      setIsNewCustomerMode(false);
      setNewCustomer({ name: "", taxId: "", email: "", phone: "" });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, "customers (QuickCreate)");
    }
  };

  // Intercept secure rotating token scanning or secure PIN entry
  useEffect(() => {
    const cleanSearch = customerSearch.trim();
    
    // 1. Check if scanned dynamic QR code token
    if (cleanSearch.startsWith("STK:ID:")) {
      const parts = cleanSearch.split(":");
      if (parts.length >= 4) {
        const taxId = parts[2];
        const expiresAt = Number(parts[3]);
        
        if (Date.now() > expiresAt + 60000) { // 60s clock tolerance
          alert("🔐 Token Expirado: El código QR presentado por el cliente ha vencido. Solicite que abra su tarjeta digital nuevamente para actualizar el código.");
          setCustomerSearch("");
          return;
        }
        
        const found = customers.find(c => c.taxId === taxId);
        if (found) {
          setSelectedCustomer(found);
          setCustomerSearch("");
          setIsCustomerModalOpen(false);
        } else {
          alert(`RUT ${taxId} no está registrado en el sistema de la empresa.`);
          setCustomerSearch("");
        }
      }
    }
    // 2. Check if entered a 6-digit manual secure OTP PIN from the app
    else if (/^\d{6}$/.test(cleanSearch)) {
      const matchedCustomer = customers.find(c => 
        c.securePin === cleanSearch && 
        c.securePinExpiresAt && 
        c.securePinExpiresAt + 60000 > Date.now()
      );
      
      if (matchedCustomer) {
        setSelectedCustomer(matchedCustomer);
        setCustomerSearch("");
        setIsCustomerModalOpen(false);
      }
    }
  }, [customerSearch, customers]);

  const handleCheckout = async () => {
    if (cart.length === 0 || isProcessing) return;
    setIsProcessing(true);
    try {
      const batch = writeBatch(db);
      const orderId = doc(collection(db, "transactions")).id;
      const timestamp = new Date();
      
      const cleanItems = cart.map(item => ({
        id: item.id || "",
        name: item.name || "",
        price: item.price || 0,
        quantity: item.quantity || 1
      }));

      const orderDetails = {
        orderId,
        items: cleanItems,
        total: finalTotal,
        paymentMethod,
        documentType,
        customerName: selectedCustomer?.name || "VENTA GENERAL",
        timestamp: timestamp.toISOString(),
        totalPoints: selectedCustomer ? (selectedCustomer.points || 0) + calculatePoints(finalTotal) : undefined,
        couponCode: appliedCoupon?.code || null,
        discountApplied: couponDiscount,
      };

      cart.forEach(item => {
        const productRef = doc(db, "products", item.id);
        const transactionRef = doc(db, "transactions", `${orderId}_${item.id}`);
        
        batch.update(productRef, {
          stock: increment(-item.quantity),
          updatedAt: serverTimestamp()
        });
        
        batch.set(transactionRef, {
          productId: item.id,
          productName: item.name,
          type: "sale",
          documentType,
          quantity: item.quantity,
          amount: item.price * item.quantity,
          cost: item.costPrice * item.quantity,
          profit: (item.price - item.costPrice) * item.quantity,
          userId: profile?.uid,
          userName: profile?.name,
          customerId: selectedCustomer?.id || null,
          customerName: selectedCustomer?.name || "VENTA GENERAL",
          customerTaxId: selectedCustomer?.taxId || null,
          paymentMethod,
          timestamp: serverTimestamp(),
          orderId: orderId,
          source: "mobile_pos",
          couponCode: appliedCoupon?.code || null,
          discountApplied: couponDiscount,
        });
      });

      // Award loyalty points and update stats automatically
      if (selectedCustomer?.id) {
        const pointsAwarded = calculatePoints(finalTotal);
        const currentPoints = (selectedCustomer.points || 0) + pointsAwarded;
        const newTier = getCustomerTier(currentPoints);
        
        const customerRef = doc(db, "customers", selectedCustomer.id);
        const updates: any = {
          points: increment(pointsAwarded),
          totalSpent: increment(finalTotal),
          segment: newTier.segment,
          lastPurchaseAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        };
        
        if (appliedCoupon?.code) {
          const used = selectedCustomer.usedCoupons || [];
          if (!used.includes(appliedCoupon.code)) {
            updates.usedCoupons = [...used, appliedCoupon.code];
          }
        }
        
        batch.update(customerRef, updates);
      }

      await batch.commit();

      // If customer has email, send receipt
      if (selectedCustomer?.email) {
        setEmailSentTo(selectedCustomer.email);
        try {
          await fetch("/api/send-receipt", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              customerEmail: selectedCustomer.email,
              orderDetails,
              businessName: settings.businessName
            })
          });
        } catch (err) {
          console.error("Error calling send-receipt API:", err);
        }
      } else {
        setEmailSentTo(null);
      }

      setCart([]);
      setSelectedCustomer(null);
      setPromoCode("");
      setAppliedCoupon(null);
      setCouponError("");
      setDocumentType("boleta");
      setPaymentMethod("efectivo");
      setLastOrder(orderDetails);
      setShowSuccess(true);
      confetti({ particleCount: 100, spread: 70, origin: { y: 0.8 } });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, "transactions (Checkout)");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900 md:bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] md:from-slate-800 md:via-slate-950 md:to-slate-950 flex md:items-center md:justify-center font-sans select-none overflow-hidden">
      {/* Phone housing frame on wide displays */}
      <div className="w-full h-full md:max-w-md md:h-[860px] bg-slate-50 md:rounded-[3rem] md:border-[10px] md:border-slate-800 md:shadow-[0_25px_60px_-15px_rgba(0,0,0,0.95)] flex flex-col relative overflow-hidden shrink-0">
        
        {/* Notch on desktop mockups */}
        <div className="hidden md:flex absolute top-0 left-1/2 -translate-x-1/2 w-40 h-6 bg-slate-800 rounded-b-2xl z-50 items-center justify-center">
          <div className="w-3 h-3 bg-black rounded-full mr-2" />
          <div className="w-16 h-1.5 bg-slate-900 rounded-full" />
        </div>

        {/* Inner layout wrapper */}
        <div className="flex-1 flex flex-col h-full overflow-hidden relative pt-6 md:pt-10">
          {/* Mobile Header */}
          <header className="bg-white px-6 pt-4 pb-4 border-b border-slate-100 flex items-center justify-between shadow-sm">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-100">
            <Store size={20} />
          </div>
          <div>
            <h1 className="text-lg font-black text-slate-800 tracking-tight leading-none">{settings.businessName}</h1>
            <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest mt-1">POS Móvil</p>
          </div>
        </div>
      </header>

        <AnimatePresence>
          {isScanning && (
            <BarcodeScanner 
              onScan={(code) => {
                if (code) {
                  const product = products.find(p => p.barcode === code || (p.barcodes && p.barcodes.includes(code)));
                  if (product) {
                    addToCart(product);
                  } else {
                    setSearchTerm(code);
                  }
                }
                setIsScanning(false);
              }}
              onClose={() => setIsScanning(false)}
            />
          )}
        </AnimatePresence>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto pb-32">
        <AnimatePresence mode="wait">
          {activeTab === "shop" && (
            <motion.div 
              key="shop"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="p-6 space-y-4"
            >
              {/* Buscador Optimizado para Móvil */}
              <div className="flex items-center space-x-2">
                <button 
                  onClick={() => setIsScanning(true)}
                  className="w-12 h-12 bg-white border border-slate-100 rounded-2xl flex items-center justify-center text-slate-400 active:bg-indigo-50 active:text-indigo-600 transition-all shrink-0 shadow-sm"
                  title="Escanear Código de Barras"
                >
                  <Camera size={20} />
                </button>
                <div className="relative flex-1">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                  <input 
                    type="text"
                    placeholder="Buscar por nombre, SKU o código de barras..."
                    className="w-full h-12 bg-white border border-slate-100 rounded-2xl pl-12 pr-10 text-xs font-bold focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all shadow-sm"
                    value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                      setVisibleCount(16);
                    }}
                  />
                  {searchTerm && (
                    <button 
                      onClick={() => {
                        setSearchTerm("");
                        setVisibleCount(16);
                      }}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              </div>

              {/* Category Slider */}
              <div className="flex space-x-2 overflow-x-auto no-scrollbar pb-2">
                {categories.map(cat => (
                  <button
                    key={cat}
                    onClick={() => {
                      setSelectedCategory(cat);
                      setVisibleCount(16);
                    }}
                    className={cn(
                      "px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap shrink-0 border",
                      selectedCategory === cat 
                        ? "bg-slate-900 border-slate-900 text-white shadow-[0_4px_12px_rgba(0,0,0,0.15)] scale-102" 
                        : "bg-white text-slate-500 border-slate-100 hover:bg-slate-50"
                    )}
                  >
                    <span>{cat}</span>
                  </button>
                ))}
              </div>

              {/* Status Indicators & Count */}
              <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-slate-400 px-1 pt-1">
                <span>Catálogo de Ventas</span>
                <span className="text-indigo-600">
                  {filteredProducts.length === 1 
                    ? "1 producto encontrado" 
                    : `${filteredProducts.length} productos`}
                </span>
              </div>

              {/* Product Grid optimized for thousands of items (Virtual window rendering) */}
              <div className="grid grid-cols-1 gap-3">
                {filteredProducts.slice(0, visibleCount).map(p => {
                  const cartItem = cart.find(item => item.id === p.id);
                  const isOutOfStock = Number(p.stock) <= 0;
                  const isLowStock = Number(p.stock) > 0 && Number(p.stock) <= 5;
                  
                  return (
                    <motion.div
                      layoutId={`pos-prod-${p.id}`}
                      key={p.id}
                      className={cn(
                        "bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between transition-all text-left relative overflow-hidden group",
                        cartItem ? "ring-2 ring-indigo-500/25 border-indigo-200 bg-indigo-50/5" : ""
                      )}
                    >
                      <div className="flex items-center space-x-4 min-w-0 flex-1 mr-2">
                        {/* Interactive dynamic category visual dot */}
                        <div className={cn(
                          "w-12 h-12 rounded-xl flex items-center justify-center transition-all shrink-0 font-bold text-sm",
                          cartItem 
                            ? "bg-indigo-600 text-white ring-4 ring-indigo-50" 
                            : isOutOfStock 
                              ? "bg-slate-100 text-slate-400" 
                              : "bg-slate-50 text-slate-500 group-hover:bg-indigo-50 group-hover:text-indigo-600"
                        )}>
                          {p.name?.charAt(0).toUpperCase()}
                        </div>
                        
                        <div className="min-w-0 flex-1">
                          <p className="font-extrabold text-slate-800 text-xs sm:text-sm truncate pr-1" title={p.name}>
                            {p.name}
                          </p>
                          <div className="flex items-center space-x-2 mt-1">
                            <span className="text-xs font-black text-indigo-600 tracking-tight">
                              {formatCurrency(p.price)}
                            </span>
                            {p.sku && (
                              <span className="text-[9px] font-mono text-slate-400 bg-slate-100 px-1.5 py-0.2 rounded font-semibold uppercase">
                                {p.sku}
                              </span>
                            )}
                          </div>
                          
                          {/* Stock color warning badge */}
                          <div className="mt-1.5 flex items-center space-x-1">
                            {isOutOfStock ? (
                              <span className="text-[8px] font-black tracking-wider text-rose-500 uppercase bg-rose-50 px-2 py-0.5 rounded-full">
                                ✕ Agotado
                              </span>
                            ) : isLowStock ? (
                              <span className="text-[8px] font-black tracking-wider text-amber-500 uppercase bg-amber-50 px-2 py-0.5 rounded-full animate-pulse">
                                ⚠ Pocas unidades ({p.stock})
                              </span>
                            ) : (
                              <span className="text-[8px] font-black tracking-wider text-emerald-600 uppercase bg-emerald-50 px-2 py-0.5 rounded-full">
                                ✓ Disponible ({p.stock} u)
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Premium direct addition trigger tool right on the slot! */}
                      <div className="shrink-0">
                        {cartItem ? (
                          <div className="flex items-center space-x-2 bg-indigo-650/10 bg-indigo-50 border border-indigo-100 rounded-xl p-1 shadow-sm">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (cartItem.quantity === 1) {
                                  setCart(prev => prev.filter(i => i.id !== p.id));
                                } else {
                                  setCart(prev => prev.map(i => i.id === p.id ? { ...i, quantity: i.quantity - 1 } : i));
                                }
                              }}
                              className="w-7 h-7 rounded-lg bg-white border border-slate-100 flex items-center justify-center text-indigo-600 hover:bg-slate-50 active:scale-90 transition-all font-bold"
                            >
                              <Minus size={12} />
                            </button>
                            <span className="text-xs font-black text-indigo-950 px-1 min-w-4 text-center">
                              {cartItem.quantity}
                            </span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (cartItem.quantity < Number(p.stock)) {
                                  setCart(prev => prev.map(i => i.id === p.id ? { ...i, quantity: i.quantity + 1 } : i));
                                }
                              }}
                              className="w-7 h-7 rounded-lg bg-white border border-slate-100 flex items-center justify-center text-indigo-600 hover:bg-slate-50 active:scale-90 transition-all font-bold"
                            >
                              <Plus size={12} />
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            disabled={isOutOfStock}
                            onClick={() => addToCart(p)}
                            className={cn(
                              "h-9 px-4 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center space-x-1 shadow-sm active:scale-95",
                              isOutOfStock 
                                ? "bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed shadow-none"
                                : "bg-indigo-600 hover:bg-indigo-700 text-white hover:shadow-md hover:shadow-indigo-500/10"
                            )}
                          >
                            <Plus size={12} />
                            <span>Añadir</span>
                          </button>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </div>

              {/* Show more / pagination button handles scaled files (up to thousands of items) */}
              {filteredProducts.length > visibleCount && (
                <button
                  type="button"
                  onClick={() => setVisibleCount(prev => prev + 16)}
                  className="w-full py-4 bg-white border border-dashed border-indigo-200 text-indigo-600 rounded-3xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center space-x-2 hover:bg-indigo-50 active:scale-98 transition-all shadow-sm"
                >
                  <RefreshCw size={12} className="animate-spin-slow text-indigo-400" />
                  <span>Cargar más productos ({filteredProducts.length - visibleCount} restantes)</span>
                </button>
              )}
            </motion.div>
          )}

          {activeTab === "cart" && (
            <motion.div 
              key="cart"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="p-6 space-y-6"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-black text-slate-800 tracking-tight">Tu Carrito</h2>
                <button onClick={() => setCart([])} className="text-[10px] font-black text-rose-500 uppercase tracking-widest">Vaciar</button>
              </div>

              {/* Document Type Selection */}
              <div className="grid grid-cols-2 gap-2">
                <button 
                  onClick={() => setDocumentType("boleta")}
                  className={cn(
                    "flex flex-col items-center p-3 rounded-2xl border transition-all",
                    documentType === "boleta" ? "bg-slate-900 border-slate-900 text-white" : "bg-white border-slate-100 text-slate-400"
                  )}
                >
                  <Ticket size={20} className="mb-1" />
                  <span className="text-[10px] font-black uppercase tracking-widest">Boleta</span>
                </button>
                <button 
                  onClick={() => setDocumentType("factura")}
                  className={cn(
                    "flex flex-col items-center p-3 rounded-2xl border transition-all",
                    documentType === "factura" ? "bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-100" : "bg-white border-slate-100 text-slate-400"
                  )}
                >
                  <FileText size={20} className="mb-1" />
                  <span className="text-[10px] font-black uppercase tracking-widest">Factura</span>
                </button>
              </div>

              {/* Customer Selection */}
              <button 
                onClick={() => setIsCustomerModalOpen(true)}
                className={cn(
                  "w-full p-4 rounded-2xl border flex items-center justify-between text-left transition-all",
                  selectedCustomer ? "bg-indigo-50 border-indigo-200 text-indigo-900" : "bg-white border-slate-100 text-slate-400"
                )}
              >
                <div className="flex items-center space-x-3">
                  <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", selectedCustomer ? "bg-white text-indigo-600" : "bg-slate-50 text-slate-300")}>
                    <Users size={18} />
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest opacity-60">
                      {documentType === "factura" ? "Cliente (Obligatorio)" : "Cliente (Opcional)"}
                    </p>
                    <p className="font-bold truncate max-w-[150px]">
                      {selectedCustomer ? selectedCustomer.name : "Venta General"}
                    </p>
                  </div>
                </div>
                {selectedCustomer ? <X size={16} onClick={(e) => { e.stopPropagation(); setSelectedCustomer(null); }} /> : <Plus size={16} />}
              </button>

              {/* Payment Method Selection */}
              <div className="grid grid-cols-2 gap-2">
                <button 
                  onClick={() => setPaymentMethod("efectivo")}
                  className={cn(
                    "flex flex-col items-center p-3 rounded-2xl border transition-all",
                    paymentMethod === "efectivo" ? "bg-emerald-50 border-emerald-200 text-emerald-600 shadow-sm" : "bg-white border-slate-100 text-slate-400"
                  )}
                >
                  <Banknote size={20} className="mb-1" />
                  <span className="text-[10px] font-black uppercase tracking-widest">Efectivo</span>
                </button>
                <button 
                  onClick={() => setPaymentMethod("tarjeta")}
                  className={cn(
                    "flex flex-col items-center p-3 rounded-2xl border transition-all",
                    paymentMethod === "tarjeta" ? "bg-blue-50 border-blue-200 text-blue-600 shadow-sm" : "bg-white border-slate-100 text-slate-400"
                  )}
                >
                  <CreditCard size={20} className="mb-1" />
                  <span className="text-[10px] font-black uppercase tracking-widest">Tarjeta</span>
                </button>
                <button 
                  onClick={() => setPaymentMethod("transferencia")}
                  className={cn(
                    "flex flex-col items-center p-3 rounded-2xl border transition-all",
                    paymentMethod === "transferencia" ? "bg-amber-50 border-amber-200 text-amber-600 shadow-sm" : "bg-white border-slate-100 text-slate-400"
                  )}
                >
                  <RefreshCw size={20} className="mb-1" />
                  <span className="text-[10px] font-black uppercase tracking-widest">Transf.</span>
                </button>
                <button 
                  onClick={() => setPaymentMethod("digital")}
                  className={cn(
                    "flex flex-col items-center p-3 rounded-2xl border transition-all",
                    paymentMethod === "digital" ? "bg-indigo-50 border-indigo-200 text-indigo-600 shadow-sm" : "bg-white border-slate-100 text-slate-400"
                  )}
                >
                  <Smartphone size={20} className="mb-1" />
                  <span className="text-[10px] font-black uppercase tracking-widest">Virtual</span>
                </button>
              </div>

              <div className="space-y-3">
                {cart.map(item => (
                  <div key={item.id} className="bg-white p-4 rounded-2xl border border-slate-100 flex items-center justify-between">
                    <div className="flex-1 min-w-0 pr-4">
                      <p className="font-bold text-slate-800 text-sm truncate">{item.name}</p>
                      <p className="text-[10px] font-bold text-slate-400">{formatCurrency(item.price)} ea.</p>
                    </div>
                    <div className="flex items-center space-x-3">
                      <button 
                        onClick={() => {
                          if (item.quantity === 1) {
                            setCart(prev => prev.filter(i => i.id !== item.id));
                          } else {
                            setCart(prev => prev.map(i => i.id === item.id ? { ...i, quantity: i.quantity - 1 } : i));
                          }
                        }}
                        className="w-8 h-8 bg-slate-50 rounded-lg flex items-center justify-center text-slate-400"
                      >
                        <Minus size={14} />
                      </button>
                      <span className="font-black text-slate-800">{item.quantity}</span>
                      <button 
                        onClick={() => setCart(prev => prev.map(i => i.id === item.id ? { ...i, quantity: Math.min(Number(i.maxStock) || 9999, i.quantity + 1) } : i))}
                        className="w-8 h-8 bg-slate-50 rounded-lg flex items-center justify-center text-slate-400"
                      >
                        <Plus size={14} />
                      </button>
                      <button 
                        onClick={() => setCart(prev => prev.filter(i => i.id !== item.id))}
                        className="ml-2 text-rose-300"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
                {cart.length === 0 && (
                  <div className="text-center py-20 opacity-30">
                    <ShoppingCart size={40} className="mx-auto mb-4" />
                    <p className="text-sm font-bold uppercase tracking-widest">Carrito Vacío</p>
                  </div>
                )}
              </div>

               {cart.length > 0 && (
                <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm space-y-3">
                  <div className="flex items-center space-x-2 text-indigo-950">
                    <Ticket className="w-5 h-5 text-indigo-600" />
                    <span className="text-xs font-black uppercase tracking-wider">¿Tienes un cupón?</span>
                  </div>
                  
                  <div className="flex space-x-2">
                    <div className="relative flex-1">
                      <input 
                        type="text"
                        placeholder="CÓDIGO DE CUPÓN"
                        value={promoCode}
                        onChange={(e) => {
                          setPromoCode(e.target.value);
                          setCouponError("");
                        }}
                        className="w-full h-11 bg-slate-50 border border-slate-100 rounded-xl px-3 pr-8 text-xs font-bold uppercase tracking-wider focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-slate-800 placeholder:text-slate-300"
                      />
                      {promoCode && (
                        <button 
                          onClick={() => { setPromoCode(""); setCouponError(""); }}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                        >
                          <X size={12} />
                        </button>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={handleApplyCoupon}
                      className="px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all shadow-sm active:scale-95"
                    >
                      Aplicar
                    </button>
                  </div>

                  {couponError && (
                    <motion.p 
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="text-[10px] font-bold text-rose-500 ml-1 flex items-center space-x-1"
                    >
                      <span>⚠️ {couponError}</span>
                    </motion.p>
                  )}

                  {appliedCoupon && (
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 flex items-center justify-between"
                    >
                      <div className="flex items-center space-x-2">
                        <span className="text-xl">{appliedCoupon.img || "🎟️"}</span>
                        <div>
                          <p className="text-xs font-extrabold text-emerald-950 uppercase tracking-tight">{appliedCoupon.code}</p>
                          <p className="text-[9px] font-bold text-emerald-600 uppercase tracking-wider">
                            {appliedCoupon.title} (-{appliedCoupon.discountType === "percent" ? `${appliedCoupon.discountValue}%` : formatCurrency(appliedCoupon.discountValue)})
                          </p>
                        </div>
                      </div>
                      <button 
                        onClick={() => { setAppliedCoupon(null); setPromoCode(""); }}
                        className="text-emerald-800 hover:text-emerald-950 hover:bg-emerald-100 p-1 rounded-lg transition-colors"
                      >
                        <X size={14} />
                      </button>
                    </motion.div>
                  )}

                  {selectedCustomer && (
                    <div className="pt-2 border-t border-slate-50">
                      <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1.5">Cupones para {selectedCustomer.name}</p>
                      <div className="flex flex-wrap gap-1">
                        {AUTOMATIC_POINT_COUPONS.map(ac => {
                          const points = selectedCustomer.points || 0;
                          const eligible = points >= ac.requiredPoints;
                          const alreadyUsed = selectedCustomer.usedCoupons && selectedCustomer.usedCoupons.includes(ac.code);
                          if (alreadyUsed) return null;
                          return (
                            <button
                              key={ac.code}
                              onClick={() => {
                                if (eligible) {
                                  setPromoCode(ac.code);
                                  setAppliedCoupon({
                                    id: ac.id,
                                    code: ac.code,
                                    title: ac.title,
                                    discountType: ac.discountType,
                                    discountValue: ac.discountValue,
                                    minTier: "BRONZE",
                                    active: true,
                                    img: ac.img
                                  });
                                  setCouponError("");
                                }
                              }}
                              disabled={!eligible}
                              className={cn(
                                "text-[8px] font-black uppercase tracking-wider px-2 py-1 rounded-lg flex items-center space-x-1 border transition-all",
                                eligible 
                                  ? "bg-indigo-50 border-indigo-100 text-indigo-700 hover:bg-indigo-100" 
                                  : "bg-slate-50 border-slate-100 text-slate-400"
                              )}
                              title={eligible ? "Click para aplicar" : `Requiere ${ac.requiredPoints} pts`}
                            >
                              <span>{ac.img}</span>
                              <span>{ac.code} ({points}/{ac.requiredPoints} pts)</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {cart.length > 0 && (
                <div className="bg-slate-900 rounded-3xl p-6 text-white space-y-4">
                  <div className="flex justify-between items-center text-white/40 font-bold uppercase tracking-widest text-[10px]">
                    <span>Subtotal</span>
                    <span>{formatCurrency(cartTotal)}</span>
                  </div>
                  {couponDiscount > 0 && (
                    <div className="flex justify-between items-center text-emerald-400 font-bold uppercase tracking-widest text-[10px]">
                      <span>Descuento ({appliedCoupon?.code})</span>
                      <span>-{formatCurrency(couponDiscount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-end">
                    <span className="text-[10px] font-black text-white/60 uppercase tracking-widest">Monto Total</span>
                    <span className="text-2xl font-black text-white">{formatCurrency(finalTotal)}</span>
                  </div>
                  <button 
                    disabled={isProcessing || (documentType === "factura" && !selectedCustomer)}
                    onClick={handleCheckout}
                    className={cn(
                      "w-full h-16 rounded-2xl font-black uppercase tracking-widest text-xs flex items-center justify-center space-x-2 transition-all",
                      (documentType === "factura" && !selectedCustomer) ? "bg-slate-800 text-slate-500 cursor-not-allowed" : "bg-white text-slate-900"
                    )}
                  >
                    {isProcessing ? <Loader2 className="animate-spin" /> : <><CheckCircle2 size={16} /> <span>Pagar Ahora</span></>}
                  </button>
                  {documentType === "factura" && !selectedCustomer && (
                    <p className="text-center text-[10px] font-bold text-rose-400 uppercase tracking-widest">Se requiere cliente para Factura</p>
                  )}
                </div>
              )}
            </motion.div>
          )}

          {activeTab === "profile" && (
            <motion.div 
              key="profile"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="p-6 space-y-8"
            >
              <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm text-center">
                <div className="w-20 h-20 bg-indigo-50 text-indigo-600 rounded-[2rem] flex items-center justify-center mx-auto mb-4 text-2xl font-black">
                  {profile?.name?.charAt(0)}
                </div>
                <h2 className="text-xl font-black text-slate-800 tracking-tight">{profile?.name}</h2>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">
                  {profile?.role === "admin" ? "Administrador de Sistemas" :
                   profile?.role === "manager" ? "Jefe de Local / Administración" :
                   profile?.role === "seller" ? "Vendedor / Cajero" :
                   profile?.role === "logistics" ? "Operaciones y Logística" : profile?.role}
                </p>
                
                <div className="mt-8 pt-8 border-t border-slate-50 flex flex-col gap-3">
                  {profile?.role !== "seller" && (
                    <button 
                      onClick={() => window.location.href = "/"}
                      className="flex items-center justify-center space-x-3 w-full py-4 bg-slate-50 text-slate-600 rounded-2xl text-xs font-black uppercase tracking-widest border border-slate-100"
                    >
                      <Store size={16} />
                      <span>Ir a Versión PC</span>
                    </button>
                  )}
                  <button 
                    onClick={logout}
                    className="flex items-center justify-center space-x-3 w-full py-4 bg-rose-50 text-rose-600 rounded-2xl text-xs font-black uppercase tracking-widest border border-rose-100"
                  >
                    <LogOut size={16} />
                    <span>Cerrar Sesión</span>
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Mobile Success Overlay */}
      <AnimatePresence>
        {showSuccess && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-emerald-600 z-[100] flex flex-col items-center justify-center p-10 text-white text-center"
          >
            <motion.div 
              initial={{ scale: 0.5, rotate: -20 }}
              animate={{ scale: 1, rotate: 0 }}
              className="w-24 h-24 bg-white/20 rounded-full flex items-center justify-center mb-8"
            >
              <CheckCircle2 size={48} />
            </motion.div>
            <h2 className="text-3xl font-black mb-2 tracking-tight">Venta Exitosa</h2>
            <p className="text-white/60 font-medium mb-12">
              El stock ha sido actualizado.
              {emailSentTo && ` El recibo ha sido enviado a: ${emailSentTo}`}
            </p>
            <button 
              onClick={() => {
                if (lastOrder) {
                  printReceipt({
                    orderId: lastOrder.orderId,
                    timestamp: lastOrder.timestamp,
                    items: lastOrder.items,
                    total: lastOrder.total,
                    paymentMethod: lastOrder.paymentMethod || 'Efectivo',
                    customerName: lastOrder.customerName,
                    businessName: settings.businessName,
                    address: settings.address,
                    phone: settings.phone,
                    pointsEarned: calculatePoints(lastOrder.total),
                    totalPoints: lastOrder.totalPoints // We should make sure totalPoints is captured in the order object
                  });
                }
              }}
              className="w-full h-16 bg-white/20 text-white rounded-2xl font-black uppercase tracking-widest text-xs border border-white/20 mb-4 flex items-center justify-center space-x-2"
            >
              <Ticket size={18} />
              <span>Imprimir Ticket</span>
            </button>
            <button 
              onClick={() => { setShowSuccess(false); setActiveTab("shop"); }}
              className="w-full h-16 bg-white text-emerald-600 rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl shadow-emerald-800/20"
            >
              Nueva Venta
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom Navigation */}
      <nav className="bg-white border-t border-slate-100 px-6 pt-4 pb-10 flex items-center justify-around fixed bottom-0 left-0 right-0 z-50">
        <button 
          onClick={() => setActiveTab("shop")}
          className={cn(
            "flex flex-col items-center space-y-1 transition-all",
            activeTab === "shop" ? "text-indigo-600 scale-110" : "text-slate-300"
          )}
        >
          <Store size={24} />
          <span className="text-[10px] font-black uppercase tracking-tight">Tienda</span>
        </button>
        
        <button 
          onClick={() => setActiveTab("cart")}
          className={cn(
            "flex flex-col items-center space-y-1 transition-all relative",
            activeTab === "cart" ? "text-indigo-600 scale-110" : "text-slate-300"
          )}
        >
          <ShoppingCart size={24} />
          <span className="text-[10px] font-black uppercase tracking-tight">Carrito</span>
          {cartCount > 0 && (
            <span className="absolute -top-1 -right-2 bg-rose-500 text-white text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center border-2 border-white">
              {cartCount}
            </span>
          )}
        </button>

        <button 
          onClick={() => setActiveTab("profile")}
          className={cn(
            "flex flex-col items-center space-y-1 transition-all",
            activeTab === "profile" ? "text-indigo-600 scale-110" : "text-slate-300"
          )}
        >
          <User size={24} />
          <span className="text-[10px] font-black uppercase tracking-tight">Perfil</span>
        </button>
      </nav>

      {/* Customer Modal */}
      <AnimatePresence>
        {isCustomerModalOpen && (
          <div className="fixed inset-0 z-[200] flex flex-col justify-end">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsCustomerModalOpen(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              className="bg-white rounded-t-[2.5rem] relative z-10 p-8 max-h-[80vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h3 className="text-xl font-black text-slate-800 tracking-tight">Seleccionar Cliente</h3>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Para Facturación</p>
                </div>
                <button 
                  onClick={() => setIsNewCustomerMode(!isNewCustomerMode)}
                  className="bg-indigo-50 text-indigo-600 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest"
                >
                  {isNewCustomerMode ? "Volver" : "Nuevo"}
                </button>
              </div>

              {isNewCustomerMode ? (
                <form onSubmit={handleCreateCustomer} className="space-y-4">
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">Nombre / Razón Social</label>
                    <input 
                      required
                      type="text"
                      className="w-full h-14 bg-slate-50 border border-slate-100 rounded-2xl px-5 text-sm font-bold"
                      value={newCustomer.name}
                      onChange={e => setNewCustomer({...newCustomer, name: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">RUT</label>
                    <input 
                      required
                      type="text"
                      placeholder="11.111.111-K"
                      className="w-full h-14 bg-slate-50 border border-slate-100 rounded-2xl px-5 text-sm font-bold"
                      value={newCustomer.taxId}
                      onChange={e => setNewCustomer({...newCustomer, taxId: formatRUT(e.target.value)})}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">Email (para Recibo)</label>
                    <input 
                      type="email" 
                      className="w-full h-14 bg-slate-50 border border-slate-100 rounded-2xl px-5 text-sm font-bold"
                      value={newCustomer.email}
                      onChange={e => setNewCustomer({...newCustomer, email: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">Teléfono</label>
                    <input 
                      type="tel" 
                      placeholder="+56 9 XXXX XXXX"
                      className="w-full h-14 bg-slate-50 border border-slate-100 rounded-2xl px-5 text-sm font-bold"
                      value={newCustomer.phone}
                      onChange={e => setNewCustomer({...newCustomer, phone: formatChileanPhone(e.target.value)})}
                    />
                  </div>
                  <button className="w-full h-16 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-widest text-xs mt-4">
                    Guardar y Seleccionar
                  </button>
                </form>
              ) : (
                <div className="space-y-4">
                  <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                    <input 
                      type="text"
                      placeholder="Nombre, RUT o escriba PIN OTP de 6 dígitos..."
                      className="w-full h-14 bg-slate-50 border border-slate-100 rounded-2xl pl-12 pr-16 text-sm font-bold shadow-inner"
                      value={customerSearch}
                      onChange={e => setCustomerSearch(e.target.value)}
                    />
                    <button 
                      onClick={() => setIsScanningCustomer(true)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 bg-white border border-slate-100 rounded-lg flex items-center justify-center text-indigo-600 hover:bg-slate-50 active:scale-95 transition-all shadow-sm"
                      title="Escaneo Webcam - Código QR de Cliente"
                    >
                      <Camera size={14} />
                    </button>
                  </div>

                  <AnimatePresence>
                    {isScanningCustomer && (
                      <div className="bg-slate-900/10 p-3 rounded-2xl border border-slate-100 relative">
                        <p className="text-[9px] font-black text-indigo-950 uppercase tracking-wider mb-2 text-center">Enfoque el código QR de la app del cliente</p>
                        <BarcodeScanner 
                          onScan={(code) => {
                            if (code) {
                              setCustomerSearch(code);
                            }
                            setIsScanningCustomer(false);
                          }}
                          onClose={() => setIsScanningCustomer(false)}
                        />
                      </div>
                    )}
                  </AnimatePresence>
                  <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                    {filteredCustomers.map(c => (
                      <button 
                        key={c.id}
                        onClick={() => { setSelectedCustomer(c); setIsCustomerModalOpen(false); }}
                        className="w-full p-4 bg-slate-50 rounded-2xl flex items-center justify-between text-left active:bg-indigo-50 transition-colors"
                      >
                        <div>
                          <p className="font-bold text-slate-800">{c.name}</p>
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{formatRUT(c.taxId)}</p>
                        </div>
                        <ChevronLeft className="rotate-180 text-slate-300" size={16} />
                      </button>
                    ))}
                    {filteredCustomers.length === 0 && (
                      <p className="text-center py-10 text-[10px] font-black text-slate-300 uppercase tracking-widest">No se encontraron clientes</p>
                    )}
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
