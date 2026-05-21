import React, { useState, useEffect } from "react";
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  orderBy, 
  limit,
  getDocs,
  doc,
  updateDoc,
  addDoc,
  serverTimestamp
} from "firebase/firestore";
import { db } from "@/src/lib/firebase";
import { 
  User, 
  Star, 
  History, 
  Tag, 
  LogOut, 
  ChevronRight, 
  Wallet, 
  Gift, 
  Bell,
  Search,
  ShoppingCart,
  ArrowLeft,
  Smartphone,
  Lock,
  Eye,
  EyeOff,
  AlertCircle,
  ShoppingBag,
  Plus,
  Minus,
  Trash2,
  Truck,
  Navigation,
  Receipt,
  Printer,
  Camera,
  CheckCircle,
  Clock,
  Grid,
  List,
  X
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn, formatCurrency, formatRUT, getCustomerTier, LOYALTY_TIERS, toDate } from "@/src/lib/utils";
import { Coupon, AUTOMATIC_POINT_COUPONS, AutomaticCoupon } from "@/src/lib/coupons";
import { PHYSICAL_REWARDS_CATALOGUE, PhysicalReward } from "@/src/lib/rewards";
import { ModernAlert } from "@/src/components/ui/ModernAlert";
import { QRCodeCanvas } from "qrcode.react";
import { DeliveryMap } from "@/src/components/DeliveryMap";
import { useSettings } from "@/src/contexts/SettingsContext";

export function CustomerPortal() {
  const { settings } = useSettings();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [step, setStep] = useState<"id" | "password" | "setup">("id");
  const [tempCustomer, setTempCustomer] = useState<any>(null);
  const [customer, setCustomer] = useState<any>(() => {
    try {
      const saved = localStorage.getItem("customer_session");
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      console.error("Error parsing customer session", e);
      return null;
    }
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [transactions, setTransactions] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [cart, setCart] = useState<{id: string, name: string, price: number, quantity: number, image?: string}[]>([]);
  const [activeTab, setActiveTab] = useState<"home" | "history" | "offers" | "profile" | "wallet" | "shop" | "payment" | "delivery" | "rewards">("home");
  const [redemptions, setRedemptions] = useState<any[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showCart, setShowCart] = useState(false);
  const [activatedOffers, setActivatedOffers] = useState<string[]>([]);
  const [hasUnread, setHasUnread] = useState(true);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loadingCoupons, setLoadingCoupons] = useState(true);
  const [selectedReceipt, setSelectedReceipt] = useState<any>(null);
  const [appliedCoupon, setAppliedCoupon] = useState<any | null>(null);
  const [couponInput, setCouponInput] = useState("");
  const [couponError, setCouponError] = useState("");
  const [secureToken, setSecureToken] = useState("");
  const [securePin, setSecurePin] = useState("000000");
  const [timeLeft, setTimeLeft] = useState(30);
  
  // States for Point Rewards (Physical Products Catalogue)
  const [rewardViewTab, setRewardViewTab] = useState<"available" | "vouchers">("available");
  const [confirmReward, setConfirmReward] = useState<PhysicalReward | null>(null);
  const [rewardCategory, setRewardCategory] = useState<string>("Todos");

  // States to handle larger catalogs (e.g., 1000+ products)
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("Todos");
  const [viewMode, setViewMode] = useState<"grid" | "compact">("grid");
  const [sortBy, setSortBy] = useState<"name" | "price-asc" | "price-desc" | "discount">("name");
  const [visibleCount, setVisibleCount] = useState(24);

  // Dynamic category extraction based on products
  const productCategories = React.useMemo(() => {
    const cats = new Set<string>();
    products.forEach((p) => {
      if (p.category && p.category.trim()) {
        cats.add(p.category.trim());
      }
    });
    return ["Todos", ...Array.from(cats)];
  }, [products]);

  // Decoupled, high-performance filtering and sorting for huge catalogs
  const filteredAndSortedProducts = React.useMemo(() => {
    let list = [...products].filter((p) => !p.disabled && p.stock > 0);

    // 1. Filter by category
    if (selectedCategory !== "Todos") {
      list = list.filter((p) => p.category === selectedCategory);
    }

    // 2. Filter by search text (flexible on name, category, SKU, etc)
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      list = list.filter((p) => 
        (p.name && p.name.toLowerCase().includes(q)) ||
        (p.category && p.category.toLowerCase().includes(q)) ||
        (p.sku && p.sku.toLowerCase().includes(q)) ||
        (p.id && p.id.toLowerCase().includes(q))
      );
    }

    // 3. Sorting logic
    if (sortBy === "name") {
      list.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    } else if (sortBy === "price-asc") {
      list.sort((a, b) => (a.price || 0) - (b.price || 0));
    } else if (sortBy === "price-desc") {
      list.sort((a, b) => (b.price || 0) - (a.price || 0));
    } else if (sortBy === "discount") {
      list.sort((a, b) => {
        const discA = a.wholesalePrice && a.price ? (a.price - a.wholesalePrice) / a.price : 0;
        const discB = b.wholesalePrice && b.price ? (b.price - b.wholesalePrice) / b.price : 0;
        return discB - discA;
      });
    }

    return list;
  }, [products, selectedCategory, searchTerm, sortBy]);

  // Group transactions by orderId or timestamp to show full receipts/boletas
  const groupedTransactions = React.useMemo(() => {
    const groups: { [key: string]: any } = {};

    transactions.forEach(tx => {
      let groupKey = tx.orderId;
      if (!groupKey) {
        // Fallback: group items with same timestamp and customer as a single order
        const ts = tx.timestamp?.seconds || tx.timestamp?.seconds === 0 
          ? tx.timestamp.seconds 
          : Math.floor(new Date(tx.timestamp).getTime() / 1000);
        groupKey = `ts_${ts}_${tx.customerId || 'anon'}`;
      }

      if (!groups[groupKey]) {
        groups[groupKey] = {
          orderId: tx.orderId || tx.id,
          timestamp: tx.timestamp,
          type: tx.type || "sale",
          documentType: tx.documentType || (tx.type === "app_purchase" ? "Pedido Móvil" : "Boleta Electrónica"),
          customerName: tx.customerName || "Cliente",
          customerTaxId: tx.customerTaxId || (tx.customerId === customer?.id ? customer?.taxId : null) || null,
          couponCode: tx.couponCode || null,
          discountApplied: tx.discountApplied || 0,
          finalOrderTotal: tx.finalOrderTotal || 0,
          paymentBreakdown: tx.paymentBreakdown || null,
          note: tx.note || null,
          userName: tx.userName || "Caja Auto",
          items: []
        };
      }

      // Check for duplicate items in the same grouping
      const existingItem = groups[groupKey].items.find((item: any) => item.productId === tx.productId);
      if (existingItem) {
        existingItem.quantity += tx.quantity || 1;
        existingItem.amount += tx.amount || 0;
      } else {
        groups[groupKey].items.push({
          id: tx.id,
          productId: tx.productId,
          productName: tx.productName || "Producto",
          quantity: tx.quantity || 1,
          amount: tx.amount || 0
        });
      }
    });

    return Object.values(groups).map((g: any) => {
      const totalAmount = g.items.reduce((sum: number, item: any) => sum + item.amount, 0);
      if (!g.finalOrderTotal) {
        g.finalOrderTotal = Math.max(0, totalAmount - (g.discountApplied || 0));
      }
      return g;
    }).sort((a: any, b: any) => {
      const timeA = a.timestamp?.toDate ? a.timestamp.toDate().getTime() : new Date(a.timestamp).getTime();
      const timeB = b.timestamp?.toDate ? b.timestamp.toDate().getTime() : new Date(b.timestamp).getTime();
      return timeB - timeA;
    });
  }, [transactions]);

  // Sync real-time active coupons from Firestore
  useEffect(() => {
    const q = query(collection(db, "coupons"));
    const unsub = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Coupon));
      setCoupons(docs.filter(c => c.active));
      setLoadingCoupons(false);
    }, (err) => {
      console.error("Firestore error loading active coupons in portal:", err);
      setLoadingCoupons(false);
    });
    return unsub;
  }, []);

  // Generate dynamic notifications
  const clientNotifications = React.useMemo(() => {
    if (!customer) return [];
    const list: any[] = [];
    const currentPoints = customer.points || 0;
    const tier = getCustomerTier(currentPoints);

    // 1. Transaction-based Notification
    if (transactions.length > 0) {
      const lastTx = transactions[0];
      const points = lastTx.pointsEarned || Math.floor((lastTx.amount || 0) / 1000);
      
      let timeStr = "Hace unos minutos";
      if (lastTx.timestamp) {
        try {
          const date = toDate(lastTx.timestamp);
          const diffMs = Date.now() - date.getTime();
          const diffMins = Math.floor(diffMs / 60000);
          if (diffMins < 0) {
            timeStr = "Reciente";
          } else if (diffMins < 60) {
            timeStr = diffMins <= 1 ? "Hace un momento" : `Hace ${diffMins} minutos`;
          } else if (diffMins < 1440) {
            const diffHours = Math.floor(diffMins / 60);
            timeStr = `Hace ${diffHours} hr${diffHours > 1 ? "s" : ""}`;
          } else {
            timeStr = date.toLocaleDateString("es-CL");
          }
        } catch (_) {}
      }

      list.push({
        id: `tx-${lastTx.id}`,
        title: "Puntos Recibidos",
        message: `¡Ganaste ${points} puntos en tu última compra de ${formatCurrency(lastTx.amount)}!`,
        timeText: timeStr,
        accent: "text-indigo-600 bg-indigo-50 border-indigo-100",
        icon: "puntos"
      });
    } else {
      list.push({
        id: "msg-welcome-purchase",
        title: "Bienvenido",
        message: "¡Realiza tu primera compra desde la tienda y acumula 1 punto por cada $1.000 CLP!",
        timeText: "Reciente",
        accent: "text-indigo-600 bg-indigo-50 border-indigo-100",
        icon: "puntos"
      });
    }

    // 2. Next Tier Goal Notification
    if (currentPoints < 5000) {
      let nextTierName = "";
      let pointsNeeded = 0;
      if (currentPoints < 500) {
        nextTierName = "Silver";
        pointsNeeded = 500 - currentPoints;
      } else if (currentPoints < 2000) {
        nextTierName = "Gold";
        pointsNeeded = 2000 - currentPoints;
      } else {
        nextTierName = "Platinum";
        pointsNeeded = 5000 - currentPoints;
      }
      list.push({
        id: `tier-goal-${nextTierName.toLowerCase()}`,
        title: "Meta de Nivel",
        message: `Estás a sólo ${pointsNeeded} puntos de alcanzar el nivel ${nextTierName} y desbloquear nuevos beneficios.`,
        timeText: "Meta Activa",
        accent: "text-emerald-600 bg-emerald-50 border-emerald-100",
        icon: "meta"
      });
    } else {
      list.push({
        id: "tier-plat-max",
        title: "¡Nivel Máximo!",
        message: "¡Felicitaciones! Has alcanzado el nivel Platinum, la categoría más exclusiva de StockFlow Pro.",
        timeText: "Meta Completada",
        accent: "text-emerald-600 bg-emerald-50 border-emerald-100",
        icon: "meta"
      });
    }

    // 3. Dynamic Real-time Coupons & Loyalty Benefits
    const unlockedAuto = AUTOMATIC_POINT_COUPONS.filter(c => currentPoints >= c.requiredPoints);
    const eligibleReal = coupons.filter(c => currentPoints >= ((LOYALTY_TIERS as any)[c.minTier]?.min || 0));
    
    if (unlockedAuto.length > 0 || eligibleReal.length > 0) {
      const bestAuto = unlockedAuto[unlockedAuto.length - 1];
      const itemsCount = unlockedAuto.length + eligibleReal.length;
      
      list.push({
        id: "active-coupons-alert",
        title: "Beneficio Exclusivo",
        message: bestAuto 
          ? `¡Tienes ${itemsCount} beneficios listos! Tu "${bestAuto.title}" (${bestAuto.desc}) está activo con tus ${currentPoints} puntos.`
          : `¡Tienes ${itemsCount} cupones activos de la empresa para canjear en tu próxima visita!`,
        timeText: "Activo",
        accent: "text-amber-600 bg-amber-50 border-amber-100",
        icon: "oferta"
      });
    } else {
      const nextLocked = AUTOMATIC_POINT_COUPONS.find(c => currentPoints < c.requiredPoints);
      list.push({
        id: "no-coupons-yet",
        title: "Beneficio en Camino",
        message: nextLocked 
          ? `Acumula ${nextLocked.requiredPoints - currentPoints} puntos más para desbloquear automáticamente tu "${nextLocked.title}" (${nextLocked.desc}).`
          : "¡Suma puntos con tus compras en el local para activar tus primeros cupones automáticos de fidelidad!",
        timeText: "Próximo Canje",
        accent: "text-amber-600 bg-amber-50 border-amber-100",
        icon: "oferta"
      });
    }

    return list;
  }, [customer, transactions, coupons]);

  // Handle auto-reset hasUnread when opened
  useEffect(() => {
    if (showNotifications) {
      setHasUnread(false);
    }
  }, [showNotifications]);

  // Set unread to true when transactions count updates
  useEffect(() => {
    if (transactions.length > 0) {
      setHasUnread(true);
    }
  }, [transactions.length]);

  // Rotating Dynamic QR Code security token logic
  useEffect(() => {
    if (activeTab !== "wallet" || !customer?.id) return;

    const generateNewToken = async () => {
      const expiresAt = Date.now() + 30000;
      const token = `STK:ID:${customer.taxId}:${expiresAt}`;
      setSecureToken(token);
      
      const randomPin = Math.floor(100000 + Math.random() * 900000).toString();
      setSecurePin(randomPin);
      setTimeLeft(30);

      try {
        await updateDoc(doc(db, "customers", customer.id), {
          securePin: randomPin,
          securePinExpiresAt: expiresAt
        });
      } catch (e) {
        console.error("Error updating secure PIN in Firestore:", e);
      }
    };

    generateNewToken();

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          generateNewToken();
          return 30;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [activeTab, customer?.id, customer?.taxId]);

  // Profile Edit State
  const [profileEmail, setProfileEmail] = useState("");
  const [profileType, setProfileType] = useState<"retail" | "wholesale">("retail");
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [isProfileSidebarOpen, setIsProfileSidebarOpen] = useState(false);

  useEffect(() => {
    if (customer) {
      setProfileEmail(customer.email || "");
      setProfileType(customer.type || "retail");
    }
  }, [customer]);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !customer) return;

    setIsUploadingPhoto(true);
    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64String = reader.result as string;
      try {
        await updateDoc(doc(db, "customers", customer.id), {
          photoURL: base64String,
          photoVerified: true
        });
        const updated = {
          ...customer,
          photoURL: base64String,
          photoVerified: true
        };
        setCustomer(updated);
        localStorage.setItem("customer_session", JSON.stringify(updated));
        setAlertConfig({
          isOpen: true,
          type: "success",
          title: "Foto de Perfil Verde",
          message: "Tu fotografía se ha subido y tu perfil ha sido verificado con éxito por StockFlow."
        });
      } catch (err) {
        console.error("Error updating profile photo icon", err);
        setError("Error al cargar tu foto de perfil.");
      } finally {
        setIsUploadingPhoto(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleRedeemReward = async (reward: PhysicalReward) => {
    if (!customer?.id) return;
    if ((customer.points || 0) < reward.pointsCost) {
      setAlertConfig({
        isOpen: true,
        type: "error",
        title: "Puntos Insuficientes",
        message: `Necesitas ${reward.pointsCost} puntos para canjear este premio. Actualmente tienes ${customer.points || 0} puntos.`
      });
      return;
    }

    try {
      setLoading(true);
      const newPoints = (customer.points || 0) - reward.pointsCost;
      
      const randHex = Math.random().toString(36).substring(2, 8).toUpperCase();
      const validationCode = `RDM-${reward.id.replace('rew-', '').substring(0, 4).toUpperCase()}-${randHex}`;

      // 1. Create a redemption receipt doc in Firestore
      await addDoc(collection(db, "redemptions"), {
        customerId: customer.id,
        customerName: customer.name || "Cliente",
        customerRUT: customer.taxId || "Sin RUT",
        customerEmail: customer.email || "",
        productId: reward.id,
        productName: reward.name,
        pointsCost: reward.pointsCost,
        validationCode: validationCode,
        status: "pending",
        timestamp: new Date() // Fallback timestamp to keep query and sort fully local/immediate-friendly
      });

      // 2. Subtract points from the customer document
      await updateDoc(doc(db, "customers", customer.id), {
        points: newPoints
      });

      // 3. Log a special entry in transactions
      await addDoc(collection(db, "transactions"), {
        customerId: customer.id,
        customerName: customer.name || "Cliente",
        customerTaxId: customer.taxId || "Sin RUT",
        productName: `[Canje de Premio] ${reward.name}`,
        productId: reward.id,
        quantity: 1,
        amount: 0,
        pointsAwarded: -reward.pointsCost,
        type: "redemption",
        timestamp: new Date()
      });

      setAlertConfig({
        isOpen: true,
        type: "success",
        title: "¡Canje Realizado con Éxito! 🎉",
        message: `Has canjeado ${reward.pointsCost} puntos por "${reward.name}". Muestra tu código de canje "${validationCode}" en caja para retirar tu producto físico.`
      });
      
      setRewardViewTab("vouchers");
    } catch (e: any) {
      console.error(e);
      setAlertConfig({
        isOpen: true,
        type: "error",
        title: "Error en el canje",
        message: "Ocurrió un error al procesar tu canje: " + e.message
      });
    } finally {
      setLoading(false);
      setConfirmReward(null);
    }
  };

  // Alert Modal State
  const [alertConfig, setAlertConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: "success" | "error" | "warning" | "delete" | "info";
    onConfirm?: () => void;
  }>({
    isOpen: false,
    title: "",
    message: "",
    type: "info"
  });

  useEffect(() => {
    const q = query(collection(db, "products"), orderBy("name"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    // Check for payment result in URL
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    if (token && customer) {
      verifyPayment(token);
    }
  }, [customer]);

  const verifyPayment = async (token: string) => {
    setLoading(true);
    try {
      const resp = await fetch(`/api/flow/payment-status?token=${token}`);
      const data = await resp.json();
      
      // Status codes: 1=Pending, 2=Paid
      if (data.status === 2) {
        await finalizeOrder();
      } else if (data.status === 1) {
        setError("Pago en proceso...");
      } else {
        setError("El pago no fue completado.");
      }
    } catch (err) {
      setError("Error al verificar pago.");
    } finally {
      setLoading(false);
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  };

  const finalizeOrder = async () => {
    const total = cartTotal;
    const pointsToEarn = Math.floor(total / 1000);
    
    for (const item of cart) {
      const product = products.find(p => p.id === item.id);
      const moq = product?.wholesaleMinQty || 6;
      const price = (item.quantity >= moq && product?.wholesalePrice) 
        ? Number(product.wholesalePrice) 
        : Number(item.price);

      await addDoc(collection(db, "transactions"), {
        customerId: customer.id,
        customerName: customer.name,
        customerTaxId: customer.taxId || null,
        productId: item.id,
        productName: item.name,
        amount: price * item.quantity,
        quantity: item.quantity,
        pointsEarned: pointsToEarn,
        timestamp: serverTimestamp(),
        type: "app_purchase",
        paymentStatus: "paid",
        documentType: customer.type === "wholesale" ? "Factura Electrónica" : "Boleta Electrónica"
      });
    }

    await updateDoc(doc(db, "customers", customer.id), {
      points: (customer.points || 0) + pointsToEarn
    });

    setAlertConfig({
      isOpen: true,
      type: "success",
      title: "¡Pago Confirmado!",
      message: `Gracias por tu compra. Ganaste ${pointsToEarn} puntos. Tu pedido está siendo preparado para retiro en tienda.`
    });
    setCart([]);
    setActiveTab("home");
  };

  const addToCart = (product: any) => {
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        return prev.map(item => 
          item.id === product.id 
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prev, { 
        id: product.id, 
        name: product.name, 
        price: product.price, 
        quantity: 1, 
        image: product.image 
      }];
    });
  };

  const removeFromCart = (productId: string) => {
    setCart(prev => prev.filter(item => item.id !== productId));
  };

  const updateQuantity = (id: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.id === id) {
        const newQty = Math.max(0, item.quantity + delta);
        return { ...item, quantity: newQty };
      }
      return item;
    }).filter(item => item.quantity > 0));
  };

  const handleApplyCoupon = (codeToApply: string) => {
    setCouponError("");
    const codeUpper = codeToApply.trim().toUpperCase();
    if (!codeUpper) return;

    // Reject already used coupon by this customer
    if (customer?.usedCoupons && customer.usedCoupons.includes(codeUpper)) {
      setCouponError("Este cupón ya fue utilizado en su cuenta.");
      return;
    }

    // Check automatic point-based loyalty coupon
    const autoCoupon = AUTOMATIC_POINT_COUPONS.find(c => c.code === codeUpper);
    const currentPoints = customer?.points || 0;
    
    if (autoCoupon) {
      if (currentPoints < autoCoupon.requiredPoints) {
        setCouponError(`Se requieren ${autoCoupon.requiredPoints} pts para este cupón.`);
        return;
      }
      setAppliedCoupon(autoCoupon);
      setCouponInput("");
      return;
    }

    // Check enterprise promo coupons in state
    const dbCoupon = coupons.find(c => c.code === codeUpper);
    if (dbCoupon) {
      if (!dbCoupon.active) {
        setCouponError("Este cupón no se encuentra activo.");
        return;
      }
      const minPointsNeeded = LOYALTY_TIERS[dbCoupon.minTier]?.min || 0;
      if (currentPoints < minPointsNeeded) {
        setCouponError(`Se requiere nivel ${dbCoupon.minTier} o superior para usar este cupón.`);
        return;
      }
      setAppliedCoupon(dbCoupon);
      setCouponInput("");
      return;
    }

    setCouponError("Código de cupón inválido.");
  };

  const cartTotal = cart.reduce((sum, item) => {
    const product = products.find(p => p.id === item.id);
    const moq = product?.wholesaleMinQty || 6;
    const reachedMOQ = item.quantity >= moq;
    const price = (reachedMOQ && product?.wholesalePrice) 
      ? Number(product.wholesalePrice) 
      : Number(item.price);
    return sum + (price * item.quantity);
  }, 0);

  const couponDiscount = appliedCoupon 
    ? (appliedCoupon.discountType === "percent" 
        ? Math.round(cartTotal * (appliedCoupon.discountValue / 100)) 
        : Number(appliedCoupon.discountValue)) 
    : 0;

  const finalCartTotal = Math.max(0, cartTotal - couponDiscount);

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    if (!customer || !customer.email) {
      setError("Falta información del cliente (email). Por favor inicia sesión nuevamente.");
      setAlertConfig(prev => ({ ...prev, isOpen: false }));
      return;
    }
    setLoading(true);
    setError("");
    try {
      const description = `Pedido de ${customer.name}${appliedCoupon ? ` (Cupón: ${appliedCoupon.code})` : ""}`;
      const baseUrl = window.location.origin;

      // Populate pending order details for successful Flow confirmation
      const checkoutCart = cart.map(item => {
        const p = products.find(prod => prod.id === item.id);
        const moq = p?.wholesaleMinQty || 6;
        const reachedMOQ = item.quantity >= moq;
        const price = (reachedMOQ && p?.wholesalePrice) 
          ? Number(p.wholesalePrice) 
          : Number(item.price);
        return {
          ...item,
          price: price,
          stock: p?.stock || 0,
          maxStock: p?.maxStock || 100
        };
      });

      localStorage.setItem("pending_order_cart", JSON.stringify(checkoutCart));
      localStorage.setItem("pending_order_payments", JSON.stringify([{ method: "flow", amount: finalCartTotal }]));
      if (appliedCoupon) {
        localStorage.setItem("pending_order_coupon", JSON.stringify(appliedCoupon));
      } else {
        localStorage.removeItem("pending_order_coupon");
      }
      
      const response = await fetch("/api/flow/create-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: finalCartTotal,
          email: customer.email.trim().toLowerCase(),
          description,
          externalId: `ORD-${Date.now()}`,
          baseUrl: baseUrl
        })
      });

      const data = await response.json();
      if (data.url) {
        // Close alert before redirect
        setAlertConfig(prev => ({ ...prev, isOpen: false }));
        // Brief delay for the animation
        setTimeout(() => {
          window.location.href = data.url;
        }, 800);
      } else {
        throw new Error(data.error || "No se pudo iniciar el pago");
      }
    } catch (err: any) {
      setError(err.message || "Error al procesar la compra");
      setAlertConfig(prev => ({ ...prev, isOpen: false }));
    } finally {
      // Keep loading true until redirect or show error
      if (window.location.href.includes("flow.cl")) return;
      setLoading(false);
    }
  };

  const checkIdentifier = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    
    try {
      const q = query(
        collection(db, "customers"),
        where("email", "==", identifier.trim().toLowerCase())
      );
      const snapshot = await getDocs(q);
      
      let foundCustomer: any = snapshot.empty ? null : { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
      
      if (!foundCustomer) {
        // Try precise match (as entered by user)
        const q2 = query(
          collection(db, "customers"),
          where("taxId", "==", identifier.trim().toUpperCase())
        );
        const snapshot2 = await getDocs(q2);
        
        if (!snapshot2.empty) {
          foundCustomer = { id: snapshot2.docs[0].id, ...snapshot2.docs[0].data() };
        } else {
          // Try formatted format (dots and hyphen)
          const formattedRUTInput = formatRUT(identifier.trim());
          const q3 = query(
            collection(db, "customers"),
            where("taxId", "==", formattedRUTInput)
          );
          const snapshot3 = await getDocs(q3);
          if (!snapshot3.empty) {
            foundCustomer = { id: snapshot3.docs[0].id, ...snapshot3.docs[0].data() };
          }
        }
      }

      if (!foundCustomer) {
        setError("No encontramos un perfil con ese identificador.");
        setLoading(false);
        return;
      }

      setTempCustomer(foundCustomer);
      if (!foundCustomer.password) {
        setStep("setup");
        if (foundCustomer.email) {
          setEmail(foundCustomer.email);
        } else if (identifier.includes("@")) {
          setEmail(identifier.trim().toLowerCase());
        }
      } else {
        setStep("password");
      }
    } catch (err) {
      console.error("Login Error:", err);
      setError("Error al conectar con el servidor.");
    } finally {
      setLoading(false);
    }
  };

  const verifyPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (tempCustomer.password === password) {
      const sessionData = { ...tempCustomer };
      setCustomer(sessionData);
      localStorage.setItem("customer_session", JSON.stringify(sessionData));
      setStep("id"); // reset for next time
    } else {
      setError("Contraseña incorrecta.");
    }
  };

  const setupPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 4) {
      setError("La contraseña debe tener al menos 4 caracteres.");
      return;
    }
    setLoading(true);
    try {
      const type = (e.currentTarget as any).elements.customerType.value;
      const emailValue = (e.currentTarget as any).elements.customerEmail?.value || email;
      
      if (!emailValue || !emailValue.includes("@")) {
        setError("Por favor ingresa un correo electrónico válido para procesar tus pagos.");
        setLoading(false);
        return;
      }

      await updateDoc(doc(db, "customers", tempCustomer.id), {
        password: password,
        email: emailValue.trim().toLowerCase(),
        type: type,
        updatedAt: serverTimestamp()
      });
      const updated = { ...tempCustomer, password, type, email: emailValue.trim().toLowerCase() };
      setCustomer(updated);
      localStorage.setItem("customer_session", JSON.stringify(updated));
      setStep("id");
    } catch (err) {
      setError("Error al guardar la contraseña.");
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    setCustomer(null);
    localStorage.removeItem("customer_session");
  };

  useEffect(() => {
    if (customer?.id) {
      const q = query(
        collection(db, "transactions"),
        where("customerId", "==", customer.id),
        orderBy("timestamp", "desc"),
        limit(10)
      );
      
      const unsub = onSnapshot(q, (snapshot) => {
        setTransactions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      });
      
      return unsub;
    }
  }, [customer?.id]);

  // Sync current customer document in real-time
  useEffect(() => {
    if (customer?.id) {
      const unsub = onSnapshot(doc(db, "customers", customer.id), (docSnap) => {
        if (docSnap.exists()) {
          const updated = { id: docSnap.id, ...docSnap.data() };
          // Only update if something actually changed to avoid unnecessary renders
          setCustomer((prev: any) => {
            if (!prev) return updated;
            const changed = JSON.stringify(prev) !== JSON.stringify(updated);
            if (changed) {
              localStorage.setItem("customer_session", JSON.stringify(updated));
              return updated;
            }
            return prev;
          });
        }
      });
      return unsub;
    }
  }, [customer?.id]);

  // Sync redemptions in real-time
  useEffect(() => {
    if (customer?.id) {
      const q = query(
        collection(db, "redemptions"),
        where("customerId", "==", customer.id)
      );
      const unsub = onSnapshot(q, (snapshot) => {
        const sorted = snapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() }))
          .sort((a: any, b: any) => {
            const dateA = a.timestamp?.toDate ? a.timestamp.toDate() : new Date(a.timestamp || 0);
            const dateB = b.timestamp?.toDate ? b.timestamp.toDate() : new Date(b.timestamp || 0);
            return dateB.getTime() - dateA.getTime();
          });
        setRedemptions(sorted);
      });
      return unsub;
    }
  }, [customer?.id]);

  if (!customer) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 font-sans">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-sm"
        >
          <div className="text-center mb-10">
            <div className="w-20 h-20 bg-indigo-600 rounded-[2rem] flex items-center justify-center text-white mx-auto mb-6 shadow-2xl shadow-indigo-200">
              <Smartphone size={40} />
            </div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">StockFlow <span className="text-indigo-600">CLIENTES</span></h1>
            <p className="text-slate-500 font-medium mt-2">Accede a tus beneficios con seguridad.</p>
          </div>

          <AnimatePresence mode="wait">
            {step === "id" && (
              <motion.form 
                key="id-step"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                onSubmit={checkIdentifier} 
                className="space-y-4"
              >
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Email o RUT</label>
                  <input 
                    autoFocus
                    type="text" 
                    placeholder="ej: cliente@email.com o 12.345.678-9"
                    className="w-full h-14 bg-white border border-slate-200 rounded-2xl px-5 text-sm font-bold focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-600 transition-all shadow-sm"
                    value={identifier}
                    onChange={e => setIdentifier(e.target.value)}
                  />
                </div>
                
                {error && <p className="text-[10px] font-black text-rose-500 uppercase tracking-widest text-center px-4 bg-rose-50 py-2 rounded-xl border border-rose-100">{error}</p>}

                <button 
                  type="submit"
                  disabled={loading || !identifier}
                  className="w-full h-14 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-slate-800 transition-all flex items-center justify-center space-x-2"
                >
                  {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : "Siguiente"}
                </button>
              </motion.form>
            )}

            {step === "password" && (
              <motion.form 
                key="pass-step"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                onSubmit={verifyPassword} 
                className="space-y-4"
              >
                <div className="flex items-center space-x-3 mb-6 bg-indigo-50 p-3 rounded-2xl border border-indigo-100">
                  <div className="w-8 h-8 bg-indigo-600 text-white rounded-full flex items-center justify-center text-xs font-black">
                    {tempCustomer.name.charAt(0)}
                  </div>
                  <p className="text-xs font-bold text-slate-600 truncate">{tempCustomer.name}</p>
                </div>

                <div className="space-y-1.5 relative">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Ingresa tu Contraseña</label>
                  <div className="relative">
                    <input 
                      autoFocus
                      type={showPassword ? "text" : "password"} 
                      placeholder="••••••••"
                      className="w-full h-14 bg-white border border-slate-200 rounded-2xl px-5 text-sm font-bold focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-600 transition-all shadow-sm"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                    />
                    <button 
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                {error && <p className="text-[10px] font-black text-rose-500 uppercase tracking-widest text-center px-4 bg-rose-50 py-2 rounded-xl border border-rose-100">{error}</p>}

                <div className="flex flex-col space-y-3">
                  <button 
                    type="submit"
                    className="w-full h-14 bg-indigo-600 text-white rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-indigo-500 transition-all shadow-lg shadow-indigo-100"
                  >
                    Ingresar
                  </button>
                  <button 
                    type="button"
                    onClick={() => { setStep("id"); setPassword(""); setError(""); }}
                    className="w-full h-14 bg-white text-slate-400 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-slate-50 transition-all"
                  >
                    Cambiar Usuario
                  </button>
                </div>
                
                <div className="flex flex-col space-y-4 pt-4">
                  <p className="text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    ¿Olvidaste tu contraseña?
                  </p>
                  <button 
                    type="button"
                    onClick={() => setAlertConfig({
                      isOpen: true,
                      type: "info",
                      title: "Recuperar Acceso",
                      message: "Por seguridad, solicita el reinicio de tu clave directamente en caja de nuestra tienda física con tu RUT. El cajero verificará tu identidad y reseteará tu PIN."
                    })}
                    className="w-full h-12 bg-slate-100 text-slate-600 rounded-xl font-black uppercase tracking-widest text-[9px] hover:bg-slate-200 transition-all border border-slate-200"
                  >
                    Instrucciones de Recuperación
                  </button>
                </div>
              </motion.form>
            )}

            {step === "setup" && (
              <motion.form 
                key="setup-step"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                onSubmit={setupPassword} 
                className="space-y-4"
              >
                <div className="bg-amber-50 p-6 rounded-[2rem] border border-amber-100 mb-6">
                  <div className="flex items-center space-x-2 text-amber-600 mb-2">
                    <Lock size={16} />
                    <span className="text-[10px] font-black uppercase tracking-widest">Primera vez aquí</span>
                  </div>
                  <p className="text-xs font-bold text-amber-900 leading-relaxed">
                    Hola {tempCustomer.name.split(' ')[0]}, crea una contraseña para proteger tu historial y puntos.
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Tipo de Cliente</label>
                    <select 
                      name="customerType"
                      className="w-full h-14 bg-white border border-slate-200 rounded-2xl px-5 text-sm font-bold focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-600 transition-all shadow-sm appearance-none"
                    >
                      <option value="retail">Persona Natural (Minorista)</option>
                      <option value="wholesale">Empresa (Mayorista)</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Correo Electrónico (para boletas)</label>
                    <input 
                      type="email" 
                      name="customerEmail"
                      placeholder="ejemplo@correo.com"
                      className="w-full h-14 bg-white border border-slate-200 rounded-2xl px-5 text-sm font-bold focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-600 transition-all shadow-sm"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Crea tu Contraseña</label>
                    <input 
                      autoFocus
                      type="password" 
                      placeholder="Mínimo 4 caracteres"
                      className="w-full h-14 bg-white border border-slate-200 rounded-2xl px-5 text-sm font-bold focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-600 transition-all shadow-sm"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                    />
                  </div>
                </div>

                {error && <p className="text-[10px] font-black text-rose-500 uppercase tracking-widest text-center px-4 bg-rose-50 py-2 rounded-xl border border-rose-100">{error}</p>}

                <button 
                  type="submit"
                  disabled={loading || password.length < 4}
                  className="w-full h-14 bg-emerald-600 text-white rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-emerald-500 transition-all shadow-lg shadow-emerald-100"
                >
                  {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : "Activar mi App"}
                </button>
              </motion.form>
            )}
          </AnimatePresence>

          <p className="text-center text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-12">
            StockFlow Pro • {new Date().getFullYear()}
          </p>
        </motion.div>
      </div>
    );
  }

  const tier = getCustomerTier(customer.points);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans pb-24 relative overflow-x-hidden">
      {/* Profile Sidebar Drawer */}
      <AnimatePresence>
        {isProfileSidebarOpen && (
          <div className="fixed inset-0 z-[100] flex justify-start">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsProfileSidebarOpen(false)}
              className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm"
            />

            {/* Side Drawer Panel */}
            <motion.div
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 220 }}
              className="relative w-80 h-full max-w-[85%] bg-white border-r border-slate-100 flex flex-col shadow-2xl z-10"
            >
              {/* Drawer Header */}
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div className="text-left">
                  <h3 className="text-sm font-black text-slate-800 tracking-tight leading-none">Mi Cuenta</h3>
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">Configuración y Soporte</p>
                </div>
                <button 
                  onClick={() => setIsProfileSidebarOpen(false)}
                  className="p-2 bg-white hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-xl border border-slate-150 transition-all active:scale-95 shadow-sm"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Drawer Scrollable Content */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6 no-scrollbar">
                {/* Profile Brief Card */}
                <div className="bg-white rounded-[2rem] border border-slate-150 p-5 shadow-sm space-y-4">
                  <div className="flex items-center space-x-3.5 pb-3 border-b border-slate-50">
                    <div className="relative group shrink-0">
                      <div className="w-14 h-14 bg-slate-900 rounded-2xl flex items-center justify-center text-white text-xl font-black shadow-lg overflow-hidden relative border border-slate-100">
                        {isUploadingPhoto ? (
                          <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : customer.photoURL ? (
                          <img src={customer.photoURL} alt={customer.name} className="w-full h-full object-cover" />
                        ) : (
                          customer.name?.charAt(0).toUpperCase()
                        )}
                      </div>
                      <input 
                        type="file" 
                        id="customer-photo-upload-sidebar"
                        onChange={handlePhotoUpload}
                        className="hidden" 
                        accept="image/*"
                        disabled={isUploadingPhoto}
                      />
                      <button 
                        type="button"
                        onClick={() => {
                          const el = document.getElementById("customer-photo-upload-sidebar");
                          if (el) el.click();
                        }}
                        className="absolute -bottom-1 -right-1 p-1 bg-white rounded-lg border border-slate-250 shadow-md text-slate-500 hover:text-indigo-600 hover:scale-105 active:scale-95 transition-all"
                        disabled={isUploadingPhoto}
                        title="Subir foto de perfil"
                      >
                        <Camera size={11} />
                      </button>
                    </div>
                    <div className="text-left overflow-hidden">
                      <h4 className="font-extrabold text-xs text-slate-900 truncate flex items-center gap-1.5 justify-start">
                        {customer.name}
                        {customer.photoVerified && (
                          <CheckCircle size={13} className="text-emerald-500 fill-emerald-50 shrink-0" title="Perfil Verificado" />
                        )}
                      </h4>
                      <p className="text-[9px] font-black text-indigo-600 uppercase tracking-widest leading-none mt-1">Socio {tier.name}</p>
                      {customer.photoVerified ? (
                        <span className="text-[8px] font-extrabold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100 mt-1 inline-block">✓ ID Verificado</span>
                      ) : (
                        <p className="text-[8px] font-medium text-slate-400 mt-0.5 whitespace-normal leading-tight">Sube una foto para verificar tu ID</p>
                      )}
                    </div>
                  </div>

                  {/* RUT & Contact Details (Read only) */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center bg-slate-50 p-3 rounded-2xl border border-slate-100">
                      <div className="text-left">
                        <p className="text-[7.5px] font-black text-slate-400 uppercase tracking-widest">RUT Registrado</p>
                        <p className="text-[11px] font-semibold text-slate-700">{customer.taxId}</p>
                      </div>
                      <Lock size={12} className="text-slate-350" />
                    </div>
                    {customer.phone && (
                      <div className="flex justify-between items-center bg-slate-50 p-3 rounded-2xl border border-slate-100">
                        <div className="text-left">
                          <p className="text-[7.5px] font-black text-slate-400 uppercase tracking-widest">Teléfono de Enlace</p>
                          <p className="text-[11px] font-semibold text-slate-700">{customer.phone}</p>
                        </div>
                        <Lock size={12} className="text-slate-350" />
                      </div>
                    )}
                  </div>
                </div>

                {/* Edit Contact details inside Drawer */}
                <div className="space-y-3.5">
                  <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1 text-left">Editar Datos de Contacto</h4>
                  
                  <div className="space-y-3.5 p-5 bg-slate-50 rounded-[2rem] border border-slate-150 text-left shadow-inner">
                    <div className="space-y-1">
                      <label className="text-[7.5px] font-black text-slate-450 uppercase tracking-widest ml-0.5">Correo Electrónico (Boletas/Flow)</label>
                      <input 
                        type="email" 
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-600 transition-all shadow-sm"
                        value={profileEmail}
                        onChange={(e) => setProfileEmail(e.target.value)}
                        placeholder="ejemplo@correo.com"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[7.5px] font-black text-slate-450 uppercase tracking-widest ml-0.5">Tipo de Facturación</label>
                      <select 
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-600 transition-all shadow-sm appearance-none"
                        value={profileType}
                        onChange={(e) => setProfileType(e.target.value as any)}
                      >
                        <option value="retail">Persona Natural (Minorista)</option>
                        <option value="wholesale">Empresa (Mayorista)</option>
                      </select>
                    </div>

                    <motion.button 
                      whileTap={{ scale: 0.98 }}
                      onClick={async () => {
                        if (!profileEmail.includes("@")) {
                          setAlertConfig({
                            isOpen: true,
                            type: "error",
                            title: "Correo Inválido",
                            message: "Por favor ingresa un correo electrónico válido."
                          });
                          return;
                        }
                        setIsSavingProfile(true);
                        try {
                          await updateDoc(doc(db, "customers", customer.id), { 
                            email: profileEmail.trim().toLowerCase(),
                            type: profileType
                          });
                          const updated = { 
                            ...customer, 
                            email: profileEmail.trim().toLowerCase(), 
                            type: profileType 
                          };
                          setCustomer(updated);
                          localStorage.setItem("customer_session", JSON.stringify(updated));
                          setAlertConfig({
                            isOpen: true,
                            type: "success",
                            title: "¡Perfil Guardado! 🎉",
                            message: "Tus datos de contacto se actualizaron exitosamente."
                          });
                        } catch (err) {
                          console.error("Error updating profile", err);
                          setAlertConfig({
                            isOpen: true,
                            type: "error",
                            title: "Error al guardar",
                            message: "Ocurrió un error al actualizar los datos en la base de datos."
                          });
                        } finally {
                          setIsSavingProfile(false);
                        }
                      }}
                      disabled={isSavingProfile || (profileEmail === customer.email && profileType === customer.type)}
                      className={cn(
                        "w-full py-3 rounded-xl font-black uppercase tracking-widest text-[9px] transition-all flex items-center justify-center space-x-1.5 border shadow-sm mt-3",
                        (profileEmail === customer.email && profileType === customer.type)
                          ? "bg-slate-150 text-slate-350 border-slate-200 cursor-not-allowed shadow-none"
                          : "bg-indigo-600 text-white border-indigo-700 hover:bg-indigo-700 active:scale-95"
                      )}
                    >
                      {isSavingProfile ? (
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        <>
                          <Star size={12} />
                          <span>Guardar Cambios</span>
                        </>
                      )}
                    </motion.button>
                  </div>
                </div>

                {/* Account Navigation Shortcuts */}
                <div className="space-y-2.5">
                  <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1 text-left">Accesos Cuenta</h4>
                  
                  <button
                    onClick={() => {
                      setActiveTab("rewards");
                      setIsProfileSidebarOpen(false);
                    }}
                    className="w-full flex items-center justify-between p-3.5 bg-white hover:bg-slate-50 border border-slate-150 rounded-2xl transition-all text-left group active:scale-[0.98]"
                  >
                    <div className="flex items-center space-x-3 text-slate-700 font-bold text-xs">
                      <div className="w-8 h-8 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center border border-amber-100 shadow-inner shrink-0">
                        <Gift size={15} />
                      </div>
                      <span className="group-hover:text-amber-700 font-black">Canje de Premios</span>
                    </div>
                    <ChevronRight size={14} className="text-slate-400 group-hover:translate-x-1 transition-transform" />
                  </button>

                  <button
                    onClick={() => {
                      setActiveTab("offers");
                      setIsProfileSidebarOpen(false);
                    }}
                    className="w-full flex items-center justify-between p-3.5 bg-white hover:bg-slate-50 border border-slate-150 rounded-2xl transition-all text-left group active:scale-[0.98]"
                  >
                    <div className="flex items-center space-x-3 text-slate-700 font-bold text-xs">
                      <div className="w-8 h-8 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center border border-indigo-100 shadow-inner shrink-0">
                        <Tag size={15} />
                      </div>
                      <span className="group-hover:text-indigo-750 font-black">Mis Cupones Activos</span>
                    </div>
                    <ChevronRight size={14} className="text-slate-400 group-hover:translate-x-1 transition-transform" />
                  </button>

                  <button
                    onClick={() => {
                      setActiveTab("history");
                      setIsProfileSidebarOpen(false);
                    }}
                    className="w-full flex items-center justify-between p-3.5 bg-white hover:bg-slate-50 border border-slate-150 rounded-2xl transition-all text-left group active:scale-[0.98]"
                  >
                    <div className="flex items-center space-x-3 text-slate-700 font-bold text-xs">
                      <div className="w-8 h-8 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center border border-emerald-100 shadow-inner shrink-0">
                        <History size={15} />
                      </div>
                      <span className="group-hover:text-emerald-700 font-black">Ver Mis Boletas</span>
                    </div>
                    <ChevronRight size={14} className="text-slate-400 group-hover:translate-x-1 transition-transform" />
                  </button>
                </div>

                {/* Configuration / Password Info card inside menu */}
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-150 text-left space-y-1.5">
                  <p className="text-[7.5px] font-black text-slate-400 uppercase tracking-widest">Seguridad de la Cuenta</p>
                  <p className="text-[10px] font-black text-slate-700 flex items-center gap-1">
                    <Lock size={12} className="text-slate-400" />
                    Contraseña de Acceso
                  </p>
                  <p className="text-[9px] font-medium text-slate-500 leading-normal">
                    Tu acceso móvil está resguardado de forma ultra segura. Solicita el cambio o reinicio de claves directamente en la caja física de nuestra tienda.
                  </p>
                </div>
              </div>

              {/* Drawer Footer controls */}
              <div className="p-6 border-t border-slate-100 bg-slate-50/50 flex flex-col space-y-4">
                <button
                  onClick={() => {
                    logout();
                    setIsProfileSidebarOpen(false);
                  }}
                  className="w-full py-4 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-2xl text-[9px] font-black uppercase tracking-widest border border-rose-100 transition-all flex items-center justify-center space-x-2 active:scale-95 shadow-sm shadow-rose-50"
                >
                  <LogOut size={13} />
                  <span>Cerrar Sesión Móvil</span>
                </button>
                
                <div className="text-center">
                  <p className="text-[8px] font-black text-slate-350 uppercase tracking-wider">
                    StockFlow Pro v2.5.0 • Chile
                  </p>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Header */}
      <header className="bg-white p-6 border-b border-slate-100 flex items-center justify-between sticky top-0 z-50">
        <button 
          onClick={() => setIsProfileSidebarOpen(true)}
          className="flex items-center space-x-3 text-left hover:bg-slate-50/80 p-2 -m-2 rounded-2xl transition-all duration-200 active:scale-95 group focus:outline-hidden"
        >
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white font-black text-lg overflow-hidden relative shadow-sm ring-2 ring-slate-100 group-hover:ring-indigo-100 transition-all shrink-0">
            {customer.photoURL ? (
              <img src={customer.photoURL} alt={customer.name} className="w-full h-full object-cover" />
            ) : (
              customer.name?.charAt(0).toUpperCase()
            )}
            {customer.photoVerified && (
              <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 rounded-full border border-white flex items-center justify-center text-[7px] text-white font-bold">✓</span>
            )}
          </div>
          <div className="text-left">
            <div className="flex items-center gap-1 font-bold">
              <h2 className="text-sm font-black text-slate-900 truncate max-w-[150px] group-hover:text-indigo-650 transition-colors">¡Hola, {customer.name?.split(' ')[0]}!</h2>
              <ChevronRight size={12} className="text-slate-400 group-hover:translate-x-0.5 transition-transform" />
            </div>
            <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mt-0.5">Nivel {tier.name}</p>
          </div>
        </button>

        <div className="flex items-center space-x-2">
          <button 
            onClick={() => setShowNotifications(true)}
            className="p-3 bg-slate-50 hover:bg-slate-100 rounded-2xl text-slate-400 hover:text-slate-600 transition-all relative active:scale-95"
          >
            <Bell size={18} />
            {hasUnread && (
              <div className="absolute top-3 right-3 w-2 h-2 bg-rose-500 rounded-full border-2 border-white" />
            )}
          </button>
        </div>
      </header>

      <main className="flex-1 p-6 space-y-8 max-w-md mx-auto w-full">
        <AnimatePresence mode="wait">
          {activeTab === "home" && (
            <motion.div 
              key="home"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="space-y-8"
            >
              {/* Point Card */}
              <div className={cn("rounded-[2.5rem] p-8 relative overflow-hidden shadow-2xl", tier.bg, tier.textColor)}>
                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-600/5 blur-3xl rounded-full -mr-16 -mt-16" />
                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-8">
                    <Star size={24} className={tier.color} />
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] opacity-60">Status {tier.name}</span>
                  </div>
                  <p className="text-[10px] font-black uppercase tracking-widest opacity-60 mb-1">Puntos Acumulados</p>
                  <div className="flex items-baseline space-x-2">
                    <h3 className="text-5xl font-black">{customer.points || 0}</h3>
                    <span className="text-sm font-black opacity-60">PTS</span>
                  </div>
                  
                  <div className="mt-10 pt-6 border-t border-slate-900/10">
                    <div className="flex items-center justify-between text-xs font-bold mb-2">
                      <span>Progreso al siguiente nivel</span>
                      <span className="opacity-60">{customer.points || 0} / 5000</span>
                    </div>
                    <div className={cn("h-2 rounded-full overflow-hidden", tier.name === "Platinum" ? "bg-white/10" : "bg-slate-900/10")}>
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min(100, (customer.points || 0) / 5000 * 100)}%` }}
                        className={cn("h-full shadow-lg", tier.name === "Platinum" ? "bg-white" : "bg-slate-900")}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="grid grid-cols-2 gap-4">
                <button 
                  onClick={() => setActiveTab("rewards")}
                  className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col items-center space-y-3 hover:bg-slate-50 transition-all active:scale-95"
                >
                  <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center">
                    <Gift size={24} />
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-800">Canjear</span>
                </button>
                <button 
                  onClick={() => setActiveTab("shop")}
                  className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col items-center space-y-3 active:scale-95 transition-transform"
                >
                  <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center">
                    <ShoppingCart size={24} />
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-800">Comprar</span>
                </button>
              </div>

              {/* Exclusive Offers */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Ofertas para ti</h3>
                  <button onClick={() => setActiveTab("offers")} className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">Ver Todas</button>
                </div>
                <div className="space-y-3">
                  {loadingCoupons ? (
                    <div className="space-y-3">
                      <div className="w-full h-24 bg-slate-100 rounded-[2rem] animate-pulse" />
                      <div className="w-full h-24 bg-slate-100 rounded-[2rem] animate-pulse" />
                    </div>
                  ) : (() => {
                    const eligibleRealCoupons = coupons.filter(c => {
                      const minPointsRequired = (LOYALTY_TIERS as any)[c.minTier]?.min || 0;
                      const isUsed = customer?.usedCoupons && customer.usedCoupons.includes(c.code);
                      return (customer?.points || 0) >= minPointsRequired && !isUsed;
                    }).slice(0, 2);

                    const unlockedAutoCoupons = AUTOMATIC_POINT_COUPONS.filter(c => {
                      const isUsed = customer?.usedCoupons && customer.usedCoupons.includes(c.code);
                      return (customer?.points || 0) >= c.requiredPoints && !isUsed;
                    }).slice(0, 2);
                    const nextLockedAutoCoupon = AUTOMATIC_POINT_COUPONS.find(c => (customer?.points || 0) < c.requiredPoints);

                    const hasUnlocked = eligibleRealCoupons.length > 0 || unlockedAutoCoupons.length > 0;

                    return (
                      <>
                        {/* Unlocked Automatic Point-Based Coupons */}
                        {unlockedAutoCoupons.map((auto) => (
                          <button
                            key={auto.id}
                            onClick={() => {
                              setAlertConfig({
                                isOpen: true,
                                type: "success",
                                title: auto.title,
                                message: `¡Cupón Fidelidad por Puntos Activo! Presenta el código "${auto.code}" en la caja del local para aplicar un ${auto.desc}.`
                              });
                            }}
                            className="w-full p-5 rounded-[2rem] text-left text-white flex items-center justify-between shadow-lg bg-emerald-600 shadow-emerald-100 transition-all active:scale-95 duration-200"
                          >
                            <div className="flex items-center space-x-4">
                              <div className="text-2xl">{auto.img}</div>
                              <div>
                                <h4 className="font-bold text-sm">{auto.title}</h4>
                                <p className="text-[9px] opacity-90 uppercase font-black tracking-widest mt-0.5">
                                  {auto.desc} • Código: {auto.code}
                                </p>
                              </div>
                            </div>
                            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                              <Star size={18} className="fill-current text-white" />
                            </div>
                          </button>
                        ))}

                        {/* Unlocked Real Company Coupons */}
                        {eligibleRealCoupons.map((coupon) => (
                          <button
                            key={coupon.id}
                            onClick={() => {
                              setAlertConfig({
                                isOpen: true,
                                type: "success",
                                title: coupon.title,
                                message: `¡Cupón de la Empresa Activo! Presenta el código "${coupon.code}" en caja para aplicar: ${coupon.desc}.`
                              });
                            }}
                            className="w-full p-5 rounded-[2rem] text-left text-indigo-900 border border-indigo-100 bg-indigo-50 flex items-center justify-between transition-all active:scale-95 duration-200"
                          >
                            <div className="flex items-center space-x-4">
                              <div className="text-2xl">{coupon.img || "🎟️"}</div>
                              <div>
                                <h4 className="font-bold text-sm text-indigo-950">{coupon.title}</h4>
                                <p className="text-[9px] text-indigo-600 font-black uppercase tracking-widest mt-0.5 flex flex-wrap items-center gap-1.5">
                                  <span>{coupon.desc} • Código: {coupon.code}</span>
                                  <span className="bg-emerald-100 text-emerald-800 text-[8px] font-black px-2 py-0.5 rounded-full">
                                    ✓ REGISTRADO EN SISTEMA
                                  </span>
                                </p>
                              </div>
                            </div>
                            <div className="w-10 h-10 bg-indigo-100/50 text-indigo-600 rounded-xl flex items-center justify-center">
                              <Star size={18} className="fill-current" />
                            </div>
                          </button>
                        ))}

                        {/* Always show next locked loyalty coupon progress goal if exists */}
                        {nextLockedAutoCoupon && (
                          <div className="p-5 rounded-[2rem] border border-dashed border-slate-200 bg-white shadow-sm flex items-center justify-between">
                            <div className="flex items-center space-x-4">
                              <div className="text-3xl opacity-60">{nextLockedAutoCoupon.img}</div>
                              <div>
                                <h4 className="font-bold text-xs text-slate-700">{nextLockedAutoCoupon.title}</h4>
                                <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">
                                  Faltan {nextLockedAutoCoupon.requiredPoints - (customer?.points || 0)} pts para este cupón ({nextLockedAutoCoupon.desc})
                                </p>
                                <div className="w-48 bg-slate-100 h-1.5 rounded-full mt-2 overflow-hidden">
                                  <div 
                                    className="bg-indigo-500 h-full rounded-full transition-all duration-300" 
                                    style={{ width: `${Math.min(100, ((customer?.points || 0) / nextLockedAutoCoupon.requiredPoints) * 100)}%` }}
                                  />
                                </div>
                              </div>
                            </div>
                            <div className="text-slate-300"><Lock size={16} /></div>
                          </div>
                        )}

                        {/* Show next upcoming locked company coupon if any */}
                        {coupons.filter(c => !eligibleRealCoupons.some(erc => erc.id === c.id)).slice(0, 1).map((lockedC) => {
                          const minPointsNeeded = (LOYALTY_TIERS as any)[lockedC.minTier]?.min || 0;
                          return (
                            <div key={lockedC.id} className="p-5 rounded-[2rem] border border-slate-100 bg-slate-50 flex items-center justify-between opacity-60">
                              <div className="flex items-center space-x-4">
                                <div className="text-2xl">{lockedC.img || "🎟️"}</div>
                                <div>
                                  <h4 className="font-bold text-xs text-slate-800">{lockedC.title}</h4>
                                  <p className="text-[9px] text-slate-500 font-black uppercase tracking-widest mt-0.5">
                                    Nivel {lockedC.minTier} ({minPointsNeeded} pts)
                                  </p>
                                </div>
                              </div>
                              <div className="text-slate-400"><Lock size={16} /></div>
                            </div>
                          );
                        })}

                        {!hasUnlocked && coupons.length === 0 && (
                          <div className="p-5 text-center text-slate-400 rounded-3xl bg-slate-50 border border-slate-100">
                            <p className="text-[10px] font-black uppercase tracking-widest leading-relaxed">
                              ¡Suma puntos con tus compras para activar cupones automáticos! 🛒
                            </p>
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === "shop" && (
            <motion.div 
              key="shop"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="space-y-6"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-3">
                  <button onClick={() => setActiveTab("home")} className="p-2 bg-white rounded-xl shadow-sm"><ArrowLeft size={18}/></button>
                  <h3 className="text-xl font-black text-slate-800 tracking-tight">Tienda Online</h3>
                </div>
                {cart.length > 0 && (
                  <button 
                    onClick={() => setShowCart(true)}
                    className="bg-indigo-600 text-white px-3 py-1.5 rounded-full text-[10px] font-black animate-bounce uppercase tracking-wider"
                  >
                    {cart.reduce((a, b) => a + b.quantity, 0)} Items
                  </button>
                )}
              </div>

              {error && (
                <motion.div 
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-rose-50 border border-rose-100 p-4 rounded-2xl flex items-center space-x-3 text-rose-600"
                >
                  <AlertCircle size={18} />
                  <p className="text-xs font-bold">{error}</p>
                </motion.div>
              )}

              {/* 1. High Performance Custom Search & View Toggle Density */}
              <div className="flex gap-2.5">
                <div className="relative flex-1">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Search size={16} />
                  </div>
                  <input
                    type="text"
                    placeholder="Buscar marca, nombre, SKU..."
                    value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                      setVisibleCount(24); // Instant query resets pagination offset
                    }}
                    className="w-full bg-white border border-slate-100 rounded-2xl pl-10 pr-10 py-3 text-xs font-bold text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 shadow-sm transition-all focus:outline-none"
                  />
                  {searchTerm && (
                    <button
                      onClick={() => {
                        setSearchTerm("");
                        setVisibleCount(24);
                      }}
                      className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600"
                    >
                      <X size={15} />
                    </button>
                  )}
                </div>
                <div className="bg-slate-100 p-1 rounded-2xl flex items-center shadow-inner shrink-0">
                  <button
                    onClick={() => setViewMode("grid")}
                    className={cn(
                      "p-2 rounded-xl transition-all",
                      viewMode === "grid" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-400 hover:text-slate-600"
                    )}
                    title="Vista de Cuadrícula"
                  >
                    <Grid size={16} />
                  </button>
                  <button
                    onClick={() => setViewMode("compact")}
                    className={cn(
                      "p-2 rounded-xl transition-all",
                      viewMode === "compact" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-400 hover:text-slate-600"
                    )}
                    title="Lista de Pedido Rápido"
                  >
                    <List size={16} />
                  </button>
                </div>
              </div>

              {/* 2. Horizontal Scrolling Carousel of Dynamic Categories */}
              <div className="flex space-x-2 overflow-x-auto pb-1 scrollbar-none antialiased">
                {productCategories.map((cat) => {
                  const count = cat === "Todos" 
                    ? products.filter(p => p.stock > 0).length 
                    : products.filter(p => p.category === cat && p.stock > 0).length;
                  
                  if (count === 0 && cat !== "Todos") return null;

                  return (
                    <button
                      key={cat}
                      onClick={() => {
                        setSelectedCategory(cat);
                        setVisibleCount(24);
                      }}
                      className={cn(
                        "px-4 py-2 border rounded-xl text-[10px] font-black uppercase tracking-wider whitespace-nowrap transition-all",
                        selectedCategory === cat 
                          ? "bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-100/50" 
                          : "bg-white text-slate-500 border-slate-100 hover:bg-slate-50"
                      )}
                    >
                      {cat === "Todos" ? "Todo" : cat} <span className={cn("text-[8px] ml-1 opacity-70", selectedCategory === cat ? "text-indigo-200" : "text-slate-400")}>({count})</span>
                    </button>
                  );
                })}
              </div>

              {/* 3. Result Metadata and Sort selectors */}
              <div className="flex items-center justify-between text-[9px] font-black tracking-wider text-slate-400 px-1 uppercase">
                <span>Viendo {Math.min(filteredAndSortedProducts.length, visibleCount)} de {filteredAndSortedProducts.length} productos</span>
                <div className="flex items-center space-x-1">
                  <span>Ordenar:</span>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as any)}
                    className="bg-transparent border-none text-[9px] font-black text-slate-700 focus:ring-0 p-0 pr-4 cursor-pointer focus:outline-none"
                  >
                    <option value="name">Alfabético</option>
                    <option value="price-asc">Precio: Menor a Mayor</option>
                    <option value="price-desc">Precio: Mayor a Menor</option>
                    <option value="discount">Mejor Oferta/Mayorista</option>
                  </select>
                </div>
              </div>

              {/* 4. Display of catalog based on viewport density selection */}
              {filteredAndSortedProducts.length === 0 ? (
                <div className="p-12 text-center bg-white rounded-3xl border border-slate-100 shadow-sm space-y-3">
                  <div className="text-4xl text-slate-300">🔎</div>
                  <h4 className="font-bold text-sm text-slate-700">Sin coincidencias</h4>
                  <p className="text-xs text-slate-400">Prueba ajustando la búsqueda o seleccionando otra de tus categorías.</p>
                  <button
                    onClick={() => {
                      setSearchTerm("");
                      setSelectedCategory("Todos");
                    }}
                    className="mt-2 px-5 py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all"
                  >
                    Restablecer Filtros
                  </button>
                </div>
              ) : viewMode === "grid" ? (
                <div className="grid grid-cols-2 gap-4">
                  {filteredAndSortedProducts.slice(0, visibleCount).map((product) => {
                    const cartItem = cart.find(i => i.id === product.id);
                    return (
                      <div key={product.id} className="bg-white p-4 rounded-[1.5rem] border border-slate-100 shadow-sm flex flex-col group hover:shadow-md transition-shadow">
                        <div className="aspect-square bg-slate-50 rounded-xl mb-3 flex items-center justify-center text-3xl group-hover:scale-105 transition-transform overflow-hidden relative">
                          {product.image ? (
                            <img src={product.image} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          ) : (
                            <span>{product.category === "Bebidas" ? "🥤" : product.category === "Lácteos" ? "🧀" : "🍎"}</span>
                          )}
                          {product.stock <= 5 && (
                            <span className="absolute bottom-1 right-1 bg-amber-500 text-white px-1.5 py-0.5 rounded text-[7px] font-black uppercase tracking-widest leading-none">
                              Poco Stock ({product.stock})
                            </span>
                          )}
                        </div>
                        <h4 className="text-xs font-bold text-slate-800 line-clamp-1">{product.name}</h4>
                        <div className="mt-1 mb-3">
                          <p className="text-[11px] font-black text-slate-900">
                            {formatCurrency(product.price)}
                          </p>
                          {product.wholesalePrice && product.wholesalePrice < product.price && (
                            <p className="text-[9px] font-bold text-emerald-600 mt-0.5">
                              {formatCurrency(product.wholesalePrice)} <span className="opacity-60 font-medium">bulto ({product.wholesaleMinQty || 6}+)</span>
                            </p>
                          )}
                        </div>
                        {cartItem ? (
                          <div className="mt-auto flex items-center justify-between bg-slate-50 rounded-xl p-1 border border-slate-100">
                            <motion.button 
                              whileTap={{ scale: 0.9 }}
                              onClick={() => updateQuantity(product.id, -1)}
                              className="w-10 h-10 flex items-center justify-center bg-white rounded-lg shadow-sm text-slate-400 hover:text-rose-500 transition-colors"
                            >
                              <Minus size={14} />
                            </motion.button>
                            <input 
                              type="number"
                              className="w-12 text-center bg-transparent border-none text-xs font-black text-slate-900 focus:ring-0 p-0"
                              value={cartItem.quantity}
                              onChange={(e) => {
                                const val = parseInt(e.target.value);
                                if (!isNaN(val)) {
                                  const safeVal = Math.min(product.stock, Math.max(0, val));
                                  setCart(prev => prev.map(i => i.id === product.id ? { ...i, quantity: safeVal } : i).filter(i => i.quantity > 0));
                                }
                              }}
                            />
                            <motion.button 
                              whileTap={{ scale: 0.9 }}
                              onClick={() => {
                                if (cartItem.quantity < product.stock) {
                                  updateQuantity(product.id, 1);
                                } else {
                                  setAlertConfig({
                                    isOpen: true,
                                    type: "warn",
                                    title: "Límite de Stock",
                                    message: `Únicamente hay ${product.stock} unidades de este producto en inventario.`
                                  });
                                }
                              }}
                              className="w-10 h-10 flex items-center justify-center bg-white rounded-lg shadow-sm text-slate-400 hover:text-indigo-600 transition-colors"
                            >
                              <Plus size={14} />
                            </motion.button>
                          </div>
                        ) : (
                          <button 
                            onClick={() => addToCart(product)}
                            className="mt-auto w-full py-2.5 bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-indigo-600 transition-colors"
                          >
                            Añadir
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                /* COMPACT list Layout: Perfect for Wholesale rapid adding without heavy scroll/bloat */
                <div className="space-y-2">
                  {filteredAndSortedProducts.slice(0, visibleCount).map((product) => {
                    const cartItem = cart.find(i => i.id === product.id);
                    return (
                      <div key={product.id} className="bg-white p-3 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between gap-3 hover:border-indigo-100 hover:shadow-sm transition-all">
                        <div className="flex items-center space-x-3 flex-1 min-w-0">
                          <div className="w-10 h-10 rounded-lg bg-slate-50 flex items-center justify-center text-xl shrink-0 overflow-hidden border border-slate-50">
                            {product.image ? (
                              <img src={product.image} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                            ) : (
                              <span>{product.category === "Bebidas" ? "🥤" : product.category === "Lácteos" ? "🧀" : "🍎"}</span>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <h4 className="text-xs font-bold text-slate-800 truncate leading-snug">{product.name}</h4>
                            <div className="flex items-center space-x-2 mt-0.5">
                              <span className="text-[11px] font-black text-slate-950">
                                {formatCurrency(product.price)}
                              </span>
                              {product.wholesalePrice && product.wholesalePrice < product.price && (
                                <span className="bg-emerald-50 text-emerald-700 px-1.5 py-0.2 rounded text-[7.5px] font-black leading-none">
                                  {formatCurrency(product.wholesalePrice)} xMayor ({product.wholesaleMinQty || 6}+)
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {cartItem ? (
                          <div className="flex items-center bg-slate-50 rounded-xl p-0.5 border border-slate-100 shrink-0">
                            <motion.button 
                              whileTap={{ scale: 0.9 }}
                              onClick={() => updateQuantity(product.id, -1)}
                              className="w-8 h-8 flex items-center justify-center bg-white rounded-lg shadow-sm text-slate-400 hover:text-rose-500"
                            >
                              <Minus size={11} />
                            </motion.button>
                            <input 
                              type="number"
                              className="w-9 text-center bg-transparent border-none text-[11px] font-black text-slate-900 focus:ring-0 p-0"
                              value={cartItem.quantity}
                              onChange={(e) => {
                                const val = parseInt(e.target.value);
                                if (!isNaN(val)) {
                                  const safeVal = Math.min(product.stock, Math.max(0, val));
                                  setCart(prev => prev.map(i => i.id === product.id ? { ...i, quantity: safeVal } : i).filter(i => i.quantity > 0));
                                }
                              }}
                            />
                            <motion.button 
                              whileTap={{ scale: 0.9 }}
                              onClick={() => {
                                if (cartItem.quantity < product.stock) {
                                  updateQuantity(product.id, 1);
                                } else {
                                  setAlertConfig({
                                    isOpen: true,
                                    type: "warn",
                                    title: "Límite de Stock",
                                    message: `Únicamente hay ${product.stock} unidades de este producto en el inventario.`
                                  });
                                }
                              }}
                              className="w-8 h-8 flex items-center justify-center bg-white rounded-lg shadow-sm text-slate-400 hover:text-indigo-600"
                            >
                              <Plus size={11} />
                            </motion.button>
                          </div>
                        ) : (
                          <button 
                            onClick={() => addToCart(product)}
                            className="px-4 py-2 bg-slate-900 text-white text-[9px] font-black uppercase tracking-widest rounded-xl hover:bg-indigo-600 shrink-0 transition-colors"
                          >
                            Añadir
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* 5. Pagination / Load more CTA for performance scalability with 1000+ items */}
              {filteredAndSortedProducts.length > visibleCount && (
                <div className="pt-2 text-center">
                  <button
                    onClick={() => setVisibleCount(idx => idx + 24)}
                    className="px-6 py-3 bg-white border border-slate-100 hover:bg-slate-50 text-indigo-600 text-[10px] font-black uppercase tracking-widest rounded-xl shadow-sm transition-all inline-flex items-center gap-1.5"
                  >
                    <span>Cargar más artículos</span>
                    <Plus size={14} />
                  </button>
                </div>
              )}

              <div className="h-28" />

              {/* Sticky Cart Footer overlay */}
              {cart.length > 0 && (
                <motion.div 
                  initial={{ y: 100, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="fixed bottom-24 left-6 right-6 z-50 px-0"
                >
                  <button 
                    onClick={() => setShowCart(true)}
                    className={cn(
                      "w-full bg-slate-900 text-white p-5 rounded-[2rem] shadow-2xl flex items-center justify-between group transition-all relative overflow-hidden",
                      loading && "opacity-80 scale-95"
                    )}
                    disabled={loading}
                  >
                    <div className="absolute inset-0 bg-indigo-500/10 animate-pulse" />
                    
                    <div className="flex items-center space-x-3 relative z-10">
                      <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center backdrop-blur-sm border border-white/10">
                        {loading ? (
                          <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                          <ShoppingBag size={24} />
                        )}
                      </div>
                      <div className="text-left">
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-80 text-indigo-300">
                          {loading ? "PROCESANDO..." : "REVISAR PEDIDO"}
                        </p>
                        <p className="text-lg font-black">{formatCurrency(cartTotal)}</p>
                      </div>
                    </div>
                    {!loading && (
                      <div className="bg-white/10 rounded-full p-2 relative z-10 group-hover:bg-white/20 transition-colors">
                        <ChevronRight size={28} className="translate-x-0.5" />
                      </div>
                    )}
                  </button>
                </motion.div>
              )}
            </motion.div>
          )}

          {activeTab === "wallet" && (
            <motion.div 
              key="wallet"
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 50 }}
              className="space-y-6 text-center py-6"
            >
              <div className="w-16 h-16 bg-indigo-600 rounded-[1.75rem] flex items-center justify-center text-white mx-auto shadow-xl shadow-indigo-100">
                <Wallet size={28} />
              </div>
              <div>
                <h3 className="text-xl font-black text-slate-900 tracking-tight">Tu Tarjeta Digital</h3>
                <p className="text-[11px] font-bold text-slate-500 mt-1 max-w-[280px] mx-auto leading-relaxed">
                  Presenta este código seguro en caja para identificarte y usar tus cupones sin dictar tu RUT.
                </p>
              </div>

              <div className="bg-white p-6 rounded-[2.5rem] border-2 border-slate-900 shadow-xl relative overflow-hidden max-w-[320px] mx-auto">
                {/* Security shield decoration */}
                <div className="absolute top-3 right-3 bg-indigo-50 border border-indigo-100/50 rounded-full p-1.5 flex items-center justify-center">
                  <div className="w-2 h-2 rounded-full bg-indigo-600 animate-pulse" />
                </div>
                
                {/* Dynamically rotating secure QR Code */}
                <div className="aspect-square bg-slate-50 rounded-3xl mb-4 flex flex-col items-center justify-center p-5 border border-slate-100 relative group">
                  <QRCodeCanvas 
                    value={secureToken || customer.taxId || customer.email} 
                    size={220}
                    level="H"
                    includeMargin={false}
                    className="w-full h-auto"
                  />
                </div>

                {/* Shrinking count-down timer bar indicating dynamic lifetime */}
                <div className="space-y-1.5 mb-5 px-2">
                  <div className="flex justify-between items-center text-[9px] font-black tracking-wider text-slate-400">
                    <span className="flex items-center gap-1">
                      <Clock size={10} className="text-indigo-500 animate-spin [animation-duration:8s]" />
                      CÓDIGO DINÁMICO SEGURO
                    </span>
                    <span className="text-indigo-600 font-extrabold">Se actualiza en {timeLeft}s</span>
                  </div>
                  <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                    <div 
                      className="bg-indigo-600 h-full rounded-full transition-all duration-1000 ease-linear"
                      style={{ width: `${(timeLeft / 30) * 100}%` }}
                    />
                  </div>
                </div>

                {/* 6-Digit visual OTP pin fallback */}
                <div className="bg-slate-50 border border-slate-100 p-4 rounded-2xl text-center space-y-1 shadow-inner">
                  <p className="text-[9px] font-black tracking-widest text-slate-400 uppercase">Token Numérico de Entrada</p>
                  <p className="font-mono text-2xl font-black text-indigo-600 tracking-[0.2em]">{securePin.slice(0,3)} {securePin.slice(3)}</p>
                  <p className="text-[8px] font-bold text-slate-400 leading-normal">
                    Ingreso manual en caja si el lector óptico está apagado
                  </p>
                </div>
              </div>

              <div className="flex flex-col space-y-2 max-w-[280px] mx-auto">
                <p className="text-[9px] font-bold text-emerald-600 bg-emerald-50 py-1.5 px-3 rounded-full flex items-center justify-center gap-1 border border-emerald-100">
                  <span>🛡️</span>
                  <span>Protegido contra capturas de pantalla y suplantación</span>
                </p>
                <button 
                  onClick={() => setActiveTab("home")}
                  className="text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-indigo-600 transition-colors py-2"
                >
                  Cerrar Tarjeta
                </button>
              </div>
            </motion.div>
          )}
          {activeTab === "history" && (
            <motion.div 
              key="history"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div className="flex items-center space-x-3 mb-6">
                <button onClick={() => setActiveTab("home")} className="p-2 bg-white rounded-xl shadow-sm"><ArrowLeft size={18}/></button>
                <h3 className="text-xl font-black text-slate-800 tracking-tight">Mi Historial</h3>
              </div>
              <div className="space-y-3">
                {groupedTransactions.map(receipt => {
                  const qtyTotal = receipt.items.reduce((sum: number, i: any) => sum + i.quantity, 0);
                  const displayTitle = receipt.items.map((i: any) => i.productName).join(", ");
                  const displayPoints = Math.floor(receipt.finalOrderTotal / 1000);

                  return (
                    <button 
                      key={receipt.orderId}
                      onClick={() => setSelectedReceipt(receipt)}
                      className="w-full text-left bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm flex items-center justify-between group hover:border-indigo-100 hover:shadow-md transition-all active:scale-[0.99] duration-200"
                    >
                      <div className="flex items-center space-x-4 min-w-0 flex-1">
                        <div className="w-12 h-12 bg-indigo-50/50 text-indigo-600 rounded-2xl flex items-center justify-center shrink-0 group-hover:bg-indigo-50 group-hover:text-indigo-700 transition-colors">
                          <Receipt size={20} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <h4 className="font-bold text-xs truncate text-slate-800 pr-1" title={displayTitle}>
                            {receipt.items.length === 1 
                              ? receipt.items[0].productName 
                              : `${receipt.items[0].productName} y ${receipt.items.length - 1} más`}
                          </h4>
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">
                            {toDate(receipt.timestamp).toLocaleDateString('es-CL')} • {receipt.documentType}
                          </p>
                        </div>
                      </div>
                      <div className="text-right shrink-0 flex items-center space-x-3 ml-2">
                        <div>
                          <p className="text-xs font-black text-slate-800">
                            {formatCurrency(receipt.finalOrderTotal)}
                          </p>
                          <p className="text-[8px] font-black text-emerald-500 uppercase tracking-widest">
                            +{displayPoints} Puntos
                          </p>
                        </div>
                        <ChevronRight size={16} className="text-slate-350 group-hover:text-indigo-500 group-hover:translate-x-0.5 transition-all" />
                      </div>
                    </button>
                  );
                })}
                {groupedTransactions.length === 0 && (
                  <div className="text-center py-20 opacity-30">
                    <Search size={48} className="mx-auto mb-4" />
                    <p className="text-xs font-black uppercase tracking-widest">Aún no tienes compras</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {activeTab === "rewards" && (
            <motion.div 
              key="rewards"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div className="flex items-center space-x-3 mb-4">
                <button 
                  onClick={() => setActiveTab("home")} 
                  className="p-2.5 bg-white rounded-2xl border border-slate-150 shadow-sm active:scale-95 transition-all text-slate-600 hover:text-slate-900"
                >
                  <ArrowLeft size={18}/>
                </button>
                <div className="text-left">
                  <h3 className="text-xl font-black text-slate-800 tracking-tight leading-tight">Canje de Premios Físicos</h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">Fidelidad y Regalos Directos</p>
                </div>
              </div>

              {/* Points Summary Card */}
              <div className="bg-slate-900 text-white p-6 rounded-[2.5rem] relative overflow-hidden shadow-xl shadow-slate-950/10">
                <div className="absolute right-0 bottom-0 translate-x-4 translate-y-4 opacity-10">
                  <Gift size={160} className="text-white" />
                </div>
                <div className="relative z-10 flex items-center justify-between">
                  <div className="text-left">
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Tus Puntos Disponibles</h4>
                    <div className="flex items-baseline space-x-1.5 mt-2">
                      <span className="text-5xl font-black text-amber-400 tracking-tight">{customer.points || 0}</span>
                      <span className="text-xs font-black text-slate-350">PTS</span>
                    </div>
                  </div>
                  <div className="bg-white/10 px-4 py-2.5 rounded-2xl border border-white/15 backdrop-blur-md text-right">
                    <p className="text-[8px] font-black uppercase tracking-widest text-amber-300">Equivalencia aproximada</p>
                    <p className="text-xs font-bold text-white mt-1">10 PTS = $100 CLP en productos</p>
                  </div>
                </div>
              </div>

              {/* Sub Tab Buttons */}
              <div className="flex bg-slate-100 p-1.5 rounded-2xl border border-slate-200">
                <button
                  onClick={() => setRewardViewTab("available")}
                  className={cn(
                    "flex-1 py-3 px-4 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center space-x-1.5 transition-all",
                    rewardViewTab === "available"
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-500 hover:text-slate-800"
                  )}
                >
                  <Gift size={14} />
                  <span>Catálogo de Premios</span>
                </button>
                <button
                  onClick={() => setRewardViewTab("vouchers")}
                  className={cn(
                    "flex-1 py-3 px-4 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center space-x-1.5 transition-all relative",
                    rewardViewTab === "vouchers"
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-500 hover:text-slate-800"
                  )}
                >
                  <Wallet size={14} />
                  <span>Mis Canjes Realizados</span>
                  {redemptions.filter(r => r.status === "pending").length > 0 && (
                    <span className="absolute -top-1 -right-1 w-5 h-5 bg-amber-500 text-white rounded-full text-[9px] font-black flex items-center justify-center border-2 border-white animate-bounce">
                      {redemptions.filter(r => r.status === "pending").length}
                    </span>
                  )}
                </button>
              </div>

              {rewardViewTab === "available" ? (
                <div className="space-y-6">
                  {/* Category chips */}
                  <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar -mx-4 px-4">
                    {["Todos", "Bebidas", "Lácteos", "Merch", "Otros"].map((cat) => {
                      const count = cat === "Todos" 
                        ? PHYSICAL_REWARDS_CATALOGUE.length
                        : PHYSICAL_REWARDS_CATALOGUE.filter(r => r.category === cat).length;
                      return (
                        <button
                          key={cat}
                          onClick={() => setRewardCategory(cat)}
                          className={cn(
                            "px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all border",
                            rewardCategory === cat
                              ? "bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-100"
                              : "bg-white text-slate-500 border-slate-150 hover:bg-slate-50"
                          )}
                        >
                          {cat} ({count})
                        </button>
                      );
                    })}
                  </div>

                  {/* Catalogue Grid */}
                  <div className="grid grid-cols-1 gap-4">
                    {PHYSICAL_REWARDS_CATALOGUE
                      .filter((item) => rewardCategory === "Todos" || item.category === rewardCategory)
                      .map((item) => {
                        const canRedeem = (customer.points || 0) >= item.pointsCost;
                        return (
                          <div 
                            key={item.id} 
                            className="bg-white p-5 rounded-[2.5rem] border border-slate-150 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all hover:shadow-md"
                          >
                            <div className="flex items-center space-x-4">
                              <div className="w-16 h-16 bg-slate-50 rounded-[1.5rem] flex items-center justify-center text-4xl shadow-inner shrink-0 border border-slate-100">
                                {item.emoji}
                              </div>
                              <div className="text-left">
                                <span className="text-[8px] font-extrabold text-indigo-600 bg-indigo-50 border border-indigo-100 px-2.5 py-0.5 rounded-full uppercase tracking-widest">
                                  {item.category}
                                </span>
                                <h4 className="text-sm font-black text-slate-800 tracking-tight mt-1">{item.name}</h4>
                                <p className="text-xs font-bold text-slate-400 mt-0.5">{item.description}</p>
                              </div>
                            </div>

                            <div className="flex md:flex-col items-center justify-between gap-3 pt-3 md:pt-0 border-t md:border-t-0 border-slate-100 shrink-0">
                              <div className="flex items-baseline space-x-1">
                                <span className="text-2xl font-black text-slate-800 tracking-tight">{item.pointsCost}</span>
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">PTS</span>
                              </div>

                              <button
                                disabled={!canRedeem || loading}
                                onClick={() => setConfirmReward(item)}
                                className={cn(
                                  "py-3 px-5 rounded-2xl text-[9px] font-black uppercase tracking-widest transition-all",
                                  canRedeem 
                                    ? "bg-slate-900 text-white hover:bg-indigo-600 cursor-pointer shadow-md"
                                    : "bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200"
                                )}
                              >
                                {canRedeem ? "Canjear Regalo" : `Faltan ${item.pointsCost - (customer.points || 0)} pts`}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {redemptions.length === 0 ? (
                    <div className="p-12 text-center bg-white rounded-[2.5rem] border border-slate-150 shadow-sm">
                      <div className="w-14 h-14 bg-slate-50 text-slate-300 rounded-full flex items-center justify-center mx-auto mb-3">
                        <Gift size={24} />
                      </div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Aún no tienes canjes acumulados</p>
                      <button 
                        onClick={() => setRewardViewTab("available")} 
                        className="mt-4 px-4 py-2 text-indigo-600 text-[10px] font-black uppercase tracking-widest bg-indigo-50 rounded-xl"
                      >
                        Ver Catálogo de Premios
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-6 text-left">
                      {redemptions.map((item) => (
                        <div 
                          key={item.id} 
                          className="bg-white rounded-[2.5rem] border border-slate-150 shadow-sm overflow-hidden"
                        >
                          {/* Inner Ticket Card */}
                          <div className="p-6 relative">
                            {/* Decorative punches on sides representing real lottery ticket */}
                            <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-[6px] w-3 h-6 bg-slate-50 rounded-r-full border-r border-y border-slate-150 z-20" />
                            <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-[6px] w-3 h-6 bg-slate-50 rounded-l-full border-l border-y border-slate-150 z-20" />
                            
                            <div className="flex items-start justify-between">
                              <div className="flex items-center space-x-3">
                                <div className="w-12 h-12 bg-slate-50 rounded-[1.2rem] flex items-center justify-center text-2xl shadow-inner border border-slate-100 shrink-0">
                                  {PHYSICAL_REWARDS_CATALOGUE.find(r => r.id === item.productId)?.emoji || "🎁"}
                                </div>
                                <div className="text-left">
                                  <h4 className="text-sm font-black text-slate-800 tracking-tight">{item.productName}</h4>
                                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                                    Canjeado el {item.timestamp?.toDate ? item.timestamp.toDate().toLocaleDateString('es-CL') : new Date(item.timestamp).toLocaleDateString('es-CL')}
                                  </p>
                                </div>
                              </div>

                              <div className="shrink-0">
                                {item.status === "pending" ? (
                                  <span className="bg-amber-50 text-amber-700 border border-amber-200 px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest inline-flex items-center space-x-1 animate-pulse">
                                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mr-1" />
                                    Por Retirar
                                  </span>
                                ) : (
                                  <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest inline-flex items-center">
                                    ✓ Entregado
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Ticket barcode container */}
                            <div className="mt-6 pt-5 border-t border-dashed border-slate-200 flex flex-col items-center">
                              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex flex-col items-center justify-center min-w-[150px]">
                                <QRCodeCanvas 
                                  value={JSON.stringify({ code: item.validationCode, rut: item.customerRUT, type: 'redemption' })}
                                  size={100}
                                  level="M"
                                  includeMargin={false}
                                  className="mx-auto"
                                />
                                <span className="font-mono text-sm font-black text-slate-800 tracking-wider mt-3 select-all bg-white px-3 py-1 rounded-lg border border-slate-200 shadow-inner">
                                  {item.validationCode}
                                </span>
                              </div>
                              <p className="text-[9px] font-bold text-slate-400 text-center uppercase tracking-wider mt-4 leading-relaxed max-w-[240px]">
                                {item.status === "pending" 
                                  ? "Presenta este código QR o tu RUT en caja para retirar tu producto físico inmediatamente."
                                  : "Este producto ya te fue entregado por un vendedor en la tienda de forma exitosa."}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Confirmation Bottom Modal Sheet */}
              <AnimatePresence>
                {confirmReward && (
                  <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-end justify-center">
                    <motion.div 
                      initial={{ y: "100%" }}
                      animate={{ y: 0 }}
                      exit={{ y: "100%" }}
                      transition={{ type: "spring", damping: 25, stiffness: 200 }}
                      className="bg-white w-full max-w-lg rounded-t-[3rem] border-t border-slate-200 shadow-2xl p-8 space-y-6"
                    >
                      <div className="flex items-center justify-between">
                        <h4 className="text-lg font-black text-slate-800 tracking-tight">Confirmar Canje de Regalo</h4>
                        <button 
                          onClick={() => setConfirmReward(null)}
                          className="p-2 bg-slate-50 hover:bg-slate-100 text-slate-400 rounded-full transition-all"
                        >
                          <X size={18} />
                        </button>
                      </div>

                      <div className="p-5 bg-slate-50 rounded-3xl border border-slate-100 flex items-center space-x-4">
                        <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center border border-slate-200 shadow-sm text-4xl shrink-0">
                          {confirmReward.emoji}
                        </div>
                        <div className="text-left">
                          <p className="text-[8px] font-black uppercase text-indigo-600 tracking-wider bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100 inline-block mb-1">
                            {confirmReward.category}
                          </p>
                          <h5 className="font-black text-sm text-slate-800 tracking-tight">{confirmReward.name}</h5>
                          <p className="text-xs font-bold text-slate-400">{confirmReward.description}</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4 text-center">
                        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-150">
                          <p className="text-[8px] font-black uppercase tracking-widest text-slate-400">Puntos Requeridos</p>
                          <p className="text-xl font-black text-rose-600 tracking-tight mt-1">{confirmReward.pointsCost} PTS</p>
                        </div>
                        <div className="bg-indigo-50 p-4 rounded-2xl border border-indigo-100">
                          <p className="text-[8px] font-black uppercase tracking-widest text-indigo-400">Puntos Restantes</p>
                          <p className="text-xl font-black text-indigo-600 tracking-tight mt-1">{(customer.points || 0) - confirmReward.pointsCost} PTS</p>
                        </div>
                      </div>

                      <div className="flex gap-4">
                        <button 
                          onClick={() => setConfirmReward(null)}
                          className="flex-1 py-4 bg-slate-100 border border-slate-200 text-slate-500 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 transition-all active:scale-95"
                        >
                          Cancelar
                        </button>
                        <button 
                          onClick={() => handleRedeemReward(confirmReward)}
                          className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all active:scale-95 shadow-lg shadow-indigo-100 flex items-center justify-center space-x-2"
                        >
                          <Gift size={14} />
                          <span>Confirmar Canje</span>
                        </button>
                      </div>
                    </motion.div>
                  </div>
                )}
              </AnimatePresence>
            </motion.div>
          )}

          {activeTab === "offers" && (
            <motion.div 
              key="offers"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-8"
            >
              <div className="flex items-center space-x-3 mb-6">
                <button onClick={() => setActiveTab("home")} className="p-2 bg-white rounded-xl shadow-sm"><ArrowLeft size={18}/></button>
                <h3 className="text-xl font-black text-slate-800 tracking-tight">Mis Beneficios y Cupones</h3>
              </div>

              {/* 1. SECCIÓN: CUPONES DE LA EMPRESA */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                    <Tag size={12} className="text-indigo-500" />
                    Cupones de la Empresa
                  </h4>
                  <span className="text-[9px] bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full font-black">
                    {coupons.length} ACTIVOS
                  </span>
                </div>

                {coupons.length > 0 ? (
                  <div className="grid grid-cols-1 gap-4">
                    {coupons.map((offer, idx) => {
                      const isEligible = customer.points >= (LOYALTY_TIERS as any)[offer.minTier].min;
                      const isUsed = customer?.usedCoupons && customer.usedCoupons.includes(offer.code);
                      
                      return (
                        <button 
                          key={offer.id || idx} 
                          disabled={!isEligible || isUsed}
                          onClick={() => {
                            if (activatedOffers.includes(offer.id)) {
                              setAlertConfig({
                                isOpen: true,
                                type: "info",
                                title: offer.title,
                                message: `Este beneficio ya está activo. Muestra el código "${offer.code}" en caja.`
                              });
                            } else {
                              setAlertConfig({
                                isOpen: true,
                                type: "success",
                                title: offer.title,
                                message: `¡Oferta Disponible! Presenta el código "${offer.code}" en la caja del local para aplicar el beneficio: ${offer.desc}.`,
                                onConfirm: () => setActivatedOffers(prev => [...prev, offer.id])
                              });
                            }
                          }}
                          className={cn(
                            "p-6 rounded-[2.5rem] border flex items-center space-x-6 relative overflow-hidden text-left w-full group transition-all active:scale-[0.98]", 
                            offer.color || "bg-indigo-50 border-indigo-100 text-indigo-600",
                            activatedOffers.includes(offer.id) && "ring-4 ring-indigo-500/20 opacity-80",
                            (!isEligible || isUsed) && "grayscale opacity-40 bg-slate-100 border-slate-200 text-slate-400"
                          )}
                        >
                          <div className="text-4xl">{offer.img || "🎟️"}</div>
                          <div>
                            <h4 className="font-black text-sm">{offer.title}</h4>
                            <p className="text-xs font-bold opacity-80 mt-1">{offer.desc}</p>
                            {!isEligible ? (
                              <div className="mt-2 flex items-center space-x-1 text-[8px] font-black uppercase tracking-widest text-slate-500">
                                <Lock size={10} />
                                <span>Disponible en nivel {offer.minTier}</span>
                              </div>
                            ) : isUsed ? (
                              <div className="mt-2 flex items-center gap-1.5 text-[8px] font-black uppercase tracking-widest text-slate-500 flex-wrap">
                                <span className="bg-slate-200 text-slate-700 px-1.5 py-0.2 rounded font-black tracking-normal flex items-center gap-1">
                                  ✓ YA UTILIZADO EN SU HISTORIAL
                                </span>
                              </div>
                            ) : activatedOffers.includes(offer.id) ? (
                              <div className="mt-2 flex items-center gap-1.5 text-[8px] font-black uppercase tracking-widest text-indigo-600 flex-wrap">
                                <span className="flex items-center space-x-1">
                                  <Star size={10} className="fill-current" />
                                  <span>Cupón Activo: {offer.code}</span>
                                </span>
                                <span className="bg-indigo-100 text-indigo-850 px-1.5 py-0.2 rounded font-black tracking-normal">✓ LISTO PARA CAJA</span>
                              </div>
                            ) : (
                              <div className="mt-2 flex items-center gap-1.5 text-[8px] font-black uppercase tracking-widest text-emerald-600 flex-wrap">
                                <span className="flex items-center space-x-1">
                                  <Star size={10} />
                                  <span>¡Disponible para canje! Código: {offer.code}</span>
                                </span>
                                <span className="bg-emerald-100 text-emerald-850 px-1.5 py-0.2 rounded font-black tracking-normal">✓ SISTEMA OK</span>
                              </div>
                            )}
                          </div>
                          <div className="absolute top-0 right-0 p-4">
                            {!isEligible ? <Lock size={16} className="opacity-20" /> : <Tag size={16} className="opacity-20" />}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-6 rounded-[2rem] border border-dashed border-slate-200 text-center bg-slate-50/50">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                      La empresa no cuenta con cupones promocionales configurados en este momento.
                    </p>
                  </div>
                )}
              </div>

              {/* 2. SECCIÓN: CUPONES AUTOMÁTICOS POR PUNTOS */}
              <div className="space-y-3 pt-4 border-t border-slate-100">
                <div className="space-y-1">
                  <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                    <Star size={12} className="text-amber-500 fill-amber-500" />
                    Mis Cupones Automáticos por Puntos
                  </h4>
                  <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">
                    Se activan inmediatamente según tus puntos acumulados por compra ({customer.points || 0} pts actuales)
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  {AUTOMATIC_POINT_COUPONS.map((offer) => {
                    const isEligible = (customer.points || 0) >= offer.requiredPoints;
                    const isUsed = customer?.usedCoupons && customer.usedCoupons.includes(offer.code);
                    
                    return (
                      <button 
                        key={offer.id} 
                        disabled={!isEligible || isUsed}
                        onClick={() => {
                          setAlertConfig({
                            isOpen: true,
                            type: "success",
                            title: offer.title,
                            message: `¡Puntos acumulados suficientes! Cupón Fidelidad activado automáticamente por tu historial de compras. Presenta el código "${offer.code}" en caja para aplicar un ${offer.desc}.`
                          });
                        }}
                        className={cn(
                          "p-6 rounded-[2.5rem] border flex items-center space-x-6 relative overflow-hidden text-left w-full group transition-all active:scale-[0.98]", 
                          offer.color,
                          isEligible && !isUsed ? "ring-2 ring-emerald-500/20 shadow-sm" : "grayscale opacity-40 bg-slate-100 border-slate-200 text-slate-400"
                        )}
                      >
                        <div className="text-4xl">{offer.img}</div>
                        <div>
                          <h4 className="font-black text-sm">{offer.title}</h4>
                          <p className="text-xs font-bold opacity-80 mt-1">{offer.desc}</p>
                          {!isEligible ? (
                            <div className="mt-2 flex items-center space-x-1.5 text-[8.5px] font-black uppercase tracking-widest text-slate-400">
                              <Lock size={10} />
                              <span>Requiere {offer.requiredPoints} pts (te faltan {offer.requiredPoints - (customer.points || 0)} pts)</span>
                            </div>
                          ) : isUsed ? (
                            <div className="mt-2 flex items-center gap-1.5 text-[8.5px] font-black uppercase tracking-widest text-slate-500 flex-wrap">
                              <span className="bg-slate-200 text-slate-700 px-1.5 py-0.2 rounded font-black tracking-normal">✓ YA UTILIZADO EN SU HISTORIAL</span>
                            </div>
                          ) : (
                            <div className="mt-2 flex items-center space-x-1.5 text-[8.5px] font-black uppercase tracking-widest text-emerald-600">
                              <Star size={10} className="fill-current" />
                              <span>¡Activo por Puntos! Código: {offer.code}</span>
                            </div>
                          )}
                        </div>
                        <div className="absolute top-0 right-0 p-4">
                          {!isEligible ? <Lock size={16} className="opacity-20" /> : <Star size={16} className="opacity-20 fill-current text-emerald-500" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === "delivery" && (
            <motion.div 
              key="delivery"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6 pb-24"
            >
              <div className="bg-indigo-600 text-white rounded-[2rem] p-6 shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 blur-3xl rounded-full" />
                <h3 className="text-xl font-black">🚚 Seguimiento de Despachos</h3>
                <p className="text-xs font-medium text-indigo-100 mt-2 leading-relaxed">
                  Monitorea tus encomiendas y despachos georreferenciados en tiempo real. 
                  Encuentra el estado de tu pedido (#), la comuna de entrega y el trayecto calculado.
                </p>
              </div>

              <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm p-4 md:p-6 overflow-hidden">
                <DeliveryMap />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Bottom Nav */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-xl border-t border-slate-100 px-6 py-4 flex items-center justify-between z-50 gap-1">
        <button 
          onClick={() => setActiveTab("home")}
          className={cn("flex-1 flex flex-col items-center space-y-1 transition-all", activeTab === "home" ? "text-indigo-600 scale-110 font-bold" : "text-slate-400")}
        >
          <Star size={18} />
          <span className="text-[7.5px] font-black uppercase tracking-wider">Inicio</span>
        </button>
        <button 
          onClick={() => setActiveTab("history")}
          className={cn("flex-1 flex flex-col items-center space-y-1 transition-all", activeTab === "history" ? "text-indigo-600 scale-110 font-bold" : "text-slate-400")}
        >
          <History size={18} />
          <span className="text-[7.5px] font-black uppercase tracking-wider">Boletas</span>
        </button>
        <button 
          onClick={() => setActiveTab("wallet")}
          className={cn("w-10 h-10 rounded-xl flex items-center justify-center text-white -mt-8 shadow-md transition-all shrink-0", activeTab === "wallet" ? "bg-indigo-600 scale-110" : "bg-slate-900 shadow-slate-200")}
        >
           <Wallet size={18} />
        </button>
        <button 
          onClick={() => setActiveTab("offers")}
          className={cn("flex-1 flex flex-col items-center space-y-1 transition-all", activeTab === "offers" ? "text-indigo-600 scale-110 font-bold" : "text-slate-400")}
        >
          <Tag size={18} />
          <span className="text-[7.5px] font-black uppercase tracking-wider">Cupones</span>
        </button>
        {settings.deliveryEnabled !== false && (
          <button 
            onClick={() => setActiveTab("delivery")}
            className={cn("flex-1 flex flex-col items-center space-y-1 transition-all", activeTab === "delivery" ? "text-indigo-600 scale-110 font-bold" : "text-slate-400")}
          >
            <Truck size={18} />
            <span className="text-[7.5px] font-black uppercase tracking-wider">Envíos</span>
          </button>
        )}
      </nav>

      <AnimatePresence>
        {loading && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-xl z-[200] flex flex-col items-center justify-center p-8 text-center"
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="bg-white rounded-[3rem] p-10 shadow-2xl flex flex-col items-center max-w-sm w-full"
            >
              <div className="relative mb-8">
                <div className="w-20 h-20 bg-indigo-50 rounded-[2.5rem] flex items-center justify-center text-indigo-600">
                  <ShoppingBag size={32} className="animate-bounce" />
                </div>
                <div className="absolute inset-0 rounded-[2.5rem] border-4 border-indigo-600 border-t-transparent animate-spin" />
              </div>
              
              <h3 className="text-2xl font-black text-slate-900 tracking-tight leading-tight">Preparando tu Pago</h3>
              <p className="text-sm font-bold text-slate-400 mt-4 leading-relaxed">
                Estamos conectando con el portal de Flow para procesar tu pedido de forma segura.
              </p>
              
              <div className="w-full h-1.5 bg-slate-100 rounded-full mt-8 overflow-hidden">
                <motion.div 
                  initial={{ width: "0%" }}
                  animate={{ width: "100%" }}
                  transition={{ duration: 0.8 }}
                  className="h-full bg-indigo-600 rounded-full"
                />
              </div>
              <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest mt-4">Conexión Segura Encriptada</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showCart && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[150] flex items-end sm:items-center justify-center p-4"
          >
            <motion.div 
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              className="bg-white w-full max-w-sm rounded-[2.5rem] shadow-2xl p-8 flex flex-col max-h-[90vh]"
            >
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white">
                    <ShoppingCart size={20} />
                  </div>
                  <h3 className="text-xl font-black text-slate-800">Tu Pedido</h3>
                </div>
                <button onClick={() => setShowCart(false)} className="p-2 hover:bg-slate-50 rounded-xl text-slate-400">
                  <ArrowLeft size={18} className="-rotate-90" />
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto space-y-4 pr-2 -mx-2 px-2 pb-4">
                {cart.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-slate-400 font-bold">Tu carrito está vacío</p>
                  </div>
                ) : (
                  cart.map((item) => {
                    const product = products.find(p => p.id === item.id);
                    const moq = product?.wholesaleMinQty || 6;
                    const isWholesale = item.quantity >= moq && product?.wholesalePrice;
                    const itemPrice = isWholesale ? product.wholesalePrice : item.price;
                    
                    return (
                      <div key={item.id} className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex items-center space-x-4">
                        <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center text-2xl shadow-sm overflow-hidden">
                          {product?.image ? (
                            <img src={product.image} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          ) : (
                            <span>{product?.category === "Bebidas" ? "🥤" : product?.category === "Lácteos" ? "🧀" : "🍎"}</span>
                          )}
                        </div>
                        <div className="flex-1">
                          <h4 className="text-[11px] font-black text-slate-800 line-clamp-1">{item.name}</h4>
                          <p className="text-[9px] font-bold text-slate-500">{formatCurrency(itemPrice)} / un</p>
                          {isWholesale && (
                            <span className="text-[8px] font-black text-emerald-600 uppercase tracking-tighter">Precio Mayorista</span>
                          )}
                        </div>
                        <div className="flex items-center bg-white border border-slate-200 rounded-lg p-0.5">
                           <button 
                            onClick={() => updateQuantity(item.id, -1)}
                            className="w-6 h-6 flex items-center justify-center text-slate-400 hover:text-rose-500"
                           >
                            <Minus size={10} />
                           </button>
                           <input 
                             type="number"
                             value={item.quantity}
                             onChange={(e) => {
                               const val = parseInt(e.target.value);
                               if (!isNaN(val)) {
                                 setCart(prev => prev.map(i => i.id === item.id ? { ...i, quantity: Math.max(0, val) } : i).filter(i => i.quantity > 0));
                               }
                             }}
                             className="w-8 text-center bg-transparent border-none text-[10px] font-black text-slate-800 focus:ring-0 p-0"
                           />
                           <button 
                            onClick={() => updateQuantity(item.id, 1)}
                            className="w-6 h-6 flex items-center justify-center text-slate-400 hover:text-indigo-600"
                           >
                            <Plus size={10} />
                           </button>
                        </div>
                        <button 
                          onClick={() => removeFromCart(item.id)}
                          className="p-1 text-slate-300 hover:text-rose-500 transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    );
                  })
                )}
              </div>

              {cart.length > 0 && (
                <div className="pt-6 border-t border-slate-100 space-y-4">
                  {/* Coupon section */}
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100/80 space-y-3">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                      <Tag size={12} className="text-indigo-600" />
                      <span>¿Tienes un cupón?</span>
                    </p>
                    {appliedCoupon ? (
                      <div className="flex items-center justify-between bg-indigo-50 border border-indigo-100/50 p-3 rounded-xl">
                        <div className="flex items-center gap-2">
                          <span className="text-base">{appliedCoupon.img || "🎟️"}</span>
                          <div>
                            <p className="text-[10px] font-black text-indigo-950 uppercase">{appliedCoupon.code}</p>
                            <p className="text-[9px] text-indigo-600 font-bold">{appliedCoupon.desc}</p>
                          </div>
                        </div>
                        <button 
                          onClick={() => setAppliedCoupon(null)}
                          className="text-slate-400 hover:text-rose-500 font-black text-xs px-2 py-1"
                        >
                          Quitar
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        <div className="flex gap-2">
                          <input 
                            type="text"
                            placeholder="CÓDIGO (ej. SUMMER15)"
                            value={couponInput}
                            onChange={(e) => setCouponInput(e.target.value)}
                            className="flex-1 bg-white border border-slate-200 rounded-xl px-3 py-2 text-[10px] font-black focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-600 uppercase"
                          />
                          <button 
                            onClick={() => handleApplyCoupon(couponInput)}
                            className="bg-indigo-600 text-white uppercase tracking-widest text-[9px] font-black px-4 rounded-xl hover:bg-indigo-700 active:scale-95 transition-all shrink-0"
                          >
                            Aplicar
                          </button>
                        </div>
                        {couponError && (
                          <p className="text-[9px] text-rose-500 font-extrabold ml-1">{couponError}</p>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    {appliedCoupon && (
                      <>
                        <div className="flex justify-between items-center text-xs font-bold text-slate-500">
                          <span>Subtotal</span>
                          <span>{formatCurrency(cartTotal)}</span>
                        </div>
                        <div className="flex justify-between items-center text-xs font-bold text-indigo-600">
                          <span className="flex items-center gap-1">🎟️ Descuento ({appliedCoupon.code})</span>
                          <span>-{formatCurrency(couponDiscount)}</span>
                        </div>
                      </>
                    )}
                    <div className="flex justify-between items-center pt-1.5">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Estimado</span>
                      <span className="text-xl font-black text-slate-900">{formatCurrency(finalCartTotal)}</span>
                    </div>
                  </div>

                  <button 
                    onClick={() => {
                      setShowCart(false);
                      setAlertConfig({
                        isOpen: true,
                        type: "info",
                        title: "Confirmar Pedido",
                        message: `Estás a punto de procesar tu compra por ${formatCurrency(finalCartTotal)}. Serás redirigido a Flow para realizar el pago de forma segura.`,
                        onConfirm: handleCheckout
                      });
                    }}
                    className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-slate-800 transition-all shadow-xl shadow-slate-200 flex items-center justify-center space-x-2"
                  >
                    <span>Finalizar Compra</span>
                    <ChevronRight size={16} />
                  </button>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showNotifications && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-100 flex items-end sm:items-center justify-center p-4"
          >
            <motion.div 
              initial={{ y: 100 }}
              animate={{ y: 0 }}
              exit={{ y: 100 }}
              className="bg-white w-full max-w-sm rounded-[2.5rem] shadow-2xl p-8 space-y-6"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-black text-slate-800">Notificaciones</h3>
                <button onClick={() => setShowNotifications(false)} className="p-2 hover:bg-slate-50 rounded-xl text-slate-400">
                  <ArrowLeft size={18} className="-rotate-90" />
                </button>
              </div>
              
              <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2">
                {clientNotifications.map((notif: any) => (
                  <div key={notif.id} className={cn("p-4 rounded-2xl border transition-all hover:scale-[1.01] bg-white", notif.accent.split(" ")[2], notif.accent.split(" ")[1])}>
                    <div className={cn("flex items-center space-x-2 mb-1", notif.accent.split(" ")[0])}>
                      {notif.icon === "puntos" && <Star size={12} className="fill-current" />}
                      {notif.icon === "meta" && <Gift size={12} />}
                      {notif.icon === "oferta" && <Tag size={12} />}
                      <span className="text-[8px] font-black uppercase tracking-widest">{notif.title}</span>
                    </div>
                    <p className="text-xs font-bold text-slate-700 leading-relaxed">{notif.message}</p>
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mt-2">{notif.timeText}</p>
                  </div>
                ))}
                {clientNotifications.length === 0 && (
                  <p className="text-center text-xs font-medium text-slate-400 py-6">No tienes notificaciones por ahora</p>
                )}
              </div>
              
              <button 
                onClick={() => setShowNotifications(false)}
                className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-widest text-[10px]"
              >
                Cerrar
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selectedReceipt && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-100 flex items-end sm:items-center justify-center p-4"
          >
            <motion.div
              initial={{ y: 105, scale: 0.95 }}
              animate={{ y: 0, scale: 1 }}
              exit={{ y: 105, scale: 0.95 }}
              className="bg-white w-full max-w-sm rounded-[2.5rem] shadow-2xl relative overflow-hidden flex flex-col max-h-[85vh] border border-slate-100"
            >
              {/* Header section with brand accent */}
              <div className="bg-slate-900 text-white p-6 pb-8 text-center relative shrink-0">
                <button 
                  onClick={() => setSelectedReceipt(null)} 
                  className="absolute top-4 right-4 p-2 hover:bg-white/10 rounded-full text-white/80 transition-colors"
                >
                  <ArrowLeft size={18} className="-rotate-90" />
                </button>
                <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center mx-auto mb-3">
                  <Receipt size={24} className="text-emerald-400" />
                </div>
                <h3 className="text-lg font-black tracking-tight">{settings.businessName || "Nuestra Tienda"}</h3>
                <p className="text-[10px] font-bold opacity-60 uppercase tracking-widest mt-1">Comprobante de Compra</p>
              </div>

              {/* Scrollable Receipt Body */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                
                {/* Meta details */}
                <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100 text-[11px] text-slate-600 font-bold">
                  <div className="space-y-1">
                    <p className="text-[8px] font-black text-slate-450 uppercase tracking-wider">Documento</p>
                    <p className="text-slate-800">
                      {selectedReceipt.documentType === "Factura" || selectedReceipt.documentType === "Factura Electrónica" 
                        ? "Factura Electrónica" 
                        : "Boleta Electrónica"}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[8px] font-black text-slate-450 uppercase tracking-wider">Código de Orden</p>
                    <p className="font-mono text-slate-800 truncate max-w-[130px]" title={selectedReceipt.orderId}>
                      #{selectedReceipt.orderId.substring(0, 10).toUpperCase()}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[8px] font-black text-slate-450 uppercase tracking-wider">Fecha & Hora</p>
                    <p className="text-slate-800">
                      {toDate(selectedReceipt.timestamp).toLocaleString('es-CL')}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[8px] font-black text-slate-450 uppercase tracking-wider">Atendido por</p>
                    <p className="text-slate-800 truncate">
                      {selectedReceipt.type === "app_purchase" 
                        ? "Auto-Atención App" 
                        : (selectedReceipt.userName ? `Cajero: ${selectedReceipt.userName}` : "Cajero de Turno")}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[8px] font-black text-slate-450 uppercase tracking-wider">Tipo de Compra</p>
                    <p className="text-slate-800">
                      {selectedReceipt.type === "app_purchase" ? "Pedido Online (App)" : "Compra Presencial (POS)"}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[8px] font-black text-slate-450 uppercase tracking-wider">Método de Entrega</p>
                    <p className="text-slate-800">
                      {selectedReceipt.type === "app_purchase" ? "Retiro en Local 🏬" : "Entrega Presencial 🤝"}
                    </p>
                  </div>
                </div>

                {/* Items List */}
                <div className="space-y-3">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">Detalle de Productos</p>
                  
                  <div className="divide-y divide-slate-100 bg-white border border-slate-100 rounded-2xl overflow-hidden shadow-sm">
                    {selectedReceipt.items.map((item: any) => {
                      const qty = item.quantity || 1;
                      const unitPrice = item.amount / qty;
                      return (
                        <div key={item.id} className="p-4 flex items-center justify-between text-xs hover:bg-slate-50 transition-colors">
                          <div className="space-y-1 max-w-[65%]">
                            <p className="font-bold text-slate-800 truncate">{item.productName}</p>
                            <p className="text-[10px] font-semibold text-slate-400">
                              {qty} unidad{qty > 1 ? "s" : ""} x {formatCurrency(unitPrice)}
                            </p>
                          </div>
                          <p className="font-black text-slate-900">{formatCurrency(item.amount)}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Dashed line transition */}
                <div className="relative py-2">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t-2 border-dashed border-slate-200" />
                  </div>
                  <div className="absolute left-[-2rem] top-1/2 -translate-y-1/2 w-4 h-4 bg-slate-900/60 rounded-full" />
                  <div className="absolute right-[-2rem] top-1/2 -translate-y-1/2 w-4 h-4 bg-slate-900/60 rounded-full" />
                </div>

                {/* Financial breakdown & summary */}
                <div className="space-y-2.5 px-1 bg-slate-50/50 p-4 rounded-2xl border border-slate-100 text-xs">
                  <div className="flex justify-between font-bold text-slate-600">
                    <span>Subtotal de Compra:</span>
                    <span className="text-slate-800">
                      {formatCurrency(
                        selectedReceipt.items.reduce((sum: number, it: any) => sum + it.amount, 0)
                      )}
                    </span>
                  </div>
                  
                  {selectedReceipt.couponCode && (
                    <div className="flex justify-between font-bold text-amber-600">
                      <span className="flex items-center gap-1">🏷️ Descuento ({selectedReceipt.couponCode}):</span>
                      <span>-{formatCurrency(selectedReceipt.discountApplied)}</span>
                    </div>
                  )}

                  <div className="flex justify-between items-center text-sm font-black pt-2 border-t border-slate-100 text-slate-900">
                    <span>Total Pagado:</span>
                    <span className="text-slate-950 font-mono text-base">{formatCurrency(selectedReceipt.finalOrderTotal)}</span>
                  </div>
                </div>

                {/* Fidelidad / Puntos rewarded section */}
                <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-between text-xs text-emerald-800">
                  <div className="flex items-center space-x-2.5">
                    <div className="w-8 h-8 rounded-xl bg-emerald-500/20 flex items-center justify-center text-emerald-600">
                      <Star size={16} className="fill-current text-emerald-600" />
                    </div>
                    <div>
                      <p className="font-black text-emerald-900">Puntos de Fidelidad</p>
                      <p className="text-[10px] text-emerald-600 font-semibold">Acumulados con este recibo</p>
                    </div>
                  </div>
                  <p className="text-base font-black font-mono text-emerald-600">
                    +{Math.floor(selectedReceipt.finalOrderTotal / 1000)} PTS
                  </p>
                </div>

                {/* Real-time details if digital wallet or specific notes */}
                {selectedReceipt.note && (
                  <div className="p-4 rounded-2xl bg-indigo-50/50 border border-indigo-100 text-[11px] font-semibold text-indigo-700 leading-relaxed text-center">
                    💡 {selectedReceipt.note}
                  </div>
                )}

                {/* QR of the receipt to easily scan or reference */}
                <div className="flex flex-col items-center justify-center space-y-2 py-2">
                  <div className="p-2 border border-slate-100 bg-white rounded-xl shadow-sm">
                    <QRCodeCanvas 
                      value={selectedReceipt.orderId} 
                      size={80}
                      level="M"
                      className="w-16 h-16 opacity-80"
                    />
                  </div>
                  <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Código de Verificación</span>
                </div>

              </div>

              {/* Action buttons */}
              <div className="p-6 bg-slate-50 border-t border-slate-100 flex space-x-3 shrink-0">
                <button
                  onClick={() => {
                    // Create a style-trimmed receipt plain print format
                    const itemLines = selectedReceipt.items.map((item: any) => 
                      `${item.productName} [x${item.quantity}] \t\t ${formatCurrency(item.amount)}`
                    ).join('\n');
                    
                    const docTypeLabel = selectedReceipt.documentType === "Factura" || selectedReceipt.documentType === "Factura Electrónica" 
                      ? "FACTURA ELECTRÓNICA" 
                      : "BOLETA ELECTRÓNICA";
                    
                    const deliveryMethodText = selectedReceipt.type === "app_purchase" 
                      ? "Retiro en Local" 
                      : "Entrega Presencial en Caja";
                    
                    const purchaseTypeText = selectedReceipt.type === "app_purchase" 
                      ? "Pedido Online (App)" 
                      : "Compra Presencial (POS)";
                    
                    const attendedByText = selectedReceipt.type === "app_purchase" 
                      ? "Auto-Atención App" 
                      : (selectedReceipt.userName ? `Cajero: ${selectedReceipt.userName}` : "Cajero de Turno");

                    const receiptText = `
----------------------------------------
   ${(settings.businessName || "NUESTRA TIENDA").toUpperCase()}
----------------------------------------
Documento:     ${docTypeLabel}
Orden ID:      #${selectedReceipt.orderId}
Fecha:         ${toDate(selectedReceipt.timestamp).toLocaleString('es-CL')}
Cliente:       ${selectedReceipt.customerName}
RUT Cliente:   ${selectedReceipt.customerTaxId || "N/A"}
----------------------------------------
Canal Compra:  ${purchaseTypeText}
Entrega:       ${deliveryMethodText}
Atendido Por:  ${attendedByText}
----------------------------------------
DETALLE DE PRODUCTOS:
${itemLines}
----------------------------------------
Subtotal:      ${formatCurrency(selectedReceipt.items.reduce((sum: number, it: any) => sum + it.amount, 0))}
Descuento:     ${selectedReceipt.couponCode ? `(${selectedReceipt.couponCode}) -${formatCurrency(selectedReceipt.discountApplied)}` : 'N/A'}
TOTAL NETO:    ${formatCurrency(selectedReceipt.finalOrderTotal)}
----------------------------------------
Beneficio:     +${Math.floor(selectedReceipt.finalOrderTotal / 1000)} Puntos de Fidelidad
----------------------------------------
      ¡Gracias por tu preferencia!
----------------------------------------
                    `;
                    const win = window.open("", "_blank");
                    if (win) {
                      win.document.write(`<pre style="font-family: monospace; font-size: 14px; padding: 20px;">${receiptText}</pre>`);
                      win.document.close();
                      win.print();
                    }
                  }}
                  className="flex-1 py-3 border border-slate-200 text-slate-700 bg-white hover:bg-slate-50 transition-colors rounded-xl font-bold text-[11px] flex items-center justify-center gap-1.5"
                >
                  <Printer size={14} />
                  Imprimir
                </button>
                <button
                  onClick={() => setSelectedReceipt(null)}
                  className="flex-1 py-3 bg-slate-900 hover:bg-slate-800 text-white transition-colors rounded-xl font-black uppercase tracking-widest text-[10px]"
                >
                  Cerrar
                </button>
              </div>

            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <ModernAlert 
        isOpen={alertConfig.isOpen}
        onClose={() => setAlertConfig(prev => ({ ...prev, isOpen: false }))}
        onConfirm={alertConfig.onConfirm}
        title={alertConfig.title}
        message={alertConfig.message}
        type={alertConfig.type}
        confirmText={alertConfig.title === "Confirmar Pedido" ? "Pagar con Flow" : "Aceptar"}
      />
    </div>
  );
}
