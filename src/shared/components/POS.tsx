import React, { useState, useEffect, useMemo } from "react";
import { 
  collection, 
  query, 
  onSnapshot, 
  writeBatch, 
  doc, 
  addDoc,
  getDoc,
  serverTimestamp,
  increment,
  orderBy,
  arrayUnion,
  runTransaction
} from "firebase/firestore";
import { motion, AnimatePresence } from "motion/react";
import { db, handleFirestoreError, OperationType } from "../../lib/firebase";
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
  Cpu,
  Users,
  FileText,
  Ticket,
  ChevronRight,
  Store,
  Camera
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useAuth } from "../../contexts/AuthContext";
import { useSettings } from "../../contexts/SettingsContext";
import { BarcodeScanner } from "./ui/BarcodeScanner";
import { cn, formatCurrency, formatRUT, formatChileanPhone, formatNumber, getCustomerTier, calculatePoints } from "../../lib/utils";
import confetti from "canvas-confetti";
import { CashRegisterManagement } from "./CashRegister";
import { MercadoPagoWallet } from "./MercadoPagoWallet";
import { printReceipt } from "../../lib/printUtils";
import { ModernAlert } from "./ui/ModernAlert";
import { AUTOMATIC_POINT_COUPONS } from "../../lib/coupons";

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
  transferencia: number;
  digital: number;
}

export function POS() {
  const { profile, user } = useAuth();
  const { settings } = useSettings();
  const [products, setProducts] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [cart, setCart] = useState<CartItem[]>(() => {
    try {
      const saved = localStorage.getItem("pos_active_cart_standard");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [isProcessing, setIsProcessing] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>("Todos");
  
  // Invoicing States
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [documentType, setDocumentType] = useState<"boleta" | "factura">("boleta");
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [isScanningCustomer, setIsScanningCustomer] = useState(false);
  const [isNewCustomerMode, setIsNewCustomerMode] = useState(false);
  const [newCustomer, setNewCustomer] = useState({
    name: "",
    taxId: "",
    email: "",
    phone: "",
    address: ""
  });
  
  // Payment States
  const [payments, setPayments] = useState<PaymentBreakdown>({
    efectivo: 0,
    tarjeta: 0,
    transferencia: 0,
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

  // Promo Coupons State
  const [promoCode, setPromoCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<any>(null);
  const [couponError, setCouponError] = useState("");

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
          active: true
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
      setCouponError("");
    } catch (err) {
      setCouponError("Error al validar");
    }
  };

  // Cash Register State
  const [isCashRegisterOpen, setIsCashRegisterOpen] = useState(false);
  const [currentSession, setCurrentSession] = useState<any>(null);

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
    localStorage.setItem("pos_active_cart_standard", JSON.stringify(cart));
  }, [cart]);

  useEffect(() => {
    let interval: any;
    if (showFlowModal && flowToken && flowStatus === "pending") {
      interval = setInterval(async () => {
        try {
          const token = await user?.getIdToken();
          const res = await fetch(`/api/flow/payment-status?token=${flowToken}`, {
            headers: token ? { "Authorization": `Bearer ${token}` } : {}
          });
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

    const qCust = query(collection(db, "customers"), orderBy("name"));
    const unsubCust = onSnapshot(qCust, (snapshot) => {
      setCustomers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "customers (POS)");
    });

    return () => {
      unsub();
      unsubCust();
    };
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
    const barcodeMatch = (p.barcode && p.barcode.includes(searchTerm)) || (p.barcodes && p.barcodes.some((bc: string) => bc.includes(searchTerm)));
    const categoryMatch = selectedCategory === "Todos" || p.category === selectedCategory;
    return Number(p.stock) > 0 && (nameMatch || skuMatch || barcodeMatch) && categoryMatch;
  }), [products, searchTerm, selectedCategory]);

  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(customerSearch.toLowerCase()) || 
    c.taxId?.includes(customerSearch)
  ).slice(0, 5);

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const docRef = await addDoc(collection(db, "customers"), {
        ...newCustomer,
        rut: newCustomer.taxId, // Save rut field as well for layout searches and display consistency
        createdAt: serverTimestamp()
      });
      setSelectedCustomer({ id: docRef.id, ...newCustomer });
      setShowCustomerModal(false);
      setIsNewCustomerMode(false);
      setNewCustomer({ name: "", taxId: "", email: "", phone: "", address: "" });
    } catch (err) {
      setAlertConfig({
        isOpen: true,
        type: "error",
        title: "Error",
        message: "No se pudo registrar al nuevo cliente."
      });
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
          setAlertConfig({
            isOpen: true,
            type: "error",
            title: "🔐 Token Expirado",
            message: "El código QR presentado por el cliente ha vencido. Solicite que abra su tarjeta digital nuevamente para actualizar el código."
          });
          setCustomerSearch("");
          return;
        }
        
        const found = customers.find(c => c.taxId === taxId);
        if (found) {
          const scannedBalance = parts[4] !== undefined ? Number(parts[4]) : (found.balance ?? 25000);
          const updatedFound = { ...found, balance: scannedBalance };
          setSelectedCustomer(updatedFound);
          setCustomerSearch("");
          setShowCustomerModal(false);
          setAlertConfig({
            isOpen: true,
            type: "success",
            title: "🔐 Wallet Unificada",
            message: `Identidad verificada para ${found.name}. Token dinámico válido. Saldo disponible: $${scannedBalance.toLocaleString("es-CL")}.`
          });
        } else {
          setAlertConfig({
            isOpen: true,
            type: "error",
            title: "Cliente No Registrado",
            message: `El RUT ${taxId} decodificado no está registrado en el sistema de la empresa.`
          });
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
        setShowCustomerModal(false);
        setAlertConfig({
          isOpen: true,
          type: "success",
          title: "🔑 PIN Verificado",
          message: `Código temporal validado con éxito. Cliente: ${matchedCustomer.name}.`
        });
      }
    }
  }, [customerSearch, customers]);

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
          const product = products.find(p => p.barcode === barcode || (p.barcodes && p.barcodes.includes(barcode)));
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
    if (!isCashRegisterOpen) {
      alert("⚠ Operación Bloqueada: Por favor define el Monto Inicial de Apertura para abrir la caja antes de agregar productos al carro.");
      return;
    }
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      
      const isWholesaleEligible = (selectedCustomer?.type === "wholesale" || true) && // Can be tuned to allow anyone or only bulk accounts
                                  (product.wholesaleMinQty ? (existing ? existing.quantity + 1 : 1) >= product.wholesaleMinQty : false);

      const price = isWholesaleEligible
        ? Number(product.wholesalePrice)
        : Number(product.price) || 0;

      if (existing) {
        if (existing.quantity >= product.stock) return prev;
        return prev.map(item => 
          item.id === product.id ? { ...item, quantity: item.quantity + 1, price } : item
        );
      }
      return [...prev, { 
        id: product.id, 
        name: product.name, 
        price: price, 
        costPrice: Number(product.costPrice) || 0,
        quantity: 1, 
        maxStock: product.stock,
        image: product.image
      }];
    });
  };

  // Recalculate cart prices when customer changes
  useEffect(() => {
    setCart(prev => prev.map(item => {
      const product = products.find(p => p.id === item.id);
      if (!product) return item;
      
      const newPrice = (selectedCustomer?.type === "wholesale" && product.wholesalePrice)
        ? Number(product.wholesalePrice)
        : Number(product.price) || 0;
      
      return { ...item, price: newPrice };
    }));
  }, [selectedCustomer, products]);

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
  const couponDiscount = appliedCoupon ? (appliedCoupon.discountType === "percent" ? Math.round(cartTotal * (appliedCoupon.discountValue / 100)) : appliedCoupon.discountValue) : 0;
  const finalTotal = Math.max(0, cartTotal - couponDiscount);
  const paidTotal = payments.efectivo + payments.tarjeta + payments.transferencia + payments.digital;
  const remaining = Math.max(0, finalTotal - paidTotal);
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
      efectivo: finalTotal,
      tarjeta: 0,
      transferencia: 0,
      digital: 0
    });
    setCashReceived(finalTotal.toString());
  };

  const handlePrint = (order: any) => {
    if (!order) return;
    
    printReceipt({
      orderId: order.id,
      timestamp: order.timestamp,
      items: order.items,
      total: order.total,
      paymentMethod: order.paymentMethod || Object.entries(order.payments || {})
        .filter(([_, val]) => (val as number) > 0)
        .map(([key, _]) => key)
        .join(", ") || 'Efectivo',
      customerName: order.customer?.name,
      businessName: settings.businessName,
      address: settings.address,
      phone: settings.phone,
      pointsEarned: calculatePoints(order.total),
      totalPoints: order.customer ? (order.customer.points || 0) + calculatePoints(order.total) : undefined
    });
  };


  const handleCheckout = async () => {
    if (cart.length === 0 || isProcessing) return;
    if (paidTotal < finalTotal) {
      setAlertConfig({
        isOpen: true,
        type: "warning",
        title: "Pago Incompleto",
        message: "El monto pagado es menor al total de la venta con descuento. Por favor verifique los montos ingresados."
      });
      return;
    }

    // Handle Flow QR Payment if there's digital portion
    if (payments.digital > 0) {
      if (payments.digital < 350) {
        setAlertConfig({
          isOpen: true,
          type: "warning",
          title: "Monto Mínimo Flow",
          message: "El monto mínimo para pagos digitales (Flow) es de $350 CLP por transacción."
        });
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
      setAlertConfig({
        isOpen: true,
        type: "warning",
        title: "Monto Mínimo Flow",
        message: "El monto mínimo para cobrar con Flow es de $350 CLP."
      });
      return;
    }
    try {
      setIsProcessing(true);
      const baseUrl = window.location.origin;
      const token = await user?.getIdToken();
      const response = await fetch("/api/flow/create-payment", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          ...(token ? { "Authorization": `Bearer ${token}` } : {})
        },
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
      setAlertConfig({
        isOpen: true,
        type: "error",
        title: "Error de Pago",
        message: "Error Flow: " + err.message
      });
      setIsProcessing(false);
    }
  };

  const finishOrder = async (token?: string) => {
    setIsProcessing(true);
    try {
      const orderId = doc(collection(db, "transactions")).id;

      await runTransaction(db, async (resTransaction) => {
        // 1. Perform all reads first as required by Firestore transactions
        const productSnaps: { [id: string]: any } = {};
        for (const item of cart) {
          const productRef = doc(db, "products", item.id);
          const snap = await resTransaction.get(productRef);
          if (!snap.exists()) {
            throw new Error(`El producto ${item.name} no existe en el catálogo.`);
          }
          const currentStock = snap.data()?.stock || 0;
          if (currentStock < item.quantity) {
            throw new Error(`Stock insuficiente para ${item.name} (Disponible: ${currentStock}, Solicitado: ${item.quantity})`);
          }
          productSnaps[item.id] = {
            ref: productRef,
            currentStock,
            newStock: currentStock - item.quantity,
            costPrice: snap.data()?.costPrice || 0
          };
        }

        let customerSnap: any = null;
        let customerRef: any = null;
        if (selectedCustomer?.id) {
          customerRef = doc(db, "customers", selectedCustomer.id);
          customerSnap = await resTransaction.get(customerRef);
        }

        // 2. Perform all writes
        cart.forEach(item => {
          const pData = productSnaps[item.id];
          const transactionRef = doc(db, "transactions", `${orderId}_${item.id}`);
          
          resTransaction.update(pData.ref, {
            stock: pData.newStock,
            updatedAt: serverTimestamp()
          });
          
          const moveRef = doc(collection(db, "stockMovements"));
          resTransaction.set(moveRef, {
            productId: item.id,
            productName: item.name,
            type: "sale",
            quantity: item.quantity,
            previousStock: pData.currentStock,
            newStock: pData.newStock,
            reason: `Venta POS #${orderId}`,
            userId: profile?.uid,
            userName: profile?.name,
            source: "web",
            timestamp: serverTimestamp()
          });
          
          resTransaction.set(transactionRef, {
            productId: item.id,
            productName: item.name,
            type: "sale" as const,
            documentType,
            quantity: item.quantity,
            amount: item.price * item.quantity,
            cost: (item.costPrice || pData.costPrice) * item.quantity,
            profit: (item.price - (item.costPrice || pData.costPrice)) * item.quantity,
            userId: profile?.uid,
            userName: profile?.name,
            customerId: selectedCustomer?.id || null,
            customerName: selectedCustomer?.name || "VENTA GENERAL",
            customerTaxId: selectedCustomer?.taxId || null,
            paymentBreakdown: payments,
            timestamp: serverTimestamp(),
            orderId: orderId,
            cashRegisterId: currentSession?.id,
            couponCode: appliedCoupon?.code || null,
            discountApplied: couponDiscount,
            finalOrderTotal: finalTotal,
            note: token?.startsWith("mercadopago") ? `Pago Contactless (MP: ${token})` : token ? `Pago Flow QR (Token: ${token})` : `Venta Directa`
          });
        });

        // Award loyalty points and update stats automatically
        if (selectedCustomer?.id && customerRef && customerSnap) {
          const custData = customerSnap.exists() ? customerSnap.data() : {};
          const pointsAwarded = calculatePoints(finalTotal);
          const currentPoints = (custData.points || 0) + pointsAwarded;
          const newTier = getCustomerTier(currentPoints);
          
          const customerUpdates: any = {
            points: currentPoints,
            totalSpent: (custData.totalSpent || 0) + finalTotal,
            segment: newTier.segment,
            lastPurchaseAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          };

          // Deduct spent dynamic balance from current electronic wallet
          if (payments.digital > 0) {
            const currentBal = custData.balance !== undefined ? custData.balance : 25000;
            customerUpdates.balance = Math.max(0, currentBal - payments.digital);
          }

          if (appliedCoupon?.code) {
            const used = custData.usedCoupons || [];
            if (!used.includes(appliedCoupon.code)) {
              customerUpdates.usedCoupons = [...used, appliedCoupon.code];
            }
          }

          resTransaction.update(customerRef, customerUpdates);
        }
      });
      
      // Sanitize order details before sending to avoid any payload size issues (e.g. from base64 images/signatures)
      const cleanItems = cart.map(item => ({
        id: item.id || "",
        name: item.name || "",
        price: item.price || 0,
        quantity: item.quantity || 1
      }));

      const cleanCustomer = selectedCustomer ? {
        id: selectedCustomer.id || "",
        name: selectedCustomer.name || "",
        taxId: selectedCustomer.taxId || "",
        email: selectedCustomer.email || "",
        phone: selectedCustomer.phone || ""
      } : null;

      const orderData = {
        id: orderId,
        items: cleanItems,
        total: finalTotal,
        originalTotal: cartTotal,
        discount: couponDiscount,
        couponCode: appliedCoupon?.code || null,
        payments: payments,
        customer: cleanCustomer,
        documentType,
        timestamp: new Date().toISOString()
      };
      
      setLastOrder(orderData);
      
      // If customer has email, send receipt
      if (selectedCustomer?.email) {
        try {
          const token = await user?.getIdToken();
          await fetch("/api/send-receipt", {
            method: "POST",
            headers: { 
              "Content-Type": "application/json",
              ...(token ? { "Authorization": `Bearer ${token}` } : {})
            },
            body: JSON.stringify({
              customerEmail: selectedCustomer.email,
              orderDetails: {
                ...orderData,
                customerName: selectedCustomer.name
              },
              businessName: settings.businessName
            })
          });
        } catch (err) {
          console.error("Error calling send-receipt API:", err);
        }
      }

      setCart([]);
      setSelectedCustomer(null);
      setDocumentType("boleta");
      setPayments({ efectivo: 0, tarjeta: 0, transferencia: 0, digital: 0 });
      setCashReceived("");
      setPromoCode("");
      setAppliedCoupon(null);
      
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
              className="w-full sm:w-72 bg-white border-none rounded-2xl py-3 pl-12 pr-12 text-sm font-bold shadow-sm focus:ring-4 focus:ring-indigo-500/10 focus:bg-white transition-all text-slate-700"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <button 
              onClick={() => setIsScanning(true)}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 bg-slate-50 border border-slate-100 rounded-lg flex items-center justify-center text-slate-400 hover:text-indigo-600 transition-colors shadow-sm"
              title="Escaneo Móvil/Webcam"
            >
              <Camera size={14} />
            </button>
          </div>

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

        <motion.div 
          variants={{
            hidden: { opacity: 0 },
            show: {
              opacity: 1,
              transition: {
                staggerChildren: 0.05
              }
            }
          }}
          initial="hidden"
          animate="show"
          className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 overflow-y-auto pr-1 sm:pr-2 pb-10 max-h-[calc(100vh-320px)]"
        >
          <AnimatePresence mode="popLayout">
            {filteredProducts.map((product) => (
              <motion.div
                layout
                variants={{
                  hidden: { opacity: 0, y: 20 },
                  show: { opacity: 1, y: 0 }
                }}
                exit={{ opacity: 0, scale: 0.95 }}
                key={product.id}
                onClick={() => addToCart(product)}
                className="group bg-white p-3 xs:p-4 rounded-[1.5rem] sm:rounded-[2rem] border border-slate-100 shadow-sm cursor-pointer hover:shadow-2xl hover:shadow-indigo-500/10 hover:-translate-y-1.5 transition-all relative overflow-hidden flex flex-col items-center text-center justify-between"
              >
                <div className="flex flex-col items-center w-full">
                  {/* Product Icon/Image */}
                  <div className="w-14 h-14 sm:w-20 sm:h-20 bg-slate-50 rounded-[1.2rem] sm:rounded-[1.5rem] flex items-center justify-center text-slate-300 group-hover:bg-indigo-50 group-hover:text-indigo-400 transition-all mb-3 sm:mb-4 relative overflow-hidden capitalize font-black text-2xl sm:text-3xl">
                     {product.image ? (
                       <img src={product.image} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                     ) : (
                       product.name.charAt(0)
                     )}
                     <div className="absolute inset-0 bg-indigo-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  
                  <div className="space-y-0.5 sm:space-y-1 w-full">
                    <h4 className="font-black text-slate-800 text-[11px] sm:text-xs leading-tight line-clamp-2 min-h-[2rem]">
                      {product.name}
                    </h4>
                    <p className="text-[8px] sm:text-[10px] font-black uppercase tracking-wider text-slate-400 truncate">
                      SKU: {product.sku || 'N/A'}
                    </p>
                    <p className="text-[8px] sm:text-[9px] font-bold text-indigo-500 truncate">
                      EAN: {product.barcode || (product.barcodes && product.barcodes[0]) || 'Sin código'}
                    </p>
                  </div>
                </div>

                <div className="mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-slate-50 w-full flex items-center justify-between">
                  <span className="text-xs sm:text-sm font-black text-indigo-600">
                    {formatCurrency(product.price)}
                  </span>
                  <div className={cn(
                    "px-1.5 py-0.5 sm:px-2 sm:py-1 rounded-lg text-[9px] sm:text-[10px] font-black tabular-nums",
                    Number(product.stock) <= Number(product.minThreshold) 
                      ? "bg-rose-50 text-rose-600" 
                      : "bg-emerald-50 text-emerald-600"
                  )}>
                    {product.stock}
                  </div>
                </div>

                {/* Hover Add Indicator */}
                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-all transform translate-y-2 group-hover:translate-y-0">
                  <div className="bg-indigo-600 text-white rounded-lg sm:rounded-xl p-1.5 sm:p-2 shadow-lg shadow-indigo-200">
                    <Plus size={12} className="sm:w-[14px] sm:h-[14px]" />
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
          
          {filteredProducts.length === 0 && (
            <div className="col-span-full py-20 text-center space-y-4 opacity-30">
              <Package size={48} className="mx-auto text-slate-300" />
              <p className="font-black uppercase tracking-widest text-sm">Sin productos encontrados</p>
            </div>
          )}
        </motion.div>
      </div>

      {/* Checkout Area */}
      <div className="lg:col-span-5 lg:sticky lg:top-10 h-fit">
        <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-2xl flex flex-col p-8 relative overflow-hidden">
          
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3 text-slate-800">
              <ShoppingCart size={20} />
              <h2 className="text-xl font-black tracking-tight">Checkout</h2>
            </div>
            <button 
              onClick={() => setCart([])}
              className="text-[10px] font-bold text-rose-500 border border-rose-100 px-3 py-1 rounded-full uppercase tracking-widest hover:bg-rose-50 transition-colors"
            >
              Vaciar
            </button>
          </div>

          {/* Type of Document */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            <button 
              onClick={() => setDocumentType("boleta")}
              className={cn(
                "flex items-center justify-center space-x-2 py-3 rounded-2xl border transition-all",
                documentType === "boleta" ? "bg-slate-900 border-slate-900 text-white shadow-lg" : "bg-white border-slate-100 text-slate-400 hover:border-slate-300"
              )}
            >
              <Ticket size={16} />
              <span className="text-[10px] font-black uppercase tracking-widest">Boleta / Ticket</span>
            </button>
            <button 
              onClick={() => setDocumentType("factura")}
              className={cn(
                "flex items-center justify-center space-x-2 py-3 rounded-2xl border transition-all",
                documentType === "factura" ? "bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-100" : "bg-white border-slate-100 text-slate-400 hover:border-slate-300"
              )}
            >
              <FileText size={16} />
              <span className="text-[10px] font-black uppercase tracking-widest">Factura</span>
            </button>
          </div>

          {/* Customer Selection */}
          <button 
            onClick={() => setShowCustomerModal(true)}
            className={cn(
              "mb-6 p-4 rounded-2xl border flex items-center justify-between transition-all group",
              selectedCustomer ? "bg-indigo-50 border-indigo-200 text-indigo-900" : "bg-white border-slate-100 text-slate-400 hover:border-slate-300"
            )}
          >
            <div className="flex items-center space-x-3">
              <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center transition-colors", selectedCustomer ? "bg-white text-indigo-600" : "bg-slate-50 text-slate-300")}>
                <Users size={20} />
              </div>
              <div className="text-left">
                <p className="text-[10px] font-black uppercase tracking-widest opacity-60">
                  {documentType === "factura" ? "Entidad de Facturación *" : "Cliente (Opcional)"}
                </p>
                <p className="font-bold text-sm truncate max-w-[200px]">
                  {selectedCustomer ? selectedCustomer.name : "Venta General (Boleta/Ticket)"}
                </p>
                {selectedCustomer && (
                  <div className="flex flex-wrap gap-1.5 items-center mt-1">
                    <span className={cn("text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-tighter", getCustomerTier(selectedCustomer.points).bg, getCustomerTier(selectedCustomer.points).color)}>
                      {getCustomerTier(selectedCustomer.points).name}
                    </span>
                    <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded tracking-tighter">
                      {selectedCustomer.points || 0} PTS
                    </span>
                    <span className="text-[9px] font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded tracking-tighter flex items-center gap-0.5">
                      💳 {formatCurrency(selectedCustomer.balance !== undefined ? selectedCustomer.balance : 25000)} Saldo
                    </span>
                  </div>
                )}
              </div>
            </div>
            {selectedCustomer ? (
              <X size={16} className="text-indigo-400 hover:text-indigo-600" onClick={(e) => { e.stopPropagation(); setSelectedCustomer(null); }} />
            ) : (
              <Plus size={16} className="group-hover:text-indigo-500" />
            )}
          </button>

          {/* Cart Items */}
          <div className="space-y-3 mb-6 max-h-[160px] overflow-y-auto pr-2">
            {cart.map((item) => (
              <div key={item.id} className="flex items-center justify-between group bg-slate-50 p-3 rounded-2xl">
                <div className="flex items-center flex-1 min-w-0 pr-4">
                  <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center text-slate-300 mr-3 border border-slate-100 overflow-hidden shrink-0">
                    {item.image ? (
                      <img src={item.image} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <Package size={14} />
                    )}
                  </div>
                  <div className="truncate">
                    <p className="font-bold text-slate-800 text-xs truncate">{item.name}</p>
                    <p className="text-[10px] text-slate-400 font-bold mt-0.5">
                      {formatCurrency(item.price)} x {item.quantity}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-1">
                  <button onClick={() => updateQuantity(item.id, -1)} className="p-1 rounded-lg bg-white shadow-sm border border-slate-100"><Minus size={12}/></button>
                  <input 
                    type="number"
                    className="w-8 text-center bg-transparent border-none text-[10px] font-black text-slate-800 focus:ring-0 p-0 italic"
                    value={item.quantity}
                    onChange={(e) => {
                      const val = parseInt(e.target.value);
                      if (!isNaN(val)) {
                        setCart(prev => prev.map(i => i.id === item.id ? { ...i, quantity: Math.min(i.maxStock, Math.max(0, val)) } : i).filter(i => i.quantity > 0));
                      }
                    }}
                  />
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
            <div className="flex flex-col gap-2.5 mb-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Métodos de Pago (Split)</span>
                <button 
                  type="button"
                  onClick={quickPay}
                  className="text-[10px] font-black text-indigo-600 uppercase tracking-widest hover:underline"
                >
                  Pago Total Efectivo
                </button>
              </div>
              {selectedCustomer && (
                <button
                  type="button"
                  onClick={() => {
                    const balance = selectedCustomer.balance !== undefined ? selectedCustomer.balance : 25000;
                    if (balance >= finalTotal) {
                      setPayments({ efectivo: 0, tarjeta: 0, transferencia: 0, digital: finalTotal });
                      setAlertConfig({
                        isOpen: true,
                        type: "success",
                        title: "¡Billetera Electrónica Aplicada!",
                        message: `Se descontarán $${finalTotal.toLocaleString('es-CL')} del saldo disponible de la billetera del cliente (${formatCurrency(balance)}) para el pago total de la compra.`
                      });
                    } else if (balance > 0) {
                      setPayments({ efectivo: 0, tarjeta: 0, transferencia: 0, digital: balance });
                      setAlertConfig({
                        isOpen: true,
                        type: "warning",
                        title: "Saldo Wallet Parcial",
                        message: `El cliente solo tiene $${balance.toLocaleString('es-CL')} de saldo. Se aplicó el saldo total, falta un remanente de $${(finalTotal - balance).toLocaleString('es-CL')} que debe pagar con otro medio.`
                      });
                    } else {
                      setAlertConfig({
                        isOpen: true,
                        type: "error",
                        title: "Billetera sin Saldo",
                        message: "El cliente no tiene saldo disponible en su billetera digital prepago."
                      });
                    }
                  }}
                  className="w-full py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-100 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all text-center animate-pulse"
                >
                  <span>💳</span> Use Wallet de Cliente (${formatCurrency(selectedCustomer.balance !== undefined ? selectedCustomer.balance : 25000)})
                </button>
              )}
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { id: "efectivo", label: "Efectivo", icon: Banknote, color: "text-emerald-500" },
                { id: "tarjeta", label: "Tarjeta", icon: CreditCard, color: "text-blue-500" },
                { id: "transferencia", label: "Transferencia", icon: RefreshCw, color: "text-amber-500" },
                { id: "digital", label: "Virtual (QR/MP)", icon: Smartphone, color: "text-purple-500" }
              ].map((m) => {
                const currentVal = payments[m.id as keyof PaymentBreakdown] || 0;
                const values = Object.values(payments) as number[];
                const totalPaid = values.reduce((a, b) => a + b, 0);
                const remaining = cartTotal - totalPaid + currentVal;

                return (
                  <div key={m.id} className="space-y-1.5">
                    <div className="flex items-center justify-between px-1">
                      <div className="flex items-center space-x-1.5 text-[10px] font-bold text-slate-500 uppercase">
                        <m.icon size={12} className={m.color} />
                        <span>{m.label}</span>
                      </div>
                      <button 
                        onClick={() => {
                          const pValues = Object.values(payments) as number[];
                          const balance = cartTotal - pValues.reduce((a, b) => a + (b || 0), 0);
                          if (balance > 0) {
                            handlePaymentChange(m.id as keyof PaymentBreakdown, (currentVal + balance).toString());
                          }
                        }}
                        className="text-[9px] font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-lg hover:bg-indigo-100 transition-colors"
                      >
                        + TOTAL
                      </button>
                    </div>
                    <div className="relative">
                      <input 
                        type="number" 
                        placeholder="0"
                        className="w-full bg-slate-50 border-none rounded-xl py-2 px-3 text-xs font-black text-slate-700 focus:ring-2 focus:ring-indigo-500/20 transition-all pr-8"
                        value={payments[m.id as keyof PaymentBreakdown] || ""}
                        onChange={(e) => handlePaymentChange(m.id as keyof PaymentBreakdown, e.target.value)}
                      />
                      {currentVal > 0 && (
                        <button 
                          onClick={() => handlePaymentChange(m.id as keyof PaymentBreakdown, "0")}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-300 hover:text-rose-500"
                        >
                          <X size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Change Calculator & Numpad */}
            <div className="bg-slate-900 rounded-3xl p-4 sm:p-6 text-white space-y-6 shadow-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 blur-3xl rounded-full -mr-16 -mt-16" />
              
              <div className="bg-slate-950/50 p-4 rounded-2xl border border-white/5 space-y-3 relative z-10">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-white/40 font-black uppercase tracking-widest">Monto Recibido</span>
                  <div className="flex items-baseline space-x-0.5">
                    <span className="text-xs font-black text-white/20 select-none mr-0.5">$</span>
                    <span className="text-lg sm:text-xl font-black text-white tracking-tight">
                      {cashReceived || "0"}
                    </span>
                  </div>
                </div>
                <div className="h-[1px] bg-white/5 w-full" />
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-white/40 font-black uppercase tracking-widest">Vuelto</span>
                  <span className="text-lg sm:text-xl font-black text-emerald-400 tracking-tight">
                    {formatCurrency(change)}
                  </span>
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

              {/* Coupon Apply Area */}
              <div className="pt-4 border-t border-white/5 space-y-2 relative z-10">
                <p className="text-[9px] font-black uppercase tracking-widest text-white/40">Cupón de Descuento</p>
                {appliedCoupon ? (
                  <div className="flex items-center justify-between bg-white/5 p-2 rounded-xl border border-white/10">
                    <div className="flex items-center space-x-2">
                      <span className="text-lg">{appliedCoupon.img || "🎟️"}</span>
                      <div>
                        <p className="text-xs font-black text-white">{appliedCoupon.code}</p>
                        <p className="text-[10px] text-white/60">{appliedCoupon.desc}</p>
                      </div>
                    </div>
                    <button 
                      onClick={() => setAppliedCoupon(null)} 
                      className="text-[10px] font-black text-rose-400 hover:text-rose-300 uppercase tracking-widest"
                    >
                      Remover
                    </button>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <div className="flex gap-2">
                      <input 
                        type="text" 
                        placeholder="Ej: SUMMER15" 
                        value={promoCode}
                        onChange={(e) => setPromoCode(e.target.value)}
                        className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs font-black text-white uppercase placeholder-white/20 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                      />
                      <button 
                        onClick={handleApplyCoupon}
                        className="bg-white/10 hover:bg-white/25 text-white text-xs font-black px-3 sm:px-4 py-2 rounded-xl transition-all shrink-0 whitespace-nowrap"
                      >
                        Aplicar
                      </button>
                    </div>
                    {couponError && (
                      <p className="text-[9px] text-rose-400 font-bold">{couponError}</p>
                    )}
                  </div>
                )}
              </div>

              <div className="pt-4 border-t border-white/5 space-y-3 relative z-10">
                {couponDiscount > 0 && (
                  <>
                    <div className="flex justify-between text-xs font-bold text-white/50">
                      <span>Subtotal</span>
                      <span>{formatCurrency(cartTotal)}</span>
                    </div>
                    <div className="flex justify-between text-xs font-bold text-rose-400">
                      <span>Descuento Cupón</span>
                      <span>-{formatCurrency(couponDiscount)}</span>
                    </div>
                  </>
                )}
                <div className="flex justify-between text-xs font-bold text-white/60">
                  <span>Total Venta</span>
                  <span className="text-white text-sm font-black">{formatCurrency(finalTotal)}</span>
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
                disabled={isProcessing || cart.length === 0 || remaining > 0 || (documentType === "factura" && !selectedCustomer) || !isCashRegisterOpen}
                className={cn(
                  "w-full h-16 rounded-2xl font-black uppercase tracking-widest text-xs transition-all flex items-center justify-center space-x-2 shadow-xl",
                  (isProcessing || cart.length === 0 || remaining > 0 || (documentType === "factura" && !selectedCustomer) || !isCashRegisterOpen)
                    ? "bg-slate-800 text-slate-500 shadow-none cursor-not-allowed"
                    : "bg-white text-slate-900 hover:bg-indigo-50 hover:scale-[1.02] shadow-black/20"
                )}
              >
                {isProcessing ? <Loader2 className="animate-spin" size={20} /> : "Finalizar y Emitir Ticket"}
              </button>
              {!isCashRegisterOpen && (
                <p className="text-center text-[10px] font-black text-rose-400 uppercase tracking-widest mt-4">
                   ⚠ Debe abrir la caja para realizar ventas
                </p>
              )}
              {documentType === "factura" && !selectedCustomer && isCashRegisterOpen && (
                <p className="text-center text-[10px] font-black text-rose-400 uppercase tracking-widest mt-4">
                   ⚠ Se requiere cliente para Factura
                </p>
              )}
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
                  setAlertConfig({
                    isOpen: true,
                    type: "error",
                    title: "Error Contactless",
                    message: "Error en el pago: " + err
                  });
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

      {/* Customer Selection Modal */}
      <AnimatePresence>
        {showCustomerModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowCustomerModal(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="bg-white rounded-[3rem] shadow-2xl max-w-2xl w-full overflow-hidden relative z-10 flex flex-col max-h-[85vh]"
            >
              <div className="p-10 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="w-14 h-14 bg-white rounded-2xl shadow-sm border border-slate-100 flex items-center justify-center text-indigo-600">
                    <Users size={28} />
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-slate-800 tracking-tight leading-none">Gestión de Clientes</h3>
                    <p className="text-[10px] font-black uppercase tracking-widest mt-2 text-slate-400">Selección para venta y facturación</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsNewCustomerMode(!isNewCustomerMode)}
                  className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-colors"
                >
                  {isNewCustomerMode ? "Volver al Listado" : "Registrar Nuevo"}
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-10">
                {isNewCustomerMode ? (
                  <form onSubmit={handleCreateCustomer} className="space-y-6">
                    <div className="grid grid-cols-2 gap-6">
                      <div className="col-span-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">Nombre / Razón Social</label>
                        <input 
                          required
                          type="text" 
                          placeholder="Ej: Inversiones Globales S.A."
                          className="w-full h-14 bg-slate-50 border border-slate-100 rounded-2xl px-5 text-sm font-bold focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all"
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
                          className="w-full h-14 bg-slate-50 border border-slate-100 rounded-2xl px-5 text-sm font-bold focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all"
                          value={newCustomer.taxId}
                          onChange={e => setNewCustomer({...newCustomer, taxId: formatRUT(e.target.value)})}
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">Teléfono</label>
                        <input 
                          type="tel" 
                          placeholder="+56 9 XXXX XXXX"
                          className="w-full h-14 bg-slate-50 border border-slate-100 rounded-2xl px-5 text-sm font-bold focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all"
                          value={newCustomer.phone}
                          onChange={e => setNewCustomer({...newCustomer, phone: formatChileanPhone(e.target.value)})}
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">Dirección Facturación</label>
                        <input 
                          type="text" 
                          placeholder="Avenida Principal #123, Oficina 401"
                          className="w-full h-14 bg-slate-50 border border-slate-100 rounded-2xl px-5 text-sm font-bold focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all"
                          value={newCustomer.address}
                          onChange={e => setNewCustomer({...newCustomer, address: e.target.value})}
                        />
                      </div>
                    </div>
                    <button className="w-full h-16 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-widest text-xs mt-4 shadow-xl">
                      Registrar y Seleccionar
                    </button>
                  </form>
                ) : (
                  <div className="space-y-6">
                    <div className="relative">
                      <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300" size={20} />
                      <input 
                        type="text"
                        placeholder="Buscar por nombre, RUT, o escriba PIN OTP de 6 dígitos..."
                        className="w-full h-16 bg-slate-50 border border-slate-100 rounded-3xl pl-16 pr-20 text-sm font-bold focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all shadow-inner"
                        value={customerSearch}
                        onChange={e => setCustomerSearch(e.target.value)}
                      />
                      <button 
                        onClick={() => setIsScanningCustomer(true)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-white border border-slate-100 rounded-xl flex items-center justify-center text-indigo-600 hover:bg-slate-50 active:scale-95 transition-all shadow-sm"
                        title="Escaneo Webcam - Código QR de Cliente"
                      >
                        <Camera size={18} />
                      </button>
                    </div>

                    <AnimatePresence>
                      {isScanningCustomer && (
                        <div className="bg-slate-900/10 p-4 rounded-3xl border border-slate-100 relative">
                          <p className="text-[10px] font-black text-indigo-950 uppercase tracking-wider mb-2 text-center">Enfoque el código QR dinámico de la app del cliente</p>
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
                    <div className="space-y-3">
                      {filteredCustomers.map(c => (
                        <button 
                          key={c.id}
                          onClick={() => { setSelectedCustomer(c); setShowCustomerModal(false); }}
                          className="w-full p-6 bg-white border border-slate-100 rounded-[2rem] flex items-center justify-between hover:border-indigo-200 hover:bg-indigo-50/30 transition-all"
                        >
                          <div className="flex items-center space-x-4">
                            <div className="w-12 h-12 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400">
                              <Store size={24} />
                            </div>
                            <div className="text-left">
                              <p className="font-bold text-slate-800">{c.name}</p>
                              <div className="flex items-center space-x-2 mt-1">
                                <span className="text-[10px] font-black uppercase tracking-tight text-slate-400">RUT:</span>
                                <span className="text-[10px] font-black uppercase tracking-tight text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">{formatRUT(c.taxId)}</span>
                              </div>
                            </div>
                          </div>
                          <ChevronRight className="text-slate-200" size={20} />
                        </button>
                      ))}
                      {filteredCustomers.length === 0 && (
                        <div className="text-center py-20 opacity-20">
                          <Users size={64} className="mx-auto mb-4" />
                          <p className="text-sm font-black uppercase tracking-widest">No hay resultados</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <ModernAlert 
        isOpen={alertConfig.isOpen}
        onClose={() => setAlertConfig(prev => ({ ...prev, isOpen: false }))}
        onConfirm={alertConfig.onConfirm}
        title={alertConfig.title}
        message={alertConfig.message}
        type={alertConfig.type}
        confirmText="Aceptar"
      />
    </div>
  );
}
