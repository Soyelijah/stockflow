import React, { useState, useEffect } from "react";
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
  Camera
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { cn } from "../lib/utils";
import { motion, AnimatePresence } from "motion/react";
import { BarcodeScanner } from "./ui/BarcodeScanner";
import { ModernAlert } from "./ui/ModernAlert";
import { DeliveryMap } from "./DeliveryMap";
import { Navigation } from "lucide-react";

export function Logistics({ onNavigate }: { onNavigate?: (page: any) => void }) {
  const { profile } = useAuth();
  const [products, setProducts] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [unrecognizedBarcode, setUnrecognizedBarcode] = useState<string | null>(null);
  const [isQuickCreateOpen, setIsQuickCreateOpen] = useState(false);
  const [mode, setMode] = useState<"reception" | "dispatch" | "tracking">("reception");
  const [isProcessing, setIsProcessing] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  
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
    return () => { unsubProds(); unsubSupps(); unsubCats(); unsubCusts(); };
  }, []);

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

  const filteredCustomers = customers.filter(c =>
    c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
    c.rut?.includes(customerSearch) ||
    c.email?.toLowerCase().includes(customerSearch.toLowerCase())
  ).slice(0, 5);

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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 md:gap-6">
        <div className="text-center md:text-left">
          <h1 className="text-2xl md:text-4xl font-black text-slate-800 tracking-tight">Logística</h1>
          <p className="text-xs md:text-slate-500 font-medium mt-1">Recepción y despacho profesional.</p>
        </div>
        
        <div className="bg-white p-1 rounded-2xl md:rounded-[1.5rem] border border-slate-200 flex shadow-sm w-full md:w-auto">
          <button 
            type="button"
            onClick={() => setMode("reception")}
            className={cn(
              "flex-1 md:flex-none px-4 md:px-6 py-2.5 md:py-3 rounded-xl md:rounded-2xl text-[9px] md:text-[10px] font-black uppercase tracking-widest transition-all space-x-2 flex items-center justify-center",
              mode === "reception" ? "bg-emerald-600 text-white shadow-lg shadow-emerald-100" : "text-slate-400 hover:bg-slate-50"
            )}
          >
            <ArrowDownLeft size={14} />
            <span>Recepción</span>
          </button>
          <button 
            type="button"
            onClick={() => setMode("dispatch")}
            className={cn(
              "flex-1 md:flex-none px-4 md:px-6 py-2.5 md:py-3 rounded-xl md:rounded-2xl text-[9px] md:text-[10px] font-black uppercase tracking-widest transition-all space-x-2 flex items-center justify-center",
              mode === "dispatch" ? "bg-rose-600 text-white shadow-lg shadow-rose-100" : "text-slate-400 hover:bg-slate-50"
            )}
          >
            <ArrowUpRight size={14} />
            <span>Despacho</span>
          </button>
          <button 
            type="button"
            onClick={() => setMode("tracking")}
            className={cn(
              "flex-1 md:flex-none px-4 md:px-6 py-2.5 md:py-3 rounded-xl md:rounded-2xl text-[9px] md:text-[10px] font-black uppercase tracking-widest transition-all space-x-2 flex items-center justify-center",
              mode === "tracking" ? "bg-indigo-600 text-white shadow-lg shadow-indigo-100" : "text-slate-400 hover:bg-slate-50"
            )}
          >
            <Navigation size={14} />
            <span>Despachos en Mapa</span>
          </button>
          {onNavigate && (
            <button 
              type="button"
              onClick={() => onNavigate("driver")}
              className="flex-1 md:flex-none px-4 md:px-6 py-2.5 md:py-3 rounded-xl md:rounded-2xl text-[9px] md:text-[10px] font-black uppercase tracking-widest transition-all space-x-2 flex items-center justify-center text-indigo-600 hover:bg-indigo-50 border border-dashed border-indigo-200"
            >
              <Truck size={14} className="animate-bounce" />
              <span>Vista Repartidor</span>
            </button>
          )}
        </div>
      </div>

      {mode === "tracking" ? (
        <div className="w-full">
          <DeliveryMap />
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
                                <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest">{c.rut}</p>
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
