import React, { useState, useEffect } from "react";
import { 
  collection, 
  query, 
  onSnapshot, 
  writeBatch, 
  doc, 
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  increment,
  orderBy,
  limit,
  startAfter,
  getDocs
} from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../lib/firebase";
import { 
  ArrowDownLeft, 
  ArrowUpRight, 
  Package, 
  Search, 
  Tag, 
  Plus, 
  Minus, 
  X, 
  Save,
  Truck,
  AlertCircle,
  History,
  RefreshCw,
  PackageCheck,
  AlertTriangle,
  Camera,
  ClipboardCheck,
  Barcode,
  TrendingUp,
  Bell,
  CheckSquare,
  Sparkles,
  FileText,
  CheckCircle,
  Calendar,
  Lock,
  ChevronRight,
  ShieldCheck,
  ArrowDownCircle,
  ShoppingBag,
  Mail,
  Navigation
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { cn } from "../lib/utils";
import { motion, AnimatePresence } from "motion/react";
import { BarcodeScanner } from "./ui/BarcodeScanner";
import { ModernAlert } from "./ui/ModernAlert";
import { DeliveryMap } from "./DeliveryMap";
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip as RechartsTooltip, 
  Legend, 
  PieChart, 
  Pie, 
  Cell 
} from "recharts";

export function Logistics({ onNavigate }: { onNavigate?: (page: any) => void }) {
  const { profile } = useAuth();
  const [products, setProducts] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [shipments, setShipments] = useState<any[]>([]);
  
  const [searchTerm, setSearchTerm] = useState("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [unrecognizedBarcode, setUnrecognizedBarcode] = useState<string | null>(null);
  const [isQuickCreateOpen, setIsQuickCreateOpen] = useState(false);
  
  const [mode, setMode] = useState<"reception" | "dispatch" | "audit" | "alerts" | "shipments" | "claims">("reception");
  const [isProcessing, setIsProcessing] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Shipments Pagination States
  const [shipmentPage, setShipmentPage] = useState(1);
  const [shipmentCursors, setShipmentCursors] = useState<any[]>([]);
  const [shipmentsLoading, setShipmentsLoading] = useState(false);
  const [shipmentHasMore, setShipmentHasMore] = useState(true);
  const [paginatedShipments, setPaginatedShipments] = useState<any[]>([]);

  // Claims States
  const [claims, setClaims] = useState<any[]>([]);
  const [claimsLoading, setClaimsLoading] = useState(false);
  const [claimsPage, setClaimsPage] = useState(1);
  const [claimsCursors, setClaimsCursors] = useState<any[]>([]);
  const [claimsHasMore, setClaimsHasMore] = useState(true);
  const [selectedClaim, setSelectedClaim] = useState<any | null>(null);
  const [resolutionText, setResolutionText] = useState("");
  const [pendingClaimsCount, setPendingClaimsCount] = useState(0);
  
  // Phase 4 states (Paso 4.1, 4.2, 4.3)
  const [selectedShipmentForCheckout, setSelectedShipmentForCheckout] = useState<any | null>(null);
  const [checkedCheckoutItems, setCheckedCheckoutItems] = useState<Record<string, Record<string, boolean>>>({});
  const [auditScans, setAuditScans] = useState<Record<string, number>>({});
  const [auditBarcode, setAuditBarcode] = useState("");
  const [isAuditScanning, setIsAuditScanning] = useState(false);
  const [isAuditActive, setIsAuditActive] = useState(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const [selectedProductForOC, setSelectedProductForOC] = useState<any | null>(null);
  const [ocQuantity, setOcQuantity] = useState(50);

  const [alertConfig, setAlertConfig] = useState<{
    isOpen: boolean;
    type: "success" | "error" | "warning" | "info";
    title: string;
    message: string;
  }>({
    isOpen: false,
    type: "success",
    title: "",
    message: ""
  });
  
  const [formData, setFormData] = useState({
    quantity: 1,
    reason: "",
    supplierId: "",
    customerId: "",
    targetSucursal: "",
    reference: "",
    movementType: "" as string, 
  });

  const [quickCreateData, setQuickCreateData] = useState({
    name: "",
    sku: "",
    barcode: "",
    costPrice: 0,
    price: 0,
    wholesalePrice: 0,
    wholesaleMinQty: 6,
    stock: 0,
    minThreshold: 5,
    description: "",
    categoryId: "",
    supplierId: ""
  });

  const [isCreatingCategory, setIsCreatingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");

  const handleCreateCategoryQuickly = async () => {
    if (!newCategoryName.trim()) return;
    try {
      const docRef = await addDoc(collection(db, "categories"), {
        name: newCategoryName.trim(),
        createdAt: serverTimestamp()
      });
      setQuickCreateData(prev => ({
        ...prev,
        categoryId: docRef.id
      }));
      setNewCategoryName("");
      setIsCreatingCategory(false);
    } catch (err) {
      alert("Error al crear la categoría. Verifique sus permisos.");
    }
  };

  useEffect(() => {
    const unsubProds = onSnapshot(query(collection(db, "products"), orderBy("name")), (snap) => {
      setProducts(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    const unsubSupps = onSnapshot(query(collection(db, "suppliers"), orderBy("name")), (snap) => {
      setSuppliers(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    const unsubCats = onSnapshot(query(collection(db, "categories"), orderBy("name")), (snap) => {
      setCategories(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    const unsubCusts = onSnapshot(query(collection(db, "customers"), orderBy("name")), (snap) => {
      setCustomers(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    const unsubShipments = onSnapshot(query(collection(db, "shipments")), (snap) => {
      setShipments(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    const unsubClaimsCount = onSnapshot(collection(db, "claims"), (snap) => {
      const unresolved = snap.docs.filter(doc => doc.data().status !== "resolved").length;
      setPendingClaimsCount(unresolved);
    });
    return () => { 
      unsubProds(); 
      unsubSupps(); 
      unsubCats(); 
      unsubCusts(); 
      unsubShipments();
      unsubClaimsCount();
    };
  }, []);

  const fetchPaginatedShipments = async (direction: "init" | "next" | "prev" = "init") => {
    setShipmentsLoading(true);
    try {
      const shipmentsCol = collection(db, "shipments");
      let q = query(shipmentsCol, orderBy("orderId", "desc"));
      
      let targetPage = shipmentPage;
      if (direction === "next") {
        targetPage = shipmentPage + 1;
        const lastVisible = shipmentCursors[shipmentPage - 1];
        if (lastVisible) {
          q = query(q, startAfter(lastVisible), limit(25));
        } else {
          q = query(q, limit(25));
        }
      } else if (direction === "prev") {
        targetPage = Math.max(1, shipmentPage - 1);
        const prevIndex = targetPage - 1;
        const prevVisible = prevIndex > 0 ? shipmentCursors[prevIndex - 1] : null;
        if (prevVisible) {
          q = query(q, startAfter(prevVisible), limit(25));
        } else {
          q = query(q, limit(25));
        }
      } else {
        targetPage = 1;
        q = query(q, limit(25));
      }

      const snap = await getDocs(q);
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setPaginatedShipments(data);

      const lastVisibleDoc = snap.docs[snap.docs.length - 1];
      if (direction === "init") {
        setShipmentCursors([lastVisibleDoc]);
        setShipmentPage(1);
      } else if (direction === "next") {
        setShipmentCursors((prev) => {
          const nextCursors = [...prev];
          nextCursors[targetPage - 1] = lastVisibleDoc;
          return nextCursors;
        });
        setShipmentPage(targetPage);
      } else if (direction === "prev") {
        setShipmentPage(targetPage);
      }
      setShipmentHasMore(snap.docs.length === 25);
    } catch (err) {
      console.error("Error fetching shipments paginated:", err);
    } finally {
      setShipmentsLoading(false);
    }
  };

  const fetchPaginatedClaims = async (direction: "init" | "next" | "prev" = "init") => {
    setClaimsLoading(true);
    try {
      const claimsCol = collection(db, "claims");
      let q = query(claimsCol, orderBy("timestamp", "desc"));
      
      let targetPage = claimsPage;
      if (direction === "next") {
        targetPage = claimsPage + 1;
        const lastVisible = claimsCursors[claimsPage - 1];
        if (lastVisible) {
          q = query(q, startAfter(lastVisible), limit(25));
        } else {
          q = query(q, limit(25));
        }
      } else if (direction === "prev") {
        targetPage = Math.max(1, claimsPage - 1);
        const prevIndex = targetPage - 1;
        const prevVisible = prevIndex > 0 ? claimsCursors[prevIndex - 1] : null;
        if (prevVisible) {
          q = query(q, startAfter(prevVisible), limit(25));
        } else {
          q = query(q, limit(25));
        }
      } else {
        targetPage = 1;
        q = query(q, limit(25));
      }

      const snap = await getDocs(q);
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setClaims(data);

      const lastVisibleDoc = snap.docs[snap.docs.length - 1];
      if (direction === "init") {
        setClaimsCursors([lastVisibleDoc]);
        setClaimsPage(1);
      } else if (direction === "next") {
        setClaimsCursors((prev) => {
          const nextCursors = [...prev];
          nextCursors[targetPage - 1] = lastVisibleDoc;
          return nextCursors;
        });
        setClaimsPage(targetPage);
      } else if (direction === "prev") {
        setClaimsPage(targetPage);
      }
      setClaimsHasMore(snap.docs.length === 25);
    } catch (err) {
      console.error("Error fetching claims paginated:", err);
    } finally {
      setClaimsLoading(false);
    }
  };

  useEffect(() => {
    if (mode === "shipments") {
      fetchPaginatedShipments("init");
    } else if (mode === "claims") {
      fetchPaginatedClaims("init");
    }
  }, [mode]);

  // Barcode Scanner Listener
  useEffect(() => {
    let barcode = "";
    let lastKeyTime = Date.now();

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't listen if user is typing in an input (except if it's the barcode field)
      if (document.activeElement?.tagName === "INPUT" && (document.activeElement as HTMLInputElement).name !== "barcode") {
        return;
      }

      const currentTime = Date.now();
      if (currentTime - lastKeyTime > 50) barcode = "";
      
      if (e.key === "Enter") {
        if (barcode.length > 2) {
          const product = products.find(p => p.barcode === barcode || (p.barcodes && p.barcodes.includes(barcode)));
          if (product) {
            setSelectedProduct(product);
            setUnrecognizedBarcode(null);
          } else {
            // Unrecognized barcode
            setUnrecognizedBarcode(barcode);
            setSelectedProduct(null);
            setSearchTerm(""); // Clear search to show the prompt better
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

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.barcode?.includes(searchTerm) ||
    p.barcodes?.some((bc: string) => bc.includes(searchTerm)) ||
    p.sku?.toLowerCase().includes(searchTerm.toLowerCase())
  ).slice(0, 5);

  const filteredCustomers = customers.filter(c => {
    const customerRUT = c.rut || c.taxId || "";
    return (
      c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
      customerRUT.includes(customerSearch) ||
      c.email?.toLowerCase().includes(customerSearch.toLowerCase())
    );
  }).slice(0, 5);

  const handleQuickCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isProcessing) return;

    const finalBarcode = quickCreateData.barcode || unrecognizedBarcode || "";
    if (!finalBarcode) {
      setAlertConfig({
        isOpen: true,
        type: "warning",
        title: "Dato Obligatorio",
        message: "El código de barras (EAN-13) es obligatorio para registrar un producto."
      });
      return;
    }

    setIsProcessing(true);

    try {
      const cat = categories.find(c => c.id === quickCreateData.categoryId);
      const batch = writeBatch(db);
      
      const prodRef = doc(collection(db, "products"));
      const initialStockValue = Number(quickCreateData.stock) || 0;

      const docPayload = {
        name: quickCreateData.name,
        sku: quickCreateData.sku || "",
        barcode: finalBarcode,
        barcodes: [finalBarcode],
        costPrice: Number(quickCreateData.costPrice) || 0,
        price: Number(quickCreateData.price) || 0,
        wholesalePrice: Number(quickCreateData.wholesalePrice) || Number(quickCreateData.price) || 0,
        wholesaleMinQty: Number(quickCreateData.wholesaleMinQty) || 6,
        stock: initialStockValue,
        minThreshold: Number(quickCreateData.minThreshold) || 5,
        description: quickCreateData.description || "",
        categoryId: quickCreateData.categoryId || "",
        category: cat?.name || "Sin Categoría",
        supplierId: quickCreateData.supplierId || "",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        updatedBy: profile?.name || "Admin"
      };

      batch.set(prodRef, docPayload);

      if (initialStockValue > 0) {
        const movementRef = doc(collection(db, "stockMovements"));
        batch.set(movementRef, {
          productId: prodRef.id,
          productName: quickCreateData.name,
          type: "purchase", // Entry by purchase/receipt
          subType: "reception",
          quantity: initialStockValue,
          previousStock: 0,
          newStock: initialStockValue,
          reason: "Recepcionado en Alta de Producto (Stock Inicial)",
          reference: "Recepción Alta Rápida",
          supplierId: quickCreateData.supplierId || null,
          customerId: null,
          customerName: null,
          targetSucursal: null,
          userId: profile?.uid,
          userName: profile?.name,
          timestamp: serverTimestamp(),
          source: "logistics",
          updatedBarcode: finalBarcode
        });
      }

      await batch.commit();

      // After creation, select it
      setSelectedProduct({
        id: prodRef.id,
        name: quickCreateData.name,
        sku: quickCreateData.sku || "",
        barcode: finalBarcode,
        barcodes: [finalBarcode],
        costPrice: Number(quickCreateData.costPrice) || 0,
        price: Number(quickCreateData.price) || 0,
        wholesalePrice: Number(quickCreateData.wholesalePrice) || Number(quickCreateData.price) || 0,
        wholesaleMinQty: Number(quickCreateData.wholesaleMinQty) || 6,
        stock: initialStockValue,
        minThreshold: Number(quickCreateData.minThreshold) || 5,
        description: quickCreateData.description || "",
        categoryId: quickCreateData.categoryId || "",
        category: cat?.name || "Sin Categoría",
        supplierId: quickCreateData.supplierId || ""
      });

      setIsQuickCreateOpen(false);
      setUnrecognizedBarcode(null);

      setAlertConfig({
        isOpen: true,
        type: "success",
        title: "¡Producto Registrado!",
        message: initialStockValue > 0
          ? `El producto "${quickCreateData.name}" se creó exitosamente con un stock cargado e ingresado de ${initialStockValue} unidades en el inventario.`
          : `El producto "${quickCreateData.name}" se creó exitosamente con stock inicial en cero.`
      });
    } catch (err) {
      console.error("Quick create failed:", err);
      setAlertConfig({
        isOpen: true,
        type: "error",
        title: "Error de Registro",
        message: "No se pudo registrar el producto rápido en el servidor. Intente de nuevo."
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct) return;
    setFormError(null);

    const isEntry = mode === "reception";
    const actualType = formData.movementType || (isEntry ? "adjustment" : "loss");

    // Validation: Mandatory reason for loss or adjustment in dispatch
    if (!isEntry && (actualType === "loss" || actualType === "adjustment") && !formData.reason.trim()) {
      setFormError("Para Pérdida/Merma o Ajuste/Error, es obligatorio detallar el motivo en Observaciones.");
      return;
    }

    // Validation: Client for wholesale sale
    if (!isEntry && actualType === "sale" && !formData.customerId) {
        setFormError("Para Venta por Mayor/Directa, debe elegir un cliente.");
        return;
    }

    // Validation: Sucursal for internal withdrawal
    if (!isEntry && actualType === "withdrawal" && !formData.targetSucursal.trim()) {
        setFormError("Para Retiro Interno, debe especificar la sucursal de destino.");
        return;
    }

    setIsProcessing(true);

    try {
      const batch = writeBatch(db);
      const productRef = doc(db, "products", selectedProduct.id);
      const movementRef = doc(collection(db, "stockMovements"));
      
      const qtyChange = mode === "reception" ? formData.quantity : -formData.quantity;

      const productUpdates: any = {
        stock: increment(qtyChange),
        updatedAt: serverTimestamp()
      };

      // If we linked an unrecognized barcode, add it to the array
      if (mode === "reception" && unrecognizedBarcode) {
        const currentBarcodes = selectedProduct.barcodes || (selectedProduct.barcode ? [selectedProduct.barcode] : []);
        if (!currentBarcodes.includes(unrecognizedBarcode)) {
          productUpdates.barcodes = [...currentBarcodes, unrecognizedBarcode];
        }
      }

      batch.update(productRef, productUpdates);

      const customer = customers.find(c => c.id === formData.customerId);

      batch.set(movementRef, {
        productId: selectedProduct.id,
        productName: selectedProduct.name,
        type: actualType, 
        subType: mode === "reception" ? "reception" : "dispatch",
        quantity: formData.quantity,
        previousStock: selectedProduct.stock || 0,
        newStock: (selectedProduct.stock || 0) + qtyChange,
        reason: formData.reason || (mode === "reception" ? "Recepción de Mercadería" : "Despacho / Salida"),
        reference: formData.reference,
        supplierId: mode === "reception" ? formData.supplierId : null,
        customerId: formData.customerId || null,
        customerName: customer?.name || null,
        targetSucursal: formData.targetSucursal || null,
        userId: profile?.uid,
        userName: profile?.name,
        timestamp: serverTimestamp(),
        source: "logistics",
        updatedBarcode: unrecognizedBarcode || null
      });

      await batch.commit();
      
      // Reset
      setSelectedProduct(null);
      setUnrecognizedBarcode(null);
      setSearchTerm("");
      setCustomerSearch("");
      setFormData({ 
        quantity: 1, 
        reason: "", 
        supplierId: "", 
        reference: "", 
        movementType: "",
        customerId: "",
        targetSucursal: "" 
      });
      setAlertConfig({
        isOpen: true,
        type: "success",
        title: mode === "reception" ? "¡Recepción Exitosa!" : "¡Despacho Completado!",
        message: mode === "reception" 
          ? `Se ha cargado con éxito la recepción de ${formData.quantity} unidades del producto "${selectedProduct.name}".`
          : `Se ha registrado el despacho / salida de ${formData.quantity} unidades del producto "${selectedProduct.name}" con éxito.`
      });

    } catch (error) {
      console.error(error);
      setAlertConfig({
        isOpen: true,
        type: "error",
        title: "Error de Operación",
        message: "No se pudo completar el movimiento de stock en el servidor. Intente de nuevo."
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-4 md:space-y-8 max-w-5xl mx-auto px-4 md:px-0">
      {/* Informational Banner about Non-Face-to-Face Sales */}
      <div className="bg-slate-900 text-white rounded-[1.5rem] md:rounded-[2rem] p-4 md:p-6 flex flex-col md:flex-row items-center gap-4 md:gap-6 border-b-4 border-indigo-500/30">
        <div className="w-12 h-12 md:w-16 md:h-16 bg-white/10 rounded-xl md:rounded-2xl flex items-center justify-center shrink-0">
          <Truck className="text-indigo-400" size={24} md:size={32} />
        </div>
        <div className="flex-1 text-center md:text-left">
          <h4 className="text-[10px] md:text-sm font-black uppercase tracking-tight text-indigo-400 mb-1">¿Ventas no presenciales?</h4>
          <p className="text-[10px] md:text-xs text-slate-300 font-medium leading-relaxed">
            Si vendes por WhatsApp o Redes Sociales, realiza la venta en el <strong className="text-white">PDV</strong> primero, y luego usa este panel para registrar la salida física.
          </p>
        </div>
      </div>

      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 md:gap-6 pb-2 border-b border-slate-100">
        <div className="text-center lg:text-left">
          <h1 className="text-2xl md:text-4xl font-black text-slate-800 tracking-tight">Logística</h1>
          <p className="text-xs md:text-slate-500 font-medium mt-1">Recepción, despacho y control de bodega.</p>
        </div>
        
        {/* Tier 1 Primary Switcher */}
        <div className="bg-slate-100 p-1.5 rounded-2xl border border-slate-200/60 flex shadow-inner w-full lg:w-auto overflow-x-auto whitespace-nowrap scrollbar-none flex-nowrap shrink-0 gap-1.5 self-center">
          <button
            type="button"
            onClick={() => setMode("reception")}
            className={cn(
              "flex-1 md:flex-none px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center whitespace-nowrap space-x-2",
              (mode === "reception" || mode === "dispatch")
                ? "bg-white text-slate-900 shadow-sm border border-slate-200/50"
                : "text-slate-500 hover:text-slate-800 hover:bg-white/50"
            )}
          >
            <Package size={14} className="text-indigo-600" />
            <span>📦 Flujos de Bodega</span>
          </button>
          <button
            type="button"
            onClick={() => setMode("shipments")}
            className={cn(
              "flex-1 md:flex-none px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center whitespace-nowrap space-x-2 relative",
              (mode !== "reception" && mode !== "dispatch")
                ? "bg-white text-slate-900 shadow-sm border border-slate-200/50"
                : "text-slate-500 hover:text-slate-800 hover:bg-white/50"
            )}
          >
            <TrendingUp size={14} className="text-indigo-600" />
            <span>📊 Control y Soporte</span>
            {pendingClaimsCount > 0 && (mode === "reception" || mode === "dispatch") && (
              <span className="ml-1.5 px-1.5 py-0.5 bg-rose-600 text-white rounded-full text-[9px] font-black animate-pulse inline-flex items-center justify-center min-w-[16px] h-4">
                {pendingClaimsCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Tier 2 Secondary Sub-pills */}
      <div className="flex flex-col items-center justify-center py-1">
        <div className="bg-white p-1 rounded-xl md:rounded-2xl border border-slate-200/80 flex shadow-xs max-w-full overflow-x-auto whitespace-nowrap scrollbar-none flex-nowrap gap-1">
          {(mode === "reception" || mode === "dispatch") ? (
            <>
              <button 
                type="button"
                onClick={() => setMode("reception")}
                className={cn(
                  "px-4 py-2 rounded-lg md:rounded-xl text-[9px] md:text-[10px] font-black uppercase tracking-widest transition-all space-x-1.5 flex items-center justify-center whitespace-nowrap",
                  mode === "reception" ? "bg-emerald-600 text-white shadow-md shadow-emerald-100" : "text-slate-400 hover:bg-slate-50"
                )}
              >
                <ArrowDownLeft size={13} />
                <span>Recepción de Mercadería</span>
              </button>
              <button 
                type="button"
                onClick={() => setMode("dispatch")}
                className={cn(
                  "px-4 py-2 rounded-lg md:rounded-xl text-[9px] md:text-[10px] font-black uppercase tracking-widest transition-all space-x-1.5 flex items-center justify-center whitespace-nowrap",
                  mode === "dispatch" ? "bg-rose-600 text-white shadow-md shadow-rose-100" : "text-slate-400 hover:bg-slate-50"
                )}
              >
                <ArrowUpRight size={13} />
                <span>Despacho de Stock</span>
              </button>
            </>
          ) : (
            <>
              <button 
                type="button"
                onClick={() => setMode("shipments")}
                className={cn(
                  "px-4 py-2 rounded-lg md:rounded-xl text-[9px] md:text-[10px] font-black uppercase tracking-widest transition-all space-x-1.5 flex items-center justify-center whitespace-nowrap",
                  mode === "shipments" ? "bg-slate-900 text-white shadow-md shadow-slate-100" : "text-slate-400 hover:bg-slate-50"
                )}
                title="Monitoreo de Despachos"
              >
                <Truck size={13} />
                <span>Monitoreo Despachos</span>
              </button>
              <button 
                type="button"
                onClick={() => setMode("audit")}
                className={cn(
                  "px-4 py-2 rounded-lg md:rounded-xl text-[9px] md:text-[10px] font-black uppercase tracking-widest transition-all space-x-1.5 flex items-center justify-center whitespace-nowrap",
                  mode === "audit" ? "bg-purple-600 text-white shadow-md shadow-purple-100" : "text-slate-400 hover:bg-slate-50"
                )}
                title="Tomas de Inventario Físico"
              >
                <Barcode size={13} />
                <span>Auditoría Física</span>
              </button>
              <button 
                type="button"
                onClick={() => setMode("alerts")}
                className={cn(
                  "px-4 py-2 rounded-lg md:rounded-xl text-[9px] md:text-[10px] font-black uppercase tracking-widest transition-all space-x-1.5 flex items-center justify-center whitespace-nowrap",
                  mode === "alerts" ? "bg-indigo-600 text-white shadow-md shadow-indigo-100" : "text-slate-400 hover:bg-slate-50"
                )}
                title="Stock Crítico y Analíticas"
              >
                <Bell size={13} />
                <span>Alertas y KPIs</span>
              </button>
              <button 
                type="button"
                onClick={() => setMode("claims")}
                className={cn(
                  "px-4 py-2 rounded-lg md:rounded-xl text-[9px] md:text-[10px] font-black uppercase tracking-widest transition-all space-x-1.5 flex items-center justify-center whitespace-nowrap relative",
                  mode === "claims" ? "bg-rose-600 text-white shadow-md shadow-rose-100" : "text-slate-400 hover:bg-slate-50"
                )}
                title="Reclamos de Soporte"
              >
                <AlertCircle size={13} />
                <span>Reclamos</span>
                {pendingClaimsCount > 0 && (
                  <span className="ml-1.5 px-1.5 py-0.5 bg-rose-600 text-white text-[9px] font-black flex items-center justify-center rounded-full border border-white shadow-xs animate-pulse">
                    {pendingClaimsCount}
                  </span>
                )}
              </button>
            </>
          )}
        </div>
      </div>

      {mode === "audit" ? (
        <div className="w-full space-y-6 text-left">
          {/* STEP 4.2: Tomás de Inventario e Inventario Físico */}
          <div className="bg-gradient-to-r from-purple-900 via-indigo-950 to-slate-900 p-6 rounded-3xl text-white shadow-md border border-purple-900 relative overflow-hidden flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 blur-3xl rounded-full -mr-12 -mt-12" />
            <div className="space-y-1 relative z-10">
              <span className="text-[10px] font-black uppercase tracking-wider bg-white/10 px-2.5 py-1 rounded-full border border-white/10">Fase 4.2: Auditoría Física Continua</span>
              <h2 className="text-2xl font-black tracking-tight mt-1.5">Tomas de Inventario Sistémico vs Real</h2>
              <p className="text-xs text-slate-200 font-medium">
                Escanee códigos de barras de forma masiva para cuadrar stock físico, detectando mermas o excedentes y auto-ajustando la tienda.
              </p>
            </div>
            {isAuditActive && (
              <span className="animate-pulse bg-red-500/15 border border-red-500 text-red-100 text-[10px] font-black tracking-widest uppercase px-3 py-1 rounded-full shrink-0 flex items-center gap-1.5 self-center">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
                Sesión Activa
              </span>
            )}
          </div>

          {!isAuditActive ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Card 1: New empty inventory audit */}
              <div className="bg-white rounded-[2.5rem] p-6 border border-slate-150 shadow-sm flex flex-col justify-between space-y-6">
                <div className="space-y-4">
                  <div className="w-12 h-12 bg-purple-50 text-purple-600 rounded-2xl flex items-center justify-center">
                    <Barcode size={24} />
                  </div>
                  <div className="space-y-1">
                    <h4 className="font-extrabold text-base text-slate-800">Tomas de Inventario desde Cero</h4>
                    <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
                      Inicie el conteo físico de sus productos con valores en cero. Con cada escaneo o ingreso el stock se incrementará.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setAuditScans({});
                    setIsAuditActive(true);
                  }}
                  className="w-full py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-2xl text-[10px] font-extrabold uppercase tracking-widest transition-all cursor-pointer text-center"
                >
                  Comenzar en Cero
                </button>
              </div>

              {/* Card 2: Pre-filled theoretical stock inventory audit */}
              <div className="bg-white rounded-[2.5rem] p-6 border border-slate-150 shadow-sm flex flex-col justify-between space-y-6">
                <div className="space-y-4">
                  <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center">
                    <ClipboardCheck size={24} />
                  </div>
                  <div className="space-y-1">
                    <h4 className="font-extrabold text-base text-slate-800">Pre-cargar Stock Teórico</h4>
                    <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
                      Pre-llena el conteo físico con el stock que figura actualmente en el sistema, lo que permite ir escaneando sólo los ajustes de diferencias.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const preset: Record<string, number> = {};
                    products.forEach(p => {
                      preset[p.id] = p.stock || 0;
                    });
                    setAuditScans(preset);
                    setIsAuditActive(true);
                  }}
                  className="w-full py-3 bg-indigo-600 hover:bg-slate-800 text-white rounded-2xl text-[10px] font-extrabold uppercase tracking-widest transition-all cursor-pointer text-center"
                >
                  Comenzar con Teórico
                </button>
              </div>

              {/* Card 3: Dashboard Stats summary */}
              <div className="bg-slate-900 rounded-[2.5rem] p-6 text-white flex flex-col justify-between space-y-4 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none text-white">
                  <Package size={120} />
                </div>
                <p className="text-[10px] uppercase font-black tracking-widest text-indigo-400">Valor Neto en Bodega</p>
                <div className="space-y-1">
                  <p className="text-3xl font-black">
                    ${products.reduce((acc, p) => acc + ((p.stock || 0) * (p.costPrice || 0)), 0).toLocaleString("es-CL")}
                  </p>
                  <p className="text-[10px] text-slate-400 font-medium leading-relaxed">
                    Valor totalizado por el precio de costo histórico registrado.
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2 border-t border-white/10 pt-4">
                  <div>
                    <span className="text-[9px] text-slate-400 font-bold block uppercase">Líneas de Productos</span>
                    <span className="font-black text-sm">{products.length} SKU</span>
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-400 font-bold block uppercase">Unidades Totales</span>
                    <span className="font-black text-sm">{products.reduce((acc, p) => acc + (p.stock || 0), 0)} un.</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Active Workspace Barcode Scanner */}
              <div className="bg-white rounded-3xl border border-slate-200 p-6 md:p-8 shadow-sm">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                  <div className="md:col-span-8 space-y-1.5">
                    <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Lector de Auditoría Continuo</label>
                    <div className="relative">
                      <Barcode className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                      <input
                        type="text"
                        placeholder="Escanee código de barra con gatillo físico o escriba y presione Enter..."
                        value={auditBarcode}
                        onChange={(e) => setAuditBarcode(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && auditBarcode.trim()) {
                            e.preventDefault();
                            const code = auditBarcode.trim();
                            const prod = products.find(p => p.barcode === code || p.sku === code || (p.barcodes && p.barcodes.includes(code)));
                            if (prod) {
                              setAuditScans(prev => ({
                                ...prev,
                                [prod.id]: (prev[prod.id] || 0) + 1
                              }));
                              setAuditBarcode("");
                              
                              // Trigger temporary alert
                              setAlertConfig({
                                isOpen: true,
                                type: "info",
                                title: "+1 Escaneado",
                                message: `Incrementado "${prod.name}" a ${ (auditScans[prod.id] || 0) + 1 } unidades.`
                              });
                            } else {
                              setAlertConfig({
                                isOpen: true,
                                type: "error",
                                title: "SKU No Encontrado",
                                message: `No se encontró ningún producto con el código de barra o SKU "${code}".`
                              });
                            }
                          }
                        }}
                        className="w-full h-12 pl-12 pr-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-purple-500/10 focus:border-purple-500 outline-none transition-all"
                      />
                    </div>
                  </div>
                  
                  <div className="md:col-span-4 self-end flex gap-2">
                    <button
                      type="button"
                      onClick={() => setIsAuditScanning(true)}
                      className="flex-1 h-12 bg-purple-50 text-purple-600 hover:bg-purple-100 border border-purple-100 px-3 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center space-x-2"
                    >
                      <Camera size={16} />
                      <span>Escanear Cámara</span>
                    </button>
                    {isAuditScanning && (
                      <BarcodeScanner
                        onScan={(code) => {
                          if (code) {
                            const prod = products.find(p => p.barcode === code || p.sku === code || (p.barcodes && p.barcodes.includes(code)));
                            if (prod) {
                              setAuditScans(prev => ({
                                ...prev,
                                [prod.id]: (prev[prod.id] || 0) + 1
                              }));
                              setAlertConfig({
                                isOpen: true,
                                type: "success",
                                title: "Pistoleado con Cámara",
                                message: `Adicionado +1 a "${prod.name}"`
                              });
                            } else {
                              setAlertConfig({
                                isOpen: true,
                                type: "error",
                                title: "Desconocido",
                                message: `No se reconoce el código [${code}]`
                              });
                            }
                          }
                          setIsAuditScanning(false);
                        }}
                        onClose={() => setIsAuditScanning(false)}
                      />
                    )}
                  </div>
                </div>
              </div>

              {/* Product Listing adjustments table */}
              <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-4 bg-slate-50 border-b border-slate-150 flex items-center justify-between text-[10px] font-black uppercase text-slate-500 tracking-wider">
                  <span>Listado de Conciliación Teórico vs Real</span>
                  <span className="text-purple-600 bg-purple-50 px-2 py-0.5 rounded-md">{products.length} SKU Auditoría</span>
                </div>

                <div className="divide-y divide-slate-100 max-h-[450px] overflow-y-auto">
                  {products.map((p) => {
                    const physicalValue = auditScans[p.id] || 0;
                    const systemValue = p.stock || 0;
                    const diff = physicalValue - systemValue;

                    return (
                      <div key={p.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50 transition-colors">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center border border-slate-100 text-slate-400">
                            <Package size={18} />
                          </div>
                          <div>
                            <p className="font-extrabold text-sm text-slate-800 leading-snug">{p.name}</p>
                            <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                              SKU / Barra: {p.barcode || p.sku || "S/Barra"}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-6 justify-between sm:justify-end">
                          <div className="text-right">
                            <span className="text-[8px] font-black uppercase text-slate-400 block">Sistémico (Teórico)</span>
                            <span className="font-black text-sm text-slate-600">{systemValue} un.</span>
                          </div>

                          <div className="space-y-1">
                            <span className="text-[8px] font-black uppercase text-slate-400 ml-1 block text-center">Contado Físico</span>
                            <div className="flex items-center space-x-2">
                              <button
                                type="button"
                                onClick={() => setAuditScans(prev => ({ ...prev, [p.id]: Math.max(0, physicalValue - 1) }))}
                                className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500"
                              >
                                <Minus size={14} />
                              </button>
                              <input
                                type="number"
                                value={physicalValue}
                                onChange={(e) => {
                                  const val = Number(e.target.value);
                                  setAuditScans(prev => ({ ...prev, [p.id]: isNaN(val) || val < 0 ? 0 : val }));
                                }}
                                className="w-12 h-8 text-center bg-slate-50 border border-slate-100 rounded-lg text-xs font-black text-slate-800"
                              />
                              <button
                                type="button"
                                onClick={() => setAuditScans(prev => ({ ...prev, [p.id]: physicalValue + 1 }))}
                                className="w-8 h-8 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-600 flex items-center justify-center"
                              >
                                <Plus size={14} />
                              </button>
                            </div>
                          </div>

                          <div className="text-right w-20">
                            <span className="text-[8px] font-black uppercase text-slate-400 block">Diferencia</span>
                            {diff === 0 ? (
                              <span className="text-[10px] font-extrabold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">Cuadrado</span>
                            ) : diff > 0 ? (
                              <span className="text-[10px] font-extrabold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">+{diff} Sobra</span>
                            ) : (
                              <span className="text-[10px] font-extrabold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-100">{diff} Merma</span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="p-6 bg-slate-50 border-t border-slate-150 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="text-slate-500 text-xs font-medium">
                    Revise cada fila con cuidado. Al guardar, el servidor actualizará los stocks teóricos para alinearse a sus conteos reales de forma automática.
                  </div>
                  <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto shrink-0 justify-end items-stretch sm:items-center">
                    {!showDiscardConfirm ? (
                      <button
                        type="button"
                        onClick={() => setShowDiscardConfirm(true)}
                        className="px-4 py-3 bg-white border border-rose-200 hover:border-rose-300 text-rose-600 text-xs font-black uppercase tracking-wider hover:bg-rose-50 rounded-xl transition-all w-full sm:w-auto text-center"
                      >
                        Descartar Toma
                      </button>
                    ) : (
                      <div className="flex items-center justify-between sm:justify-start gap-2 bg-rose-50 border border-rose-150 p-2 rounded-xl animate-fade-in w-full sm:w-auto">
                        <span className="text-[10px] font-black uppercase text-rose-700 px-1 select-none">¿Descartar toma?</span>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setIsAuditActive(false);
                              setAuditScans({});
                              setShowDiscardConfirm(false);
                            }}
                            className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-[9px] font-black uppercase tracking-wider transition-all"
                          >
                            Sí, Descartar
                          </button>
                          <button
                            type="button"
                            onClick={() => setShowDiscardConfirm(false)}
                            className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-500 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all"
                          >
                            No
                          </button>
                        </div>
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          setIsProcessing(true);
                          const batch = writeBatch(db);
                          let modifiedCount = 0;
                          let mermasTotal = 0;
                          let sobrantesTotal = 0;

                          products.forEach(p => {
                            const physical = auditScans[p.id] || 0;
                            const system = p.stock || 0;
                            const diff = physical - system;

                            if (diff !== 0) {
                              modifiedCount++;
                              if (diff < 0) mermasTotal += Math.abs(diff);
                              if (diff > 0) sobrantesTotal += diff;

                              // Update product stock directly
                              const prodRef = doc(db, "products", p.id);
                              batch.update(prodRef, { stock: physical });

                              // Register stock movement transaction
                              const movementRef = doc(collection(db, "stockMovements"));
                              batch.set(movementRef, {
                                productId: p.id,
                                productName: p.name,
                                type: diff < 0 ? "loss" : "adjustment",
                                subType: "audit_adjustment",
                                quantity: Math.abs(diff),
                                previousStock: system,
                                newStock: physical,
                                reason: diff < 0 ? "Merma / Pérdida detectada en auditoría" : "Ajuste / Sobrante detectado en auditoría",
                                reference: "Auditoría Física",
                                userId: profile?.uid,
                                userName: profile?.name,
                                timestamp: serverTimestamp(),
                                source: "inventory_audit"
                              });
                            }
                          });

                          // Register history record of this audit session
                          const auditRecordRef = doc(collection(db, "inventory_audits"));
                          batch.set(auditRecordRef, {
                            totalCountedSKUs: products.length,
                            modifiedSKUs: modifiedCount,
                            totalMermas: mermasTotal,
                            totalSobrantes: sobrantesTotal,
                            auditedBy: profile?.name || "Pierre Solier",
                            timestamp: serverTimestamp()
                          });

                          await batch.commit();

                          setAlertConfig({
                            isOpen: true,
                            type: "success",
                            title: "✨ Inventario Conciliado ✨",
                            message: `Se ha completado la toma de inventario físico. Se contabilizaron ${products.length} SKU, resolviendo ${modifiedCount} descuadres (${mermasTotal} mermas y ${sobrantesTotal} sobrantes).`
                          });

                          setIsAuditActive(false);
                          setAuditScans({});

                        } catch (e) {
                          console.error(e);
                        } finally {
                          setIsProcessing(false);
                        }
                      }}
                      disabled={isProcessing}
                      className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all disabled:opacity-50 w-full sm:w-auto text-center"
                    >
                      {isProcessing ? "Conciliando..." : "Guardar y Ajustar Catálogo"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : mode === "alerts" ? (
        <div className="w-full space-y-8 text-left">
          {/* STEP 4.3: Stock Alertas y Analíticas logísticas */}
          <div className="bg-gradient-to-r from-indigo-900 to-indigo-950 p-6 rounded-3xl text-white shadow-md relative overflow-hidden flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/15 blur-3xl rounded-full -mr-12 -mt-12" />
            <div className="space-y-1 relative z-10">
              <span className="text-[10px] font-black uppercase tracking-wider bg-white/10 px-2.5 py-1 rounded-full">Fase 4.3: Inteligencia Logística</span>
              <h2 className="text-2xl font-black tracking-tight">Centro de Alertas de Stock y KPIs Graficados</h2>
              <p className="text-xs text-indigo-200 font-medium font-bold uppercase tracking-wider">
                Garantiza el abastecimiento y analice el rendimiento operativo de despachos.
              </p>
            </div>
            {products.filter(p => (p.stock || 0) <= (p.minThreshold || 5)).length > 0 && (
              <div className="bg-rose-500/15 border border-rose-500 px-3 py-1.5 rounded-2xl text-right shrink-0">
                <p className="text-[9px] font-extrabold uppercase text-rose-300">Quiebres críticos</p>
                <div className="flex items-center gap-1.5 justify-end">
                  <AlertTriangle size={14} className="text-rose-500 animate-bounce" />
                  <span className="text-lg font-black text-rose-400">{products.filter(p => (p.stock || 0) <= (p.minThreshold || 5)).length} SKU bajo mínimo</span>
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Critical Alert Center Sidebar left (col-span-5) */}
            <div className="lg:col-span-4 space-y-4">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block ml-1">Quiebre Crítico Emergente</span>
              
              <div className="bg-white rounded-3xl border border-slate-200 p-4 space-y-3 shadow-sm max-h-[460px] overflow-y-auto">
                {products.filter(p => (p.stock || 0) <= (p.minThreshold || 5)).length === 0 ? (
                  <div className="p-8 text-center text-slate-400 space-y-3">
                    <CheckCircle size={32} className="text-emerald-500 mx-auto" />
                    <p className="text-xs font-black uppercase tracking-wider">Stock 100% Cuadrado</p>
                    <p className="text-[11px] text-slate-400">Todos los productos se encuentran sobre el umbral de seguridad.</p>
                  </div>
                ) : (
                  products
                    .filter(p => (p.stock || 0) <= (p.minThreshold || 5))
                    .map((p) => {
                      const supplierName = suppliers.find(s => s.id === p.supplierId)?.name || "Proveedor Independiente";
                      return (
                        <div key={p.id} className="p-3.5 bg-rose-50/50 border border-rose-100 rounded-2xl space-y-3 hover:bg-rose-50 transition-colors">
                          <div className="flex items-start justify-between">
                            <div className="space-y-0.5">
                              <h5 className="font-extrabold text-xs text-slate-800 tracking-tight">{p.name}</h5>
                              <p className="text-[9px] font-black text-slate-400 uppercase">Proveedor: {supplierName}</p>
                            </div>
                            <span className="bg-rose-100 text-rose-800 text-[9px] font-black px-2 py-0.5 rounded-full uppercase shrink-0">
                              {p.stock} un.
                            </span>
                          </div>

                          <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                            <div 
                              className="bg-rose-500 h-full rounded-full" 
                              style={{ width: `${Math.max(10, Math.min(100, Math.round(((p.stock || 0) / (p.minThreshold || 5)) * 100)))}%` }} 
                            />
                          </div>

                          <div className="flex justify-between items-center text-[10px] font-bold text-slate-500">
                            <span>Umbral Alerta: {p.minThreshold || 5} un.</span>
                            <button
                              onClick={() => {
                                setSelectedProductForOC(p);
                                setOcQuantity(50);
                              }}
                              className="px-2.5 py-1 bg-slate-900 text-white rounded-lg text-[9px] font-extrabold uppercase hover:bg-slate-850 active:scale-95 transition-all cursor-pointer"
                            >
                              Reponer Stock
                            </button>
                          </div>
                        </div>
                      );
                    })
                )}
              </div>
            </div>

            {/* Graphics and KPIs right (col-span-8) */}
            <div className="lg:col-span-8 space-y-6">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block ml-1">Análisis de Desempeño Logístico</span>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Visual Chart 1: Stock Total por Categoría */}
                <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-sm space-y-3 flex flex-col justify-between min-w-0 w-full">
                  <h5 className="text-[11px] font-black uppercase tracking-wider text-slate-400">Stock Total por Categoría</h5>
                  <div className="h-44 w-full min-w-0">
                    {(() => {
                      const catData: Record<string, { name: string, stock: number }> = {};
                      products.forEach(p => {
                        const category = categories.find(c => c.id === p.categoryId)?.name || "Otros";
                        const shortName = category.length > 10 ? category.substring(0, 10) + "..." : category;
                        if (!catData[shortName]) {
                          catData[shortName] = { name: shortName, stock: 0 };
                        }
                        catData[shortName].stock += (p.stock || 0);
                      });
                      const dataset = Object.values(catData);
                      return dataset.length === 0 ? (
                        <div className="h-full flex items-center justify-center text-[10px] text-slate-400 font-bold uppercase">Sin registros</div>
                      ) : (
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={dataset}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                            <XAxis dataKey="name" fontSize={9} fontWeight="bold" stroke="#94a3b8" />
                            <YAxis fontSize={9} fontWeight="bold" stroke="#94a3b8" allowDecimals={false} />
                            <RechartsTooltip />
                            <Bar dataKey="stock" fill="#6366f1" radius={[4, 4, 0, 0]} name="Unidades" />
                          </BarChart>
                        </ResponsiveContainer>
                      );
                    })()}
                  </div>
                </div>

                {/* Visual Chart 2: Top 5 Productos por Valor en Bodega */}
                <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-sm space-y-3 flex flex-col justify-between min-w-0 w-full">
                  <h5 className="text-[11px] font-black uppercase tracking-wider text-slate-400">Top 5 Productos de Mayor Valor</h5>
                  <div className="h-44 w-full min-w-0">
                    {(() => {
                      const topValued = [...products]
                        .map(p => ({
                          name: p.name.length > 12 ? p.name.substring(0, 12) + "..." : p.name,
                          valor: (p.stock || 0) * (p.costPrice || 0)
                        }))
                        .sort((a, b) => b.valor - a.valor)
                        .slice(0, 5);
                      return topValued.length === 0 ? (
                        <div className="h-full flex items-center justify-center text-[10px] text-slate-400 font-bold uppercase">Sin productos</div>
                      ) : (
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={topValued} layout="vertical">
                            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                            <XAxis type="number" fontSize={9} fontWeight="bold" stroke="#94a3b8" />
                            <YAxis dataKey="name" type="category" fontSize={9} fontWeight="bold" stroke="#94a3b8" width={65} />
                            <RechartsTooltip />
                            <Bar dataKey="valor" fill="#10b981" radius={[0, 4, 4, 0]} name="Capital ($ CL)" />
                          </BarChart>
                        </ResponsiveContainer>
                      );
                    })()}
                  </div>
                </div>
              </div>

              {/* Visual Chart 3: Stock valuation per category (Area Chart) */}
              <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-4">
                <h5 className="text-[11px] font-black uppercase tracking-wider text-slate-400">Densidad y Capital Inmovilizado por Categoría</h5>
                <div className="h-48 w-full min-w-0">
                  {(() => {
                    const catData: Record<string, { name: string, stock: number, valor: number }> = {};
                    products.forEach(p => {
                      const category = categories.find(c => c.id === p.categoryId)?.name || "Otros Extra";
                      if (!catData[category]) {
                        catData[category] = { name: category, stock: 0, valor: 0 };
                      }
                      catData[category].stock += (p.stock || 0);
                      catData[category].valor += (p.stock || 0) * (p.costPrice || 0);
                    });
                    const dataset = Object.values(catData);
                    return dataset.length === 0 ? (
                      <div className="h-full flex items-center justify-center text-[10px] text-slate-400 font-bold uppercase">No hay categorías configuradas</div>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={dataset}>
                          <defs>
                            <linearGradient id="valGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.2}/>
                              <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                          <XAxis dataKey="name" fontSize={9} fontWeight="bold" stroke="#94a3b8" />
                          <YAxis fontSize={9} fontWeight="bold" stroke="#94a3b8" />
                          <RechartsTooltip />
                          <Area type="monotone" dataKey="valor" stroke="#4f46e5" fillOpacity={1} fill="url(#valGrad)" name="Capital ($ CLP)" />
                        </AreaChart>
                      </ResponsiveContainer>
                    );
                  })()}
                </div>
              </div>
            </div>
          </div>

          {/* Replenish Stock Purchase Order Modal */}
          <AnimatePresence>
            {selectedProductForOC && (
              <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                <motion.div
                  initial={{ scale: 0.95, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.95, opacity: 0 }}
                  className="bg-white rounded-[2.5rem] p-6 md:p-8 max-w-xl w-full border border-slate-100 shadow-2xl relative"
                >
                  <button
                    onClick={() => setSelectedProductForOC(null)}
                    className="absolute right-6 top-6 p-2 bg-slate-50 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-slate-900 transition-all shadow-sm"
                  >
                    <X size={18} />
                  </button>

                  <div className="space-y-6">
                    <div className="flex items-center space-x-3">
                      <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center hover:rotate-12 transition-all">
                        <ShoppingBag size={24} />
                      </div>
                      <div>
                        <span className="text-[9px] font-black text-indigo-600 uppercase tracking-widest block">Orden de Abastecimiento</span>
                        <h4 className="font-extrabold text-base text-slate-800">Reponer Stock Crítico</h4>
                      </div>
                    </div>

                    <p className="text-xs text-slate-500 leading-normal font-medium">
                      Configure el reabastecimiento para el producto <strong>"{selectedProductForOC.name}"</strong>. Se enviará un correo simulado al proveedor asociado.
                    </p>

                    <div className="bg-slate-50 p-4 rounded-2xl space-y-3">
                      <div className="flex justify-between text-xs font-bold text-slate-700">
                        <span>Proveedor:</span>
                        <span className="font-extrabold text-indigo-600">
                          {suppliers.find(s => s.id === selectedProductForOC.supplierId)?.name || "Proveedor Independiente"}
                        </span>
                      </div>
                      <div className="flex justify-between text-xs font-bold text-slate-750">
                        <span>Stock Actual:</span>
                        <span>{selectedProductForOC.stock} unidades</span>
                      </div>
                      <div className="flex items-center justify-between border-t border-slate-200/50 pt-3">
                        <span className="text-xs font-bold text-slate-700">Cantidad a Solicitar:</span>
                        <div className="flex items-center space-x-2">
                          <button
                            type="button"
                            onClick={() => setOcQuantity(prev => Math.max(10, prev - 10))}
                            className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-600"
                          >
                            <Minus size={14} />
                          </button>
                          <input
                            type="number"
                            value={ocQuantity}
                            onChange={(e) => setOcQuantity(Math.max(1, Number(e.target.value)))}
                            className="w-16 h-8 text-center bg-white border border-slate-100 rounded-lg text-xs font-black text-slate-800"
                          />
                          <button
                            type="button"
                            onClick={() => setOcQuantity(prev => prev + 10)}
                            className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center"
                          >
                            <Plus size={14} />
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-1.5 text-left">
                      <label className="text-[9px] font-black uppercase text-slate-400">Asunto del Pedido de Compra</label>
                      <div className="bg-slate-50 border border-slate-100 p-3.5 rounded-xl text-xs font-mono text-slate-600">
                        <p className="font-bold text-slate-700">OC-PROV-{Date.now().toString().slice(-4)}: Reabastecimiento de {selectedProductForOC.name}</p>
                        <p className="mt-2 text-[10px] leading-relaxed">
                          Estimado Proveedor,<br/>
                          Solicitamos el envío inmediato de {ocQuantity} unidades de nuestro SKU: <i>{selectedProductForOC.barcode || selectedProductForOC.sku}</i>. Por favor adjuntar hoja de despacho y factura XML digital.
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-2 pt-2">
                      <button
                        onClick={() => setSelectedProductForOC(null)}
                        className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-2xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer"
                      >
                        Cerrar
                      </button>
                      <button
                        onClick={async () => {
                          try {
                            setIsProcessing(true);
                            
                            // Let's directly increment stock in database to complete the replenishment!
                            const prodRef = doc(db, "products", selectedProductForOC.id);
                            const updatedQty = (selectedProductForOC.stock || 0) + ocQuantity;
                            await updateDoc(prodRef, { stock: updatedQty });

                            // Add a stock movement log of type "purchase"
                            const movementRef = doc(collection(db, "stockMovements"));
                            await setDoc(movementRef, {
                              productId: selectedProductForOC.id,
                              productName: selectedProductForOC.name,
                              type: "purchase",
                              subType: "purchase_refill",
                              quantity: ocQuantity,
                              previousStock: selectedProductForOC.stock || 0,
                              newStock: updatedQty,
                              reason: `Reabastecimiento vía Orden de Compra manual`,
                              reference: `OC-PROV-${Date.now().toString().slice(-4)}`,
                              supplierId: selectedProductForOC.supplierId || null,
                              userId: profile?.uid,
                              userName: profile?.name,
                              timestamp: serverTimestamp(),
                              source: "logistics_replenish"
                            });

                            setAlertConfig({
                              isOpen: true,
                              type: "success",
                              title: "✨ Orden Proprocesada con Éxito ✨",
                              message: `Se ha enviado la orden de compra simulada. Se han acreditado +${ocQuantity} unidades directamente a "${selectedProductForOC.name}" en bodega.`
                            });

                            setSelectedProductForOC(null);

                          } catch (e) {
                            console.error(e);
                          } finally {
                            setIsProcessing(false);
                          }
                        }}
                        disabled={isProcessing}
                        className="flex-[2] py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-xs font-black uppercase tracking-wider shadow-lg shadow-indigo-100 transition-all flex items-center justify-center space-x-2 cursor-pointer"
                      >
                        {isProcessing ? (
                          <RefreshCw className="animate-spin" size={16} />
                        ) : (
                          <>
                            <Mail size={16} />
                            <span>Enviar Orden y Recibir Stock</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>
        </div>
      ) : mode === "shipments" ? (
        <div className="w-full space-y-6 text-left">
          <div className="bg-gradient-to-r from-slate-800 to-slate-900 p-6 rounded-3xl text-white shadow-md relative overflow-hidden flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 blur-3xl rounded-full -mr-12 -mt-12" />
            <div className="space-y-1 relative z-10">
              <span className="text-[10px] font-black uppercase tracking-wider bg-white/10 px-2.5 py-1 rounded-full border border-white/10">Control de Entregas</span>
              <h2 className="text-2xl font-black tracking-tight mt-1.5">Monitoreo de Pedidos y Rutas</h2>
              <p className="text-xs text-slate-200 font-medium">
                Sincronización en tiempo real de rutas activas de reparto con transportistas registrados y estados de entrega.
              </p>
            </div>
          </div>

          <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden">
            {shipmentsLoading ? (
              <div className="p-20 text-center flex flex-col items-center justify-center space-y-4">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-100 border-t-indigo-600" />
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Cargando rutas...</p>
              </div>
            ) : paginatedShipments.length === 0 ? (
              <div className="p-20 text-center">
                <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center text-slate-300 mx-auto mb-4">
                  <Truck size={32} />
                </div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">No hay rutas o pedidos registrados</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[850px] text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/50">
                      <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.15em]">Pedido</th>
                      <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.15em]">Contacto y RUT</th>
                      <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.15em]">Dirección</th>
                      <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.15em]">Conductor</th>
                      <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.15em]">Total</th>
                      <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.15em]">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {paginatedShipments.map((s) => (
                      <tr key={s.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-8 py-4 whitespace-nowrap">
                          <p className="text-sm font-bold text-slate-800">#{s.orderId}</p>
                          <p className="text-[9px] text-slate-400 font-bold uppercase">Ruta Activa</p>
                        </td>
                        <td className="px-8 py-4 whitespace-nowrap">
                          <p className="text-xs font-bold text-slate-700">{s.customerName}</p>
                          <p className="text-[9px] text-slate-400 font-bold uppercase">{s.customerRUT || "RUT General"}</p>
                        </td>
                        <td className="px-8 py-4">
                          <p className="text-xs font-medium text-slate-600 truncate max-w-[220px]" title={s.address}>{s.address}</p>
                        </td>
                        <td className="px-8 py-4 whitespace-nowrap">
                          <p className="text-xs font-bold text-slate-700">{s.driverName || "Por asignar"}</p>
                          <p className="text-[9px] text-slate-400 font-bold">{s.driverPhone || "Sin teléfono"}</p>
                        </td>
                        <td className="px-8 py-4 whitespace-nowrap">
                          <span className="text-sm font-black text-slate-800">{s.total ? `$${Number(s.total).toLocaleString('es-CL')}` : "$0"}</span>
                        </td>
                        <td className="px-8 py-4 whitespace-nowrap">
                          <span className={cn(
                            "px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest inline-block text-center",
                            s.status === 'delivered' ? "bg-emerald-50 text-emerald-700" :
                            s.status === 'in_route' ? "bg-indigo-50 text-indigo-700" : "bg-amber-50 text-amber-700"
                          )}>
                            {s.status === 'delivered' ? "Entregado" :
                             s.status === 'in_route' ? "En Ruta" : "Preparado"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination Controls */}
            {!shipmentsLoading && paginatedShipments.length > 0 && (
              <div className="flex items-center justify-between px-8 py-4 border-t border-slate-100 bg-white">
                <span className="text-xs font-bold text-slate-500">
                  Página <span className="font-extrabold text-slate-800">{shipmentPage}</span>
                </span>
                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => fetchPaginatedShipments("prev")}
                    disabled={shipmentPage === 1 || shipmentsLoading}
                    className="p-2 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-xs"
                    title="Página Anterior"
                  >
                    <ChevronRight className="rotate-180" size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => fetchPaginatedShipments("next")}
                    disabled={!shipmentHasMore || shipmentsLoading}
                    className="p-2 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-xs"
                    title="Siguiente Página"
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : mode === "claims" ? (
        <div className="w-full space-y-6 text-left">
          <div className="bg-gradient-to-r from-rose-900 to-slate-900 p-6 rounded-3xl text-white shadow-md relative overflow-hidden flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 blur-3xl rounded-full -mr-12 -mt-12" />
            <div className="space-y-1 relative z-10">
              <span className="text-[10px] font-black uppercase tracking-wider bg-white/10 px-2.5 py-1 rounded-full border border-white/10">Soporte Operativo</span>
              <h2 className="text-2xl font-black tracking-tight mt-1.5">Reclamos y Devoluciones de Clientes</h2>
              <p className="text-xs text-slate-200 font-medium">
                Administre reclamos de posventa ingresados por clientes desde su portal personal. Revise descripciones, valide adjuntos fotográficos y asigne notas de resolución.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Claims list */}
            <div className="lg:col-span-5 space-y-4">
              <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden p-4 space-y-3">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block ml-1">Listado de Casos</span>
                {claimsLoading ? (
                  <div className="p-12 text-center flex flex-col items-center justify-center space-y-4">
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-rose-100 border-t-rose-600" />
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Cargando reclamos...</p>
                  </div>
                ) : claims.length === 0 ? (
                  <div className="p-12 text-center text-slate-400">
                    <p className="text-[10px] font-black uppercase tracking-widest">No hay reclamos registrados</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {claims.map((claim) => (
                      <button
                        key={claim.id}
                        type="button"
                        onClick={() => {
                          setSelectedClaim(claim);
                          setResolutionText(claim.resolutionNote || "");
                        }}
                        className={cn(
                          "w-full text-left p-4 rounded-2xl border transition-all flex flex-col space-y-2",
                          selectedClaim?.id === claim.id
                            ? "bg-rose-50/50 border-rose-200 shadow-sm"
                            : "bg-white border-slate-100 hover:border-slate-200"
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-black uppercase text-slate-400">Caso #{claim.orderId || "S/N"}</span>
                          <span className={cn(
                            "px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider",
                            claim.status === "resolved" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                          )}>
                            {claim.status === "resolved" ? "Resuelto" : "Pendiente"}
                          </span>
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-800">{claim.customerName}</p>
                          <p className="text-[10px] text-slate-400 font-bold">{claim.customerRUT}</p>
                        </div>
                        <p className="text-[10px] font-black text-rose-600 uppercase tracking-widest">{claim.reason}</p>
                        <p className="text-[10px] text-slate-500 font-medium line-clamp-2 leading-relaxed">{claim.description}</p>
                      </button>
                    ))}

                    {/* Pagination control */}
                    <div className="flex items-center justify-between pt-4 border-t border-slate-50">
                      <span className="text-[10px] font-bold text-slate-400">Pág {claimsPage}</span>
                      <div className="flex space-x-1">
                        <button
                          type="button"
                          onClick={() => fetchPaginatedClaims("prev")}
                          disabled={claimsPage === 1 || claimsLoading}
                          className="p-1.5 rounded-lg border border-slate-100 text-slate-500 disabled:opacity-40"
                        >
                          <ChevronRight className="rotate-180" size={12} />
                        </button>
                        <button
                          type="button"
                          onClick={() => fetchPaginatedClaims("next")}
                          disabled={!claimsHasMore || claimsLoading}
                          className="p-1.5 rounded-lg border border-slate-100 text-slate-500 disabled:opacity-40"
                        >
                          <ChevronRight size={12} />
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Claims details */}
            <div className="lg:col-span-7">
              {selectedClaim ? (
                <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm p-6 space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                    <div>
                      <span className="text-[9px] font-black text-indigo-600 uppercase tracking-widest">Reclamo / Soporte Posventa</span>
                      <h3 className="font-extrabold text-base text-slate-800">Pedido #{selectedClaim.orderId}</h3>
                      <p className="text-[10px] text-slate-400 font-bold">RUT: {selectedClaim.customerRUT}</p>
                    </div>
                    <div>
                      <span className={cn(
                        "px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider",
                        selectedClaim.status === "resolved" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
                      )}>
                        Estado del Caso: {selectedClaim.status === "resolved" ? "Completado y Cerrado" : "Bajo Revisión Técnica"}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <div>
                        <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Cliente Emisor</span>
                        <p className="text-sm font-extrabold text-slate-800">{selectedClaim.customerName}</p>
                      </div>
                      <div>
                        <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Motivo de Reclamo</span>
                        <p className="text-xs font-bold text-rose-600 uppercase tracking-wider">{selectedClaim.reason}</p>
                      </div>
                      <div>
                        <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Descripción del Reclamo</span>
                        <p className="text-xs text-slate-600 leading-relaxed font-medium bg-slate-50 p-4 rounded-2xl border border-slate-100">{selectedClaim.description}</p>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Fotografía Adjunta (Evidencia)</span>
                      {selectedClaim.photo ? (
                        <div className="rounded-2xl overflow-hidden border border-slate-200 max-h-48 aspect-video flex items-center justify-center bg-slate-50">
                          <img 
                            src={selectedClaim.photo} 
                            alt="Evidencia adjunta" 
                            className="object-contain max-h-48 w-full"
                            referrerPolicy="no-referrer"
                          />
                        </div>
                      ) : (
                        <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center text-slate-400 text-xs font-bold flex flex-col items-center justify-center space-y-2">
                          <Camera size={24} />
                          <span>Sin fotografía adjunta</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-100 space-y-4">
                    <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Acción de Soporte Técnico</span>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-500">Comentarios de Resolución / Respuesta para el Cliente:</label>
                      <textarea
                        className="w-full h-24 bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs font-bold focus:ring-4 focus:ring-rose-500/10 focus:border-rose-500 focus:bg-white transition-all resize-none text-slate-800"
                        placeholder="Ej: Estimado cliente, hemos procesado su devolución. Se ha acreditado el reembolso y se generó una nueva guía de despacho de reposición."
                        value={resolutionText}
                        onChange={(e) => setResolutionText(e.target.value)}
                        disabled={selectedClaim.status === "resolved"}
                      />
                    </div>

                    {selectedClaim.status !== "resolved" && (
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            setIsProcessing(true);
                            await updateDoc(doc(db, "claims", selectedClaim.id), {
                              status: "resolved",
                              resolutionNote: resolutionText,
                              resolvedAt: serverTimestamp()
                            });

                            // Create simulated resolution notification for the customer
                            await addDoc(collection(db, "notifications"), {
                              title: "Reclamo Resuelto",
                              message: `Tu reclamo del pedido #${selectedClaim.orderId} fue resuelto: "${resolutionText}"`,
                              type: "success",
                              userId: selectedClaim.customerId,
                              read: false,
                              timestamp: serverTimestamp()
                            });

                            setAlertConfig({
                              isOpen: true,
                              type: "success",
                              title: "Reclamo Resuelto",
                              message: "Se ha enviado la resolución del caso de soporte al cliente de inmediato."
                            });

                            setSelectedClaim(null);
                            fetchPaginatedClaims("init");
                          } catch (e) {
                            console.error(e);
                          } finally {
                            setIsProcessing(false);
                          }
                        }}
                        disabled={isProcessing}
                        className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md flex items-center justify-center gap-1.5"
                      >
                        {isProcessing ? <RefreshCw className="animate-spin" size={14} /> : <CheckCircle size={14} />}
                        <span>Guardar Resolución y Cerrar Caso</span>
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm p-12 text-center text-slate-400 flex flex-col items-center justify-center space-y-4">
                  <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center text-slate-300">
                    <AlertCircle size={32} />
                  </div>
                  <p className="text-[10px] font-black uppercase tracking-widest">Seleccione un reclamo para ver detalles</p>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-8">
        {/* Selection Area */}
        <div className="lg:col-span-12">
          {!selectedProduct ? (
            <div className="bg-white rounded-3xl md:rounded-[2.5rem] p-6 md:p-10 border border-slate-200 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8 opacity-[0.03] pointer-events-none">
                    <Search size={120} />
                </div>
              <div className="max-w-xl mx-auto text-center">
                <div className="w-16 h-16 md:w-20 md:h-20 bg-indigo-50 text-indigo-600 rounded-2xl md:rounded-[2rem] flex items-center justify-center mx-auto mb-4 md:mb-6">
                  <Search size={32} md:size={40} />
                </div>
                <h3 className="text-xl md:text-2xl font-black text-slate-800 mb-2 md:mb-4">Identificar Producto</h3>
                <p className="text-xs md:text-slate-500 mb-6 md:mb-8 font-medium">Usa el lector o busca manualmente por nombre/SKU.</p>
                
                <div className="relative group">
                  <Search className="absolute left-5 md:left-6 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={20} md:size={24} />
                  <input 
                    type="text"
                    placeholder="Escanear o buscar..."
                    className="w-full h-16 md:h-20 bg-slate-50 border border-slate-100 rounded-2xl md:rounded-[2rem] pl-14 md:pl-16 pr-20 text-base md:text-lg font-bold focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 focus:bg-white transition-all text-slate-800"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                  <button 
                    onClick={() => setIsScanning(true)}
                    className="absolute right-4 md:right-6 top-1/2 -translate-y-1/2 w-10 h-10 md:w-12 md:h-12 bg-white rounded-xl md:rounded-2xl flex items-center justify-center text-slate-400 hover:text-indigo-600 transition-all shadow-sm border border-slate-100 active:scale-90"
                    title="Usar Cámara"
                  >
                    <Camera size={20} md:size={24} />
                  </button>
                </div>

                <AnimatePresence>
                  {isScanning && (
                    <BarcodeScanner 
                      onScan={(code) => {
                        if (code) {
                          const product = products.find(p => p.barcode === code || (p.barcodes && p.barcodes.includes(code)));
                          if (product) {
                            setSelectedProduct(product);
                            setUnrecognizedBarcode(null);
                          } else {
                            setUnrecognizedBarcode(code);
                            setSelectedProduct(null);
                            setSearchTerm("");
                          }
                        }
                        setIsScanning(false);
                      }}
                      onClose={() => setIsScanning(false)}
                    />
                  )}
                </AnimatePresence>

                {unrecognizedBarcode && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="mt-6 p-6 bg-amber-50 border border-amber-200 rounded-[2rem] text-left flex items-start space-x-4"
                  >
                    <div className="p-3 bg-white rounded-2xl text-amber-600 shadow-sm">
                      <Tag size={24} />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-black text-amber-900 uppercase tracking-tight">Código no reconocido</p>
                      <p className="text-lg font-bold text-slate-700">[{unrecognizedBarcode}]</p>
                      <p className="text-xs font-medium text-amber-700 mt-1">
                        Este código no pertenece a ningún producto.
                      </p>
                      <div className="flex gap-2 mt-4">
                        <button 
                          onClick={() => {
                            setQuickCreateData({
                              name: "",
                              sku: "",
                              barcode: unrecognizedBarcode || "",
                              costPrice: 0,
                              price: 0,
                              wholesalePrice: 0,
                              wholesaleMinQty: 6,
                              stock: 0,
                              minThreshold: 5,
                              description: "",
                              categoryId: "",
                              supplierId: ""
                            });
                            setIsCreatingCategory(false);
                            setNewCategoryName("");
                            setIsQuickCreateOpen(true);
                          }}
                          className="px-4 py-2.5 bg-amber-600 text-white rounded-xl text-xs font-bold uppercase tracking-wider shadow-sm hover:bg-amber-700 transition-colors"
                        >
                          Crear Nuevo Perfil
                        </button>
                        <p className="text-[10px] sm:text-xs text-amber-600 font-bold self-center">
                          O busca abajo para vincularlo a uno existente
                        </p>
                      </div>
                    </div>
                    <button 
                      onClick={() => setUnrecognizedBarcode(null)}
                      className="p-2 hover:bg-white/50 rounded-lg text-amber-400"
                    >
                      <X size={16} />
                    </button>
                  </motion.div>
                )}

                {searchTerm.length > 0 && (
                  <div className="mt-6 space-y-3">
                    {filteredProducts.map(p => (
                      <button
                        key={p.id}
                        onClick={() => setSelectedProduct(p)}
                        className="w-full p-4 bg-slate-50 hover:bg-indigo-50 rounded-2xl border border-slate-100 hover:border-indigo-200 transition-all flex items-center justify-between group"
                      >
                        <div className="flex items-center space-x-4">
                          <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center text-slate-400 group-hover:text-indigo-500 transition-colors">
                            <Package size={24} />
                          </div>
                          <div className="text-left">
                            <p className="font-bold text-slate-800">{p.name}</p>
                            <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">{p.barcode || p.sku || 'Sin código'}</p>
                          </div>
                        </div>
                        <div className="text-right pr-2">
                          <p className="text-xs font-black text-slate-400 uppercase">Stock actual</p>
                          <p className="font-black text-slate-800">{p.stock || 0}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden"
            >
              <div className={cn(
                "p-4 md:p-8 flex items-center justify-between",
                mode === "reception" ? "bg-emerald-50 text-emerald-800" : "bg-rose-50 text-rose-800"
              )}>
                <div className="flex items-center space-x-3 md:space-x-4">
                  <div className="p-2 md:p-3 bg-white rounded-xl md:rounded-2xl shadow-sm">
                    <Package size={20} md:size={24} className="text-slate-400" />
                  </div>
                  <div>
                    <h3 className="text-sm md:text-xl font-black tracking-tight line-clamp-1">{selectedProduct.name}</h3>
                    {unrecognizedBarcode && (
                      <p className="text-[8px] md:text-[10px] font-black uppercase tracking-widest text-amber-600 mt-0.5">
                        Nuevo cod: {unrecognizedBarcode}
                      </p>
                    )}
                    <p className="text-[8px] md:text-[10px] font-black uppercase tracking-widest opacity-60">
                      Stock: {selectedProduct.stock || 0} {selectedProduct.unit || 'un'}
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => setSelectedProduct(null)}
                  className="p-2 md:p-3 bg-white rounded-xl md:rounded-2xl text-slate-400 hover:text-slate-900 transition-all hover:rotate-90 shadow-sm"
                >
                  <X size={16} md:size={20} />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-6 md:p-10 grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
                <div className="space-y-4 md:space-y-6">
                  <div>
                    <label className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">Tipo de Movimiento</label>
                    <div className="grid grid-cols-2 gap-2">
                      {(mode === "reception" ? [
                        { id: "adjustment", label: "Ajuste / Ingreso", icon: RefreshCw },
                        { id: "purchase", label: "Compra / Prov.", icon: PackageCheck }
                      ] : [
                        { id: "sale", label: "Venta (Mayor/Directa)", icon: PackageCheck },
                        { id: "loss", label: "Pérdida / Merma", icon: AlertTriangle },
                        { id: "withdrawal", label: "Retiro Interno", icon: Truck },
                        { id: "adjustment", label: "Ajuste / Error", icon: RefreshCw }
                      ]).map((type) => (
                        <button
                          key={type.id}
                          type="button"
                          onClick={() => setFormData({...formData, movementType: type.id})}
                          className={cn(
                            "flex items-center space-x-2 px-2 md:px-3 py-2 md:py-3 rounded-lg md:rounded-xl border text-[9px] md:text-[10px] font-black uppercase tracking-tighter transition-all text-left",
                            formData.movementType === type.id 
                              ? "bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-100" 
                              : "bg-white border-slate-100 text-slate-400 hover:border-slate-200"
                          )}
                        >
                          <type.icon size={12} md:size={14} className={formData.movementType === type.id ? "text-white" : "text-slate-300"} />
                          <span className="truncate">{type.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">
                      Cantidad
                    </label>
                    <div className="flex items-center space-x-3 md:space-x-4">
                      <button 
                        type="button"
                        onClick={() => setFormData({...formData, quantity: Math.max(1, formData.quantity - 1)})}
                        className="w-12 h-12 md:w-14 md:h-14 bg-slate-50 rounded-xl md:rounded-2xl flex items-center justify-center text-slate-400 hover:bg-slate-100 transition-colors"
                      >
                        <Minus size={18} md:size={20} />
                      </button>
                      <input 
                        type="number"
                        inputMode="numeric"
                        min="1"
                        className="flex-1 h-12 md:h-14 bg-slate-50 border border-slate-100 rounded-xl md:rounded-2xl px-3 md:px-5 text-center text-lg md:text-xl font-black text-slate-800"
                        value={formData.quantity}
                        onChange={(e) => setFormData({...formData, quantity: Number(e.target.value)})}
                      />
                      <button 
                        type="button"
                        onClick={() => setFormData({...formData, quantity: formData.quantity + 1})}
                        className="w-12 h-12 md:w-14 md:h-14 bg-slate-50 rounded-xl md:rounded-2xl flex items-center justify-center text-slate-400 hover:bg-slate-100 transition-colors"
                      >
                        <Plus size={18} md:size={20} />
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">Referencia / Documento</label>
                    <div className="relative group">
                      <input 
                        type="text"
                        placeholder={
                          formData.movementType === "sale" 
                            ? "Ej: Boleta #123, Factura #456" 
                            : "Ej: Guía de Despacho #789"
                        }
                        className="w-full h-14 bg-slate-50 border border-slate-100 rounded-2xl px-5 text-sm font-bold focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 focus:bg-white transition-all text-slate-800 pr-32"
                        value={formData.reference}
                        onChange={(e) => setFormData({...formData, reference: e.target.value})}
                      />
                      <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center space-x-1">
                        {mode === "dispatch" && formData.movementType === "sale" ? (
                          <>
                            <button 
                              type="button"
                              onClick={() => {
                                const num = Math.floor(100000 + Math.random() * 900000);
                                setFormData({...formData, reference: `BOL-${num}`});
                              }}
                              className="bg-white border border-slate-100 px-2 py-1 rounded-lg text-[9px] font-black text-slate-400 hover:text-indigo-600 hover:border-indigo-100 transition-all shadow-sm"
                            >
                              BOL
                            </button>
                            <button 
                              type="button"
                              onClick={() => {
                                const num = Math.floor(100000 + Math.random() * 900000);
                                setFormData({...formData, reference: `FACT-${num}`});
                              }}
                              className="bg-white border border-slate-100 px-2 py-1 rounded-lg text-[9px] font-black text-slate-400 hover:text-emerald-600 hover:border-emerald-100 transition-all shadow-sm"
                            >
                              FACT
                            </button>
                          </>
                        ) : (
                          <>
                            <button 
                              type="button"
                              onClick={() => {
                                const num = Math.floor(100000 + Math.random() * 900000);
                                setFormData({...formData, reference: `GUIA-${num}`});
                              }}
                              className="bg-white border border-slate-100 px-2 py-1 rounded-lg text-[9px] font-black text-slate-400 hover:text-indigo-600 hover:border-indigo-100 transition-all shadow-sm"
                            >
                              GUIA
                            </button>
                            {mode === "reception" && (
                              <button 
                                type="button"
                                onClick={() => {
                                  const num = Math.floor(100000 + Math.random() * 900000);
                                  setFormData({...formData, reference: `FACT-${num}`});
                                }}
                                className="bg-white border border-slate-100 px-2 py-1 rounded-lg text-[9px] font-black text-slate-400 hover:text-emerald-600 hover:border-emerald-100 transition-all shadow-sm"
                              >
                                COMPRA
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {mode === "dispatch" && formData.movementType === "sale" && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}>
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">Cliente (Mayorista/Directo)</label>
                      <div className="relative mb-3">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input 
                          type="text"
                          placeholder="Buscar cliente por nombre o RUT..."
                          className="w-full h-12 bg-slate-50 border border-slate-100 rounded-xl pl-12 pr-4 text-xs font-bold focus:ring-2 focus:ring-indigo-500/20"
                          value={customerSearch}
                          onChange={(e) => setCustomerSearch(e.target.value)}
                        />
                      </div>
                      <div className="grid grid-cols-1 gap-2">
                        {filteredCustomers.map(c => (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => {
                              setFormData({...formData, customerId: c.id});
                              setCustomerSearch(c.name);
                            }}
                            className={cn(
                              "text-left p-3 rounded-xl border transition-all flex items-center justify-between",
                              formData.customerId === c.id 
                                ? "bg-indigo-50 border-indigo-200" 
                                : "bg-white border-slate-100 hover:border-slate-200"
                            )}
                          >
                            <div>
                                <p className="text-[11px] font-bold text-slate-700">{c.name}</p>
                                <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest">{c.rut || c.taxId || "Sin RUT"}</p>
                            </div>
                            {formData.customerId === c.id && <PackageCheck size={14} className="text-indigo-600" />}
                          </button>
                        ))}
                        {customerSearch.length > 0 && filteredCustomers.length === 0 && (
                          <p className="text-[10px] text-slate-400 font-bold text-center py-2 italic">Sin resultados. Se requiere registro previo en CRM.</p>
                        )}
                      </div>
                    </motion.div>
                  )}

                  {mode === "dispatch" && formData.movementType === "withdrawal" && (
                     <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">Sucursal de Destino</label>
                        <input 
                            type="text"
                            placeholder="Ej: Sucursal Centro, Bodega 2, Concon..."
                            className="w-full h-14 bg-slate-50 border border-slate-100 rounded-2xl px-5 text-sm font-bold focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500"
                            value={formData.targetSucursal}
                            onChange={(e) => setFormData({...formData, targetSucursal: e.target.value})}
                        />
                     </motion.div>
                  )}

                  {mode === "dispatch" && (
                    <div className={cn(
                      "p-4 rounded-2xl flex items-center space-x-3 transition-colors",
                      (formData.reason === "Venta No Presencial" || formData.reference.trim() !== "")
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-amber-50 text-amber-700"
                    )}>
                      <div className={cn(
                        "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                        (formData.reason === "Venta No Presencial" || formData.reference.trim() !== "")
                          ? "bg-emerald-100"
                          : "bg-amber-100"
                      )}>
                        {(formData.reason === "Venta No Presencial" || formData.reference.trim() !== "") ? <PackageCheck size={20} /> : <AlertTriangle size={20} />}
                      </div>
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-widest opacity-60">
                          Identificación de Movimiento
                        </p>
                        <p className="text-xs font-bold">
                          {(formData.reason === "Venta No Presencial" || formData.reference.trim() !== "") 
                            ? "VENTA: Se descontará por salida comercial." 
                            : "MERMA: Se registrará como pérdida/ajuste."}
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-6">
                  {mode === "reception" && (
                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">Proveedor Originario</label>
                      <select 
                        className="w-full h-14 bg-slate-50 border border-slate-100 rounded-2xl px-5 text-sm font-bold focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 focus:bg-white transition-all text-slate-800"
                        value={formData.supplierId}
                        onChange={(e) => setFormData({...formData, supplierId: e.target.value})}
                      >
                        <option value="">Seleccionar proveedor...</option>
                        {suppliers.map(s => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">Observaciones / Motivo</label>
                    <textarea 
                      className="w-full min-h-[112px] bg-slate-50 border border-slate-100 rounded-2xl p-5 text-sm font-bold focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 focus:bg-white transition-all text-slate-800 resize-none"
                      placeholder="Detalles adicionales..."
                      value={formData.reason}
                      onChange={(e) => setFormData({...formData, reason: e.target.value})}
                    />
                  </div>
                </div>

                <AnimatePresence>
                  {formError && (
                    <motion.div 
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="md:col-span-2 p-4 bg-rose-50 border border-rose-100 rounded-2xl flex items-center space-x-3 text-rose-800"
                    >
                      <AlertTriangle className="shrink-0" size={20} />
                      <p className="text-xs font-bold">{formError}</p>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="md:col-span-2 pt-4 md:pt-6 border-t border-slate-50 flex flex-col md:flex-row items-center justify-between gap-4 md:gap-6">
                  <div className="flex items-center space-x-3 md:space-x-4 text-slate-400 w-full md:w-auto">
                    <AlertCircle size={18} md:size={20} className="shrink-0" />
                    <div className="text-left leading-tight">
                      <p className="text-[10px] md:text-xs font-bold">
                        Esta acción registrará un movimiento de {mode === "reception" ? 'ingreso' : 'salida'} de {formData.quantity} un.
                      </p>
                    </div>
                  </div>
                  
                  <button 
                    disabled={isProcessing}
                    className={cn(
                      "w-full md:w-auto px-10 py-4 md:px-12 md:py-5 rounded-2xl md:rounded-[2rem] font-black uppercase tracking-widest text-[10px] md:text-xs flex items-center justify-center space-x-3 shadow-xl transition-all hover:scale-105 active:scale-95 disabled:opacity-50",
                      mode === "reception" ? "bg-emerald-600 text-white shadow-emerald-100" : "bg-rose-600 text-white shadow-rose-100"
                    )}
                  >
                    {isProcessing ? <RefreshCw className="animate-spin" size={20} /> : <Save size={20} />}
                    <span>Confirmar {mode === "reception" ? 'Ingreso' : 'Despacho'}</span>
                  </button>
                </div>
              </form>
            </motion.div>
          )}

          {/* Quick Create Modal */}
          <AnimatePresence>
            {isQuickCreateOpen && (
              <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setIsQuickCreateOpen(false)}
                  className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
                />
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9, y: 20 }}
                  className="bg-white rounded-3xl md:rounded-[2.5rem] w-full max-w-xl shadow-2xl relative z-10 overflow-hidden flex flex-col max-h-[90vh]"
                >
                  <div className="p-6 md:p-8 border-b border-slate-100 bg-amber-50/50 flex items-center justify-between shrink-0">
                    <div className="flex items-center space-x-3 text-amber-600">
                      <Plus className="bg-white p-2 rounded-xl shadow-sm border border-amber-100/50" size={24} />
                      <div>
                        <h3 className="text-lg md:text-xl font-bold text-slate-800 tracking-tight leading-none">Alta de Producto</h3>
                        <p className="text-[10px] font-bold uppercase tracking-wider mt-1.5 text-amber-700/80">Creación rápida en logística</p>
                      </div>
                    </div>
                    <button 
                      onClick={() => setIsQuickCreateOpen(false)}
                      className="text-slate-400 hover:text-slate-600 p-2 hover:bg-slate-100 rounded-full transition-colors cursor-pointer"
                    >
                      <X size={20} />
                    </button>
                  </div>

                  <form onSubmit={handleQuickCreate} className="flex-1 overflow-y-auto p-6 md:p-8 space-y-4 md:space-y-6 text-slate-700">
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1 mb-1 block">Nombre Comercial *</label>
                      <input 
                        required
                        type="text" 
                        placeholder="Ej: Stevia Endulzante 180ml"
                        className="w-full h-12 bg-slate-50 border border-slate-105 rounded-xl px-4 text-sm font-bold focus:ring-4 focus:ring-amber-500/10 focus:border-amber-500 transition-all outline-none"
                        value={quickCreateData.name}
                        onChange={e => setQuickCreateData({...quickCreateData, name: e.target.value})}
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1 mb-1 block">Código de Barras / EAN-13 * (IBAN)</label>
                        <input 
                          required
                          type="text" 
                          placeholder="Ej: 75041670"
                          className="w-full h-12 bg-slate-50 border border-slate-105 rounded-xl px-4 text-sm font-bold focus:ring-4 focus:ring-amber-500/10 focus:border-amber-500 transition-all outline-none"
                          value={quickCreateData.barcode}
                          onChange={e => setQuickCreateData({...quickCreateData, barcode: e.target.value})}
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1 mb-1 block">SKU / Código Único</label>
                        <input 
                          type="text" 
                          placeholder="Ej: STE-180ML"
                          className="w-full h-12 bg-slate-50 border border-slate-105 rounded-xl px-4 text-sm font-bold focus:ring-4 focus:ring-amber-500/10 focus:border-amber-500 transition-all outline-none"
                          value={quickCreateData.sku}
                          onChange={e => setQuickCreateData({...quickCreateData, sku: e.target.value})}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1 mb-1 block">Precio Costo ($) *</label>
                        <input 
                          required
                          type="number" 
                          min="0"
                          placeholder="0"
                          className="w-full h-12 bg-slate-50 border border-slate-105 rounded-xl px-4 text-sm font-bold focus:ring-4 focus:ring-amber-500/10 focus:border-amber-500 transition-all outline-none"
                          value={quickCreateData.costPrice || ""}
                          onChange={e => setQuickCreateData({...quickCreateData, costPrice: Number(e.target.value)})}
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1 mb-1 block">Precio Venta ($) *</label>
                        <input 
                          required
                          type="number" 
                          min="0"
                          placeholder="0"
                          className="w-full h-12 bg-slate-50 border border-slate-105 rounded-xl px-4 text-sm font-bold focus:ring-4 focus:ring-amber-500/10 focus:border-amber-500 transition-all outline-none"
                          value={quickCreateData.price || ""}
                          onChange={e => setQuickCreateData({...quickCreateData, price: Number(e.target.value)})}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1 mb-1 block">Precio Mayorista ($)</label>
                        <input 
                          type="number" 
                          min="0"
                          placeholder="Mismo que venta si vacío"
                          className="w-full h-12 bg-slate-50 border border-slate-105 rounded-xl px-4 text-sm font-bold focus:ring-4 focus:ring-amber-500/10 focus:border-amber-500 transition-all outline-none"
                          value={quickCreateData.wholesalePrice || ""}
                          onChange={e => setQuickCreateData({...quickCreateData, wholesalePrice: Number(e.target.value)})}
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1 mb-1 block">Uds. Mínimas Mayorista</label>
                        <input 
                          type="number" 
                          min="1"
                          placeholder="6"
                          className="w-full h-12 bg-slate-50 border border-slate-105 rounded-xl px-4 text-sm font-bold focus:ring-4 focus:ring-amber-500/10 focus:border-amber-500 transition-all outline-none"
                          value={quickCreateData.wholesaleMinQty}
                          onChange={e => setQuickCreateData({...quickCreateData, wholesaleMinQty: Number(e.target.value)})}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1 mb-1 block block">Categoría *</label>
                        {!isCreatingCategory ? (
                          <div className="flex gap-2">
                            <select 
                              required
                              className="flex-1 h-12 bg-slate-50 border border-slate-105 rounded-xl px-3 text-sm font-bold focus:ring-4 focus:ring-amber-500/10 focus:border-amber-500 outline-none transition-all cursor-pointer"
                              value={quickCreateData.categoryId}
                              onChange={e => setQuickCreateData({...quickCreateData, categoryId: e.target.value})}
                            >
                              <option value="">Seleccionar...</option>
                              {categories.map(c => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                              ))}
                            </select>
                            <button
                              type="button"
                              onClick={() => {
                                setIsCreatingCategory(true);
                                setNewCategoryName("");
                              }}
                              className="px-3 bg-indigo-50 text-indigo-600 rounded-xl text-xs font-bold hover:bg-indigo-100 transition-all cursor-pointer shrink-0 flex items-center justify-center space-x-1"
                            >
                              <Plus size={16} />
                              <span>Nueva</span>
                            </button>
                          </div>
                        ) : (
                          <div className="flex gap-1.5">
                            <input 
                              type="text"
                              required
                              placeholder="Nueva Categoría..."
                              className="flex-1 h-12 bg-slate-50 border border-dashed border-indigo-200 rounded-xl px-3 text-xs font-bold focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all"
                              value={newCategoryName}
                              onChange={e => setNewCategoryName(e.target.value)}
                              onKeyDown={e => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  handleCreateCategoryQuickly();
                                }
                              }}
                            />
                            <button
                              type="button"
                              onClick={handleCreateCategoryQuickly}
                              className="px-2.5 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition-all shadow-sm cursor-pointer whitespace-nowrap shrink-0"
                            >
                              OK
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setIsCreatingCategory(false);
                                setNewCategoryName("");
                              }}
                              className="px-2 bg-slate-100 text-slate-500 rounded-xl text-xs font-bold hover:bg-slate-200 cursor-pointer shrink-0"
                            >
                              X
                            </button>
                          </div>
                        )}
                      </div>

                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1 mb-1 block">Proveedor Asociado</label>
                        <select 
                          className="w-full h-12 bg-slate-50 border border-slate-105 rounded-xl px-4 text-sm font-bold focus:ring-4 focus:ring-amber-500/10 focus:border-amber-500 outline-none transition-all cursor-pointer"
                          value={quickCreateData.supplierId}
                          onChange={e => setQuickCreateData({...quickCreateData, supplierId: e.target.value})}
                        >
                          <option value="">Ninguno / Seleccionar...</option>
                          {suppliers.map(s => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1 mb-1 block">Stock Inicial / Cantidad a Recepcionar *</label>
                        <input 
                          type="number" 
                          min="0"
                          placeholder="Ej: 50"
                          className="w-full h-12 bg-slate-50 border border-slate-105 rounded-xl px-4 text-sm font-bold focus:ring-4 focus:ring-amber-500/10 focus:border-amber-500 transition-all outline-none"
                          value={quickCreateData.stock || ""}
                          onChange={e => setQuickCreateData({...quickCreateData, stock: Number(e.target.value)})}
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1 mb-1 block">Stock Mínimo Alerta</label>
                        <input 
                          type="number" 
                          min="1"
                          placeholder="5"
                          className="w-full h-12 bg-slate-50 border border-slate-105 rounded-xl px-4 text-sm font-bold focus:ring-4 focus:ring-amber-500/10 focus:border-amber-500 transition-all outline-none"
                          value={quickCreateData.minThreshold}
                          onChange={e => setQuickCreateData({...quickCreateData, minThreshold: Number(e.target.value)})}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1 mb-1 block">Descripción breve</label>
                      <textarea 
                        rows={2}
                        placeholder="Uso, sabor, empaque o presentación del producto..."
                        className="w-full bg-slate-50 border border-slate-105 rounded-xl p-4 text-sm font-bold focus:ring-4 focus:ring-amber-500/10 focus:border-amber-500 transition-all outline-none resize-none"
                        value={quickCreateData.description}
                        onChange={e => setQuickCreateData({...quickCreateData, description: e.target.value})}
                      />
                    </div>

                    <div className="pt-4 flex flex-col sm:flex-row gap-3 w-full">
                      <button 
                        type="button"
                        onClick={() => setIsQuickCreateOpen(false)}
                        className="w-full sm:flex-1 py-4 bg-slate-100 text-slate-500 rounded-2xl font-bold uppercase tracking-wider text-[13px] hover:bg-slate-200 transition-all min-h-[3.25rem] md:min-h-[3.5rem] flex items-center justify-center cursor-pointer border border-slate-200"
                      >
                        Cerrar
                      </button>
                      <button 
                        type="submit"
                        disabled={isProcessing}
                        className="w-full sm:flex-[2] py-4 bg-amber-600 hover:bg-amber-700 text-white rounded-2xl font-bold uppercase tracking-wider text-[13px] shadow-lg shadow-amber-100 transition-all min-h-[3.25rem] md:min-h-[3.5rem] flex items-center justify-center cursor-pointer"
                      >
                        {isProcessing ? <RefreshCw className="animate-spin" size={20} /> : "Registrar Producto"}
                      </button>
                    </div>
                  </form>
                </motion.div>
              </div>
            )}
          </AnimatePresence>

          <ModernAlert
            isOpen={alertConfig.isOpen}
            onClose={() => setAlertConfig(prev => ({ ...prev, isOpen: false }))}
            title={alertConfig.title}
            message={alertConfig.message}
            type={alertConfig.type}
          />
        </div>
      </div>
      )}
    </div>
  );
}
