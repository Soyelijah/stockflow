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
  AlertTriangle
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { cn } from "../lib/utils";
import { motion, AnimatePresence } from "motion/react";

export function Logistics() {
  const { profile } = useAuth();
  const [products, setProducts] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [unrecognizedBarcode, setUnrecognizedBarcode] = useState<string | null>(null);
  const [isQuickCreateOpen, setIsQuickCreateOpen] = useState(false);
  const [mode, setMode] = useState<"reception" | "dispatch">("reception");
  const [isProcessing, setIsProcessing] = useState(false);
  
  const [formData, setFormData] = useState({
    quantity: 1,
    reason: "",
    supplierId: "",
    reference: "",
    movementType: "" as string, 
  });

  const [quickCreateData, setQuickCreateData] = useState({
    name: "",
    price: 0,
    costPrice: 0,
    categoryId: ""
  });

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
    return () => { unsubProds(); unsubSupps(); unsubCats(); };
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

  const handleQuickCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!unrecognizedBarcode || isProcessing) return;
    setIsProcessing(true);

    try {
      const cat = categories.find(c => c.id === quickCreateData.categoryId);
      const prodRef = await addDoc(collection(db, "products"), {
        ...quickCreateData,
        barcode: unrecognizedBarcode,
        barcodes: [unrecognizedBarcode],
        category: cat?.name || "Sin Categoría",
        stock: 0,
        minThreshold: 5,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        updatedBy: profile?.name
      });

      // After creation, select it
      setSelectedProduct({
        id: prodRef.id,
        ...quickCreateData,
        barcode: unrecognizedBarcode,
        barcodes: [unrecognizedBarcode],
        category: cat?.name || "Sin Categoría",
        stock: 0
      });
      setIsQuickCreateOpen(false);
      setUnrecognizedBarcode(null);
    } catch (err) {
      alert("Error al crear producto rápido");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct) return;
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

      const isEntry = mode === "reception";
      const actualType = formData.movementType || (isEntry ? "adjustment" : "loss");

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
      setFormData({ quantity: 1, reason: "", supplierId: "", reference: "" });
      alert(mode === "reception" ? "Stock cargado correctamente" : "Despacho registrado correctamente");

    } catch (error) {
      console.error(error);
      alert("Error al procesar el movimiento");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Informational Banner about Non-Face-to-Face Sales */}
      <div className="bg-slate-900 text-white rounded-[2rem] p-6 flex flex-col md:flex-row items-center gap-6 border-b-4 border-indigo-500/30">
        <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center shrink-0">
          <Truck className="text-indigo-400" size={32} />
        </div>
        <div className="flex-1">
          <h4 className="text-sm font-black uppercase tracking-tight text-indigo-400 mb-1">¿Ventas no presenciales?</h4>
          <p className="text-xs text-slate-300 font-medium leading-relaxed">
            Si vendes por WhatsApp, Redes Sociales o Teléfono, realiza la venta primero en el <strong className="text-white">PDV (Punto de Venta)</strong> para registrar el pago, y luego usa este panel (<strong>Despacho</strong>) para registrar la salida física del producto cuando el repartidor lo retire.
          </p>
        </div>
        <div className="px-5 py-2 bg-indigo-500/20 border border-indigo-500/30 rounded-xl text-[9px] font-black uppercase tracking-widest text-indigo-300">
          Proceso Logístico
        </div>
      </div>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black text-slate-800 tracking-tight">Logística</h1>
          <p className="text-slate-500 font-medium mt-1">Recepción y despacho profesional de mercadería.</p>
        </div>
        
        <div className="bg-white p-1.5 rounded-[1.5rem] border border-slate-200 flex shadow-sm">
          <button 
            onClick={() => setMode("reception")}
            className={cn(
              "px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all space-x-2 flex items-center",
              mode === "reception" ? "bg-emerald-600 text-white shadow-lg shadow-emerald-100" : "text-slate-400 hover:bg-slate-50"
            )}
          >
            <ArrowDownLeft size={16} />
            <span>Recepción</span>
          </button>
          <button 
            onClick={() => setMode("dispatch")}
            className={cn(
              "px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all space-x-2 flex items-center",
              mode === "dispatch" ? "bg-rose-600 text-white shadow-lg shadow-rose-100" : "text-slate-400 hover:bg-slate-50"
            )}
          >
            <ArrowUpRight size={16} />
            <span>Despacho</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Selection Area */}
        <div className="lg:col-span-12">
          {!selectedProduct ? (
            <div className="bg-white rounded-[2.5rem] p-10 border border-slate-200 shadow-sm">
              <div className="max-w-xl mx-auto text-center">
                <div className="w-20 h-20 bg-indigo-50 text-indigo-600 rounded-[2rem] flex items-center justify-center mx-auto mb-6">
                  <Search size={40} />
                </div>
                <h3 className="text-2xl font-black text-slate-800 mb-4">Identificar Producto</h3>
                <p className="text-slate-500 mb-8 font-medium">Usa el lector de código de barras o busca manualmente por nombre/SKU.</p>
                
                <div className="relative group">
                  <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={24} />
                  <input 
                    type="text"
                    placeholder="Escanear o buscar..."
                    className="w-full h-20 bg-slate-50 border border-slate-100 rounded-[2rem] pl-16 pr-8 text-lg font-bold focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 focus:bg-white transition-all text-slate-800"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>

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
                          onClick={() => setIsQuickCreateOpen(true)}
                          className="px-4 py-2 bg-amber-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-sm hover:bg-amber-700 transition-colors"
                        >
                          Crear Nuevo Perfil
                        </button>
                        <p className="text-[10px] text-amber-600 font-bold self-center">
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
                "p-8 flex items-center justify-between",
                mode === "reception" ? "bg-emerald-50 text-emerald-800" : "bg-rose-50 text-rose-800"
              )}>
                <div className="flex items-center space-x-4">
                  <div className="p-3 bg-white rounded-2xl shadow-sm">
                    <Package size={24} className="text-slate-400" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black tracking-tight">{selectedProduct.name}</h3>
                    {unrecognizedBarcode && (
                      <p className="text-[10px] font-black uppercase tracking-widest text-amber-600 mt-0.5">
                        Este producto se reconocerá con el nuevo código: {unrecognizedBarcode}
                      </p>
                    )}
                    <p className="text-[10px] font-black uppercase tracking-widest opacity-60">
                      Stock Actual: {selectedProduct.stock || 0} {selectedProduct.unit || 'unidades'}
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => setSelectedProduct(null)}
                  className="p-3 bg-white rounded-2xl text-slate-400 hover:text-slate-900 transition-all hover:rotate-90 shadow-sm"
                >
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-10 grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-6">
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">Tipo de Movimiento</label>
                    <div className="grid grid-cols-2 gap-2">
                      {(mode === "reception" ? [
                        { id: "adjustment", label: "Ajuste / Ingreso", icon: RefreshCw },
                        { id: "purchase", label: "Compra / Proveedor", icon: PackageCheck }
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
                            "flex items-center space-x-2 px-3 py-3 rounded-xl border text-[10px] font-black uppercase tracking-tighter transition-all text-left",
                            formData.movementType === type.id 
                              ? "bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-100" 
                              : "bg-white border-slate-100 text-slate-400 hover:border-slate-200"
                          )}
                        >
                          <type.icon size={14} className={formData.movementType === type.id ? "text-white" : "text-slate-300"} />
                          <span>{type.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">
                      Cantidad a {mode === "reception" ? "Ingresar" : "Retirar"}
                    </label>
                    <div className="flex items-center space-x-4">
                      <button 
                        type="button"
                        onClick={() => setFormData({...formData, quantity: Math.max(1, formData.quantity - 1)})}
                        className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400 hover:bg-slate-100 transition-colors"
                      >
                        <Minus size={20} />
                      </button>
                      <input 
                        type="number"
                        inputMode="numeric"
                        min="1"
                        className="flex-1 h-14 bg-slate-50 border border-slate-100 rounded-2xl px-5 text-center text-xl font-black text-slate-800"
                        value={formData.quantity}
                        onChange={(e) => setFormData({...formData, quantity: Number(e.target.value)})}
                      />
                      <button 
                        type="button"
                        onClick={() => setFormData({...formData, quantity: formData.quantity + 1})}
                        className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400 hover:bg-slate-100 transition-colors"
                      >
                        <Plus size={20} />
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">Referencia / Documento</label>
                    <div className="relative group">
                      <input 
                        type="text"
                        placeholder="Ej: Factura #1234, Guía de Despacho"
                        className="w-full h-14 bg-slate-50 border border-slate-100 rounded-2xl px-5 text-sm font-bold focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 focus:bg-white transition-all text-slate-800 pr-32"
                        value={formData.reference}
                        onChange={(e) => setFormData({...formData, reference: e.target.value})}
                      />
                      <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center space-x-1">
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
                      </div>
                    </div>
                  </div>

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

                <div className="md:col-span-2 pt-6 border-t border-slate-50 flex items-center justify-between gap-6">
                  <div className="flex items-center space-x-4 text-slate-400">
                    <AlertCircle size={20} />
                    <div className="text-left">
                      <p className="text-xs font-bold leading-relaxed max-w-md">
                        Esta acción {mode === "reception" ? 'incrementará' : 'descontará'} {formData.quantity} unidades del inventario maestro.
                      </p>
                      {unrecognizedBarcode && (
                        <p className="text-[10px] text-amber-600 font-black uppercase mt-1">
                          ⚠️ Se agregará este nuevo código a la lista de códigos del producto.
                        </p>
                      )}
                    </div>
                  </div>
                  
                  <button 
                    disabled={isProcessing}
                    className={cn(
                      "px-12 py-5 rounded-[2rem] font-black uppercase tracking-widest text-xs flex items-center space-x-3 shadow-xl transition-all hover:scale-105 active:scale-95 disabled:opacity-50",
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
              <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setIsQuickCreateOpen(false)}
                  className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
                />
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9, y: 20 }}
                  className="bg-white rounded-[2.5rem] w-full max-w-md shadow-2xl relative z-10 overflow-hidden"
                >
                  <div className="p-8 border-b border-slate-100 bg-amber-50/50 flex items-center justify-between">
                    <div className="flex items-center space-x-3 text-amber-600">
                      <Plus className="bg-white p-1.5 rounded-xl shadow-sm" size={32} />
                      <div>
                        <h3 className="text-xl font-black text-slate-800 tracking-tight leading-none">Alta de Producto</h3>
                        <p className="text-[10px] font-black uppercase tracking-widest mt-1 opacity-60">Creación rápida en logística</p>
                      </div>
                    </div>
                  </div>

                  <form onSubmit={handleQuickCreate} className="p-8 space-y-6">
                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">Nombre</label>
                      <input 
                        required
                        type="text" 
                        placeholder="Ej: Corona 330ml"
                        className="w-full h-14 bg-slate-50 border border-slate-100 rounded-2xl px-5 text-sm font-bold focus:ring-4 focus:ring-amber-500/10 focus:border-amber-500 focus:bg-white transition-all text-slate-800"
                        value={quickCreateData.name}
                        onChange={e => setQuickCreateData({...quickCreateData, name: e.target.value})}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">Costo</label>
                        <input 
                          required
                          type="number" 
                          className="w-full h-14 bg-slate-50 border border-slate-100 rounded-2xl px-5 text-sm font-bold focus:ring-4 focus:ring-amber-500/10 focus:border-amber-500 focus:bg-white transition-all text-slate-800"
                          value={quickCreateData.costPrice}
                          onChange={e => setQuickCreateData({...quickCreateData, costPrice: Number(e.target.value)})}
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">Venta</label>
                        <input 
                          required
                          type="number" 
                          className="w-full h-14 bg-slate-50 border border-slate-100 rounded-2xl px-5 text-sm font-bold focus:ring-4 focus:ring-amber-500/10 focus:border-amber-500 focus:bg-white transition-all text-slate-800"
                          value={quickCreateData.price}
                          onChange={e => setQuickCreateData({...quickCreateData, price: Number(e.target.value)})}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">Categoría</label>
                      <select 
                        required
                        className="w-full h-14 bg-slate-50 border border-slate-100 rounded-2xl px-5 text-sm font-bold focus:ring-4 focus:ring-amber-500/10 focus:border-amber-500 focus:bg-white transition-all text-slate-800"
                        value={quickCreateData.categoryId}
                        onChange={e => setQuickCreateData({...quickCreateData, categoryId: e.target.value})}
                      >
                        <option value="">Seleccionar...</option>
                        {categories.map(c => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    </div>

                    <div className="pt-4 flex gap-4">
                      <button 
                        type="button"
                        onClick={() => setIsQuickCreateOpen(false)}
                        className="flex-1 py-4 text-slate-400 font-black uppercase tracking-widest text-[10px]"
                      >
                        Cancelar
                      </button>
                      <button 
                        type="submit"
                        className="flex-[2] py-4 bg-amber-600 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-lg shadow-amber-100"
                      >
                        Registrar e Ingresar
                      </button>
                    </div>
                  </form>
                </motion.div>
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
