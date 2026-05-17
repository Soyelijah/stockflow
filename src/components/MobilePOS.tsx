import React, { useState, useEffect, useMemo } from "react";
import { 
  collection, 
  query, 
  onSnapshot, 
  writeBatch, 
  doc, 
  addDoc,
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
  Ticket
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { useSettings } from "../contexts/SettingsContext";
import { cn, formatCurrency, formatRUT, formatChileanPhone, formatNumber, calculatePoints, getCustomerTier } from "../lib/utils";
import confetti from "canvas-confetti";

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
  const [isNewCustomerMode, setIsNewCustomerMode] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [documentType, setDocumentType] = useState<"boleta" | "factura">("boleta");
  const [paymentMethod, setPaymentMethod] = useState<"efectivo" | "tarjeta" | "transferencia" | "digital">("efectivo");
  const [activeTab, setActiveTab] = useState<"shop" | "cart" | "profile">("shop");
  const [selectedCategory, setSelectedCategory] = useState("Todos");

  const [newCustomer, setNewCustomer] = useState({
    name: "",
    taxId: "",
    email: "",
    phone: ""
  });

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
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  const addToCart = (product: any) => {
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        if (existing.quantity >= product.stock) return prev;
        return prev.map(item => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
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

  const handleCheckout = async () => {
    if (cart.length === 0 || isProcessing) return;
    setIsProcessing(true);
    try {
      const batch = writeBatch(db);
      const orderId = doc(collection(db, "transactions")).id;
      const timestamp = new Date();
      
      const orderDetails = {
        orderId,
        items: cart,
        total: cartTotal,
        paymentMethod,
        documentType,
        customerName: selectedCustomer?.name || "VENTA GENERAL",
        timestamp: timestamp.toISOString()
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
          source: "mobile_pos"
        });
      });

      // Award loyalty points and update stats automatically
      if (selectedCustomer?.id) {
        const pointsAwarded = calculatePoints(cartTotal);
        const currentPoints = (selectedCustomer.points || 0) + pointsAwarded;
        const newTier = getCustomerTier(currentPoints);
        
        const customerRef = doc(db, "customers", selectedCustomer.id);
        batch.update(customerRef, {
          points: increment(pointsAwarded),
          totalSpent: increment(cartTotal),
          segment: newTier.segment,
          lastPurchaseAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
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
      setDocumentType("boleta");
      setPaymentMethod("efectivo");
      setShowSuccess(true);
      confetti({ particleCount: 100, spread: 70, origin: { y: 0.8 } });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, "transactions (Checkout)");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-50 flex flex-col font-sans select-none">
      {/* Mobile Header */}
      <header className="bg-white px-6 pt-10 pb-4 border-b border-slate-100 flex items-center justify-between shadow-sm">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-100">
            <Store size={20} />
          </div>
          <div>
            <h1 className="text-lg font-black text-slate-800 tracking-tight leading-none">{settings.businessName}</h1>
            <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest mt-1">POS Móvil</p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          {activeTab === "shop" && (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={14} />
              <input 
                type="text"
                placeholder="Buscar..."
                className="w-32 bg-slate-50 border-none rounded-lg pl-9 pr-3 py-2 text-xs font-bold focus:ring-2 focus:ring-indigo-500 transition-all"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          )}
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto pb-32">
        <AnimatePresence mode="wait">
          {activeTab === "shop" && (
            <motion.div 
              key="shop"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="p-6 space-y-6"
            >
              {/* Category Slider */}
              <div className="flex space-x-2 overflow-x-auto no-scrollbar pb-2">
                {categories.map(cat => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={cn(
                      "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                      selectedCategory === cat ? "bg-slate-900 text-white shadow-md" : "bg-white text-slate-400 border border-slate-100"
                    )}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              {/* Product Grid */}
              <div className="grid grid-cols-1 gap-3">
                {filteredProducts.map(p => (
                  <button
                    key={p.id}
                    onClick={() => addToCart(p)}
                    className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between active:scale-95 transition-all text-left group"
                  >
                    <div className="flex items-center space-x-4">
                      <div className="w-12 h-12 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400 group-active:text-indigo-500 transition-colors">
                        <Package size={24} />
                      </div>
                      <div>
                        <p className="font-bold text-slate-800 text-sm">{p.name}</p>
                        <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">{formatCurrency(p.price)}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Stock</p>
                      <p className="font-black text-slate-800">{p.stock}</p>
                    </div>
                  </button>
                ))}
              </div>
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
                        onClick={() => setCart(prev => prev.map(i => i.id === item.id ? { ...i, quantity: Math.max(1, i.quantity - 1) } : i))}
                        className="w-8 h-8 bg-slate-50 rounded-lg flex items-center justify-center text-slate-400"
                      >
                        <Minus size={14} />
                      </button>
                      <span className="font-black text-slate-800">{item.quantity}</span>
                      <button 
                        onClick={() => setCart(prev => prev.map(i => i.id === item.id ? { ...i, quantity: Math.min(i.maxStock, i.quantity + 1) } : i))}
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
                <div className="bg-slate-900 rounded-3xl p-6 text-white space-y-4">
                  <div className="flex justify-between items-center text-white/40 font-bold uppercase tracking-widest text-[10px]">
                    <span>Subtotal</span>
                    <span>{formatCurrency(cartTotal)}</span>
                  </div>
                  <div className="flex justify-between items-end">
                    <span className="text-[10px] font-black text-white/60 uppercase tracking-widest">Monto Total</span>
                    <span className="text-2xl font-black text-white">{formatCurrency(cartTotal)}</span>
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
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">{profile?.role}</p>
                
                <div className="mt-8 pt-8 border-t border-slate-50 flex flex-col gap-3">
                  <button 
                    onClick={() => window.location.href = "/"}
                    className="flex items-center justify-center space-x-3 w-full py-4 bg-slate-50 text-slate-600 rounded-2xl text-xs font-black uppercase tracking-widest border border-slate-100"
                  >
                    <Store size={16} />
                    <span>Ir a Versión PC</span>
                  </button>
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
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">RUC / NIT / DNI</label>
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
                      placeholder="Buscar por nombre o TaxId..."
                      className="w-full h-14 bg-slate-50 border border-slate-100 rounded-2xl pl-12 pr-5 text-sm font-bold"
                      value={customerSearch}
                      onChange={e => setCustomerSearch(e.target.value)}
                    />
                  </div>
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
  );
}
