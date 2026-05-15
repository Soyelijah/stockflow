import React, { useState, useEffect } from "react";
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
  History
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { cn } from "../lib/utils";
import { motion, AnimatePresence } from "motion/react";

export function Logistics() {
  const { profile } = useAuth();
  const [products, setProducts] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [mode, setMode] = useState<"reception" | "dispatch">("reception");
  const [isProcessing, setIsProcessing] = useState(false);
  
  const [formData, setFormData] = useState({
    quantity: 1,
    reason: "",
    supplierId: "",
    reference: "" // Invoice number etc
  });

  useEffect(() => {
    const unsubProds = onSnapshot(query(collection(db, "products"), orderBy("name")), (snap) => {
      setProducts(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    const unsubSupps = onSnapshot(query(collection(db, "suppliers"), orderBy("name")), (snap) => {
      setSuppliers(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => { unsubProds(); unsubSupps(); };
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
          const product = products.find(p => p.barcode === barcode);
          if (product) {
            setSelectedProduct(product);
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
    p.sku?.toLowerCase().includes(searchTerm.toLowerCase())
  ).slice(0, 5);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct) return;
    setIsProcessing(true);

    try {
      const batch = writeBatch(db);
      const productRef = doc(db, "products", selectedProduct.id);
      const movementRef = doc(collection(db, "stockMovements"));
      
      const qtyChange = mode === "reception" ? formData.quantity : -formData.quantity;

      batch.update(productRef, {
        stock: increment(qtyChange),
        updatedAt: serverTimestamp()
      });

      batch.set(movementRef, {
        productId: selectedProduct.id,
        productName: selectedProduct.name,
        type: mode === "reception" ? "adjustment" : "loss", // Standard types or custom ones
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
        source: "logistics"
      });

      await batch.commit();
      
      // Reset
      setSelectedProduct(null);
      setSearchTerm("");
      setFormData({ quantity: 1, reason: "", supplierId: "", reference: "" });
      alert(mode === "reception" ? "Stock cargado correctamente" : "Stock rebajado correctamente");

    } catch (error) {
      console.error(error);
      alert("Error al procesar el movimiento");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
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
                    className="w-full h-20 bg-slate-50 border border-slate-100 rounded-[2rem] pl-16 pr-8 text-lg font-bold focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 focus:bg-white transition-all"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>

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
                    <input 
                      type="text"
                      placeholder="Ej: Factura #1234, Guía de Despacho"
                      className="w-full h-14 bg-slate-50 border border-slate-100 rounded-2xl px-5 text-sm font-bold focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 focus:bg-white transition-all text-slate-800"
                      value={formData.reference}
                      onChange={(e) => setFormData({...formData, reference: e.target.value})}
                    />
                  </div>
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
                    <p className="text-xs font-bold leading-relaxed max-w-md">
                      Esta acción {mode === "reception" ? 'incrementará' : 'descontará'} {formData.quantity} unidades del inventario maestro y quedará registrada en el historial.
                    </p>
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
        </div>
      </div>
    </div>
  );
}
