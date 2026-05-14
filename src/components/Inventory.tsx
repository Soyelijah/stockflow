import React, { useState, useEffect } from "react";
import { 
  collection, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  query, 
  orderBy,
  writeBatch,
  serverTimestamp
} from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../lib/firebase";
import { 
  Plus, 
  Search, 
  Edit2, 
  Trash2, 
  X, 
  Save, 
  Package, 
  Filter,
  MoreVertical,
  Layers,
  DollarSign,
  ArrowRightLeft
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { cn, formatCurrency } from "../lib/utils";
import { motion, AnimatePresence } from "motion/react";

export function Inventory() {
  const { profile } = useAuth();
  const [products, setProducts] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [formData, setFormData] = useState({
    name: "",
    sku: "",
    price: 0,
    stock: 0,
    minThreshold: 5,
    description: "",
    category: ""
  });

  useEffect(() => {
    const q = query(collection(db, "products"), orderBy("name"));
    const unsub = onSnapshot(q, (snapshot) => {
      const prods = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setProducts(prods);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "products (Inventory)");
    });
    return unsub;
  }, []);

  const openModal = (product: any = null) => {
    if (product) {
      setEditingProduct(product);
      setFormData({
        name: product.name,
        sku: product.sku || "",
        price: product.price,
        stock: product.stock,
        minThreshold: product.minThreshold,
        description: product.description || "",
        category: product.category || ""
      });
    } else {
      setEditingProduct(null);
      setFormData({
        name: "",
        sku: "",
        price: 0,
        stock: 0,
        minThreshold: 5,
        description: "",
        category: ""
      });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingProduct) {
        const stockDiff = formData.stock - editingProduct.stock;
        const batch = writeBatch(db);
        const prodRef = doc(db, "products", editingProduct.id);
        
        batch.update(prodRef, {
          ...formData,
          updatedAt: serverTimestamp(),
          updatedBy: profile?.name
        });

        if (stockDiff !== 0) {
          const txRef = doc(collection(db, "transactions"));
          batch.set(txRef, {
            productId: editingProduct.id,
            productName: formData.name,
            type: stockDiff > 0 ? "in" : "out",
            quantity: Math.abs(stockDiff),
            userId: profile?.uid,
            userName: profile?.name,
            timestamp: serverTimestamp(),
            note: "Ajuste manual"
          });
        }
        await batch.commit();
      } else {
        const prodRef = await addDoc(collection(db, "products"), {
          ...formData,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          updatedBy: profile?.name
        });

        if (formData.stock > 0) {
          await addDoc(collection(db, "transactions"), {
            productId: prodRef.id,
            productName: formData.name,
            type: "in",
            quantity: formData.stock,
            userId: profile?.uid,
            userName: profile?.name,
            timestamp: serverTimestamp(),
            note: "Ingreso inicial"
          });
        }
      }
      setIsModalOpen(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, "products");
    }
  };

  const filteredProducts = products.filter(p => 
    (p.name?.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (p.sku?.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black text-slate-800 tracking-tight">Inventario Global</h1>
          <p className="text-slate-500 font-medium">Control total de existencias y valor de activos.</p>
        </div>
        <button 
          onClick={() => openModal()}
          className="bg-indigo-600 text-white font-bold px-6 py-3 rounded-2xl shadow-xl shadow-indigo-200 hover:bg-indigo-500 hover:-translate-y-0.5 transition-all flex items-center space-x-2"
        >
          <Plus size={20} />
          <span>Añadir Producto</span>
        </button>
      </header>

      {/* Control Bar */}
      <div className="bg-white p-4 rounded-3xl border border-slate-200 flex flex-col sm:flex-row gap-4 items-center shadow-sm">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text" 
            placeholder="Filtrar por nombre, SKU o categoría..."
            className="w-full bg-slate-50 border-none rounded-2xl py-3 pl-12 pr-4 text-sm font-medium focus:ring-2 focus:ring-indigo-500/20 transition-all placeholder:text-slate-400 text-slate-700"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex items-center space-x-2 w-full sm:w-auto">
          <button className="flex-1 sm:flex-none flex items-center justify-center space-x-2 bg-slate-50 text-slate-600 px-4 py-3 rounded-2xl text-sm font-bold border border-transparent hover:border-slate-200 transition-all">
            <Filter size={16} />
            <span>Filtros</span>
          </button>
          <button className="flex-1 sm:flex-none flex items-center justify-center space-x-2 bg-slate-50 text-slate-600 px-4 py-3 rounded-2xl text-sm font-bold border border-transparent hover:border-slate-200 transition-all">
            <Layers size={16} />
            <span>Categorías</span>
          </button>
        </div>
      </div>

      {/* Products Grid/Table */}
      <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50">
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.15em]">Producto y SKU</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.15em]">Valor Unitario</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.15em]">Disponibilidad</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.15em]">Estado</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredProducts.map(product => (
                <motion.tr 
                  layout
                  key={product.id} 
                  className="group hover:bg-indigo-50/20 transition-colors"
                >
                  <td className="px-8 py-5">
                    <div className="flex items-center space-x-4">
                      <div className="w-12 h-12 bg-white border border-slate-100 rounded-2xl flex items-center justify-center text-slate-400 group-hover:scale-110 group-hover:border-indigo-200 group-hover:text-indigo-500 transition-all shadow-sm">
                        <Package size={24} />
                      </div>
                      <div>
                        <p className="font-bold text-slate-800 text-sm">{product.name || "Sin nombre"}</p>
                        <p className="text-[10px] text-slate-400 font-bold tracking-widest uppercase mt-1">{product.sku || "N/A"}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-5">
                    <div className="flex items-center space-x-1 font-black text-slate-700">
                      <span className="text-slate-300 text-xs">$</span>
                      <span>{formatCurrency(product.price || 0).replace(/[$\s]/g, "")}</span>
                    </div>
                  </td>
                  <td className="px-8 py-5">
                    <div className="flex flex-col">
                      <span className={cn(
                        "font-black text-base",
                        Number(product.stock) <= Number(product.minThreshold) ? "text-orange-600" : "text-slate-800"
                      )}>
                        {product.stock || 0} <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">uds</span>
                      </span>
                      <div className="w-20 h-1 bg-slate-100 rounded-full mt-2 overflow-hidden">
                        <div 
                          className={cn(
                            "h-full rounded-full transition-all duration-500",
                            Number(product.stock) <= Number(product.minThreshold) ? "bg-orange-500" : "bg-indigo-500"
                          )}
                          style={{ width: `${Math.min((product.stock / (product.minThreshold * 4)) * 100, 100)}%` }}
                        />
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-5">
                    {Number(product.stock) <= 0 ? (
                      <span className="inline-flex items-center space-x-1.5 px-3 py-1 bg-rose-50 text-rose-600 text-[10px] font-black uppercase tracking-widest rounded-lg border border-rose-100">
                        <div className="w-1.5 h-1.5 bg-rose-500 rounded-full animate-pulse" />
                        <span>Agotado</span>
                      </span>
                    ) : Number(product.stock) <= Number(product.minThreshold) ? (
                      <span className="inline-flex items-center space-x-1.5 px-3 py-1 bg-orange-50 text-orange-600 text-[10px] font-black uppercase tracking-widest rounded-lg border border-orange-100">
                        <div className="w-1.5 h-1.5 bg-orange-500 rounded-full" />
                        <span>Critico</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center space-x-1.5 px-3 py-1 bg-emerald-50 text-emerald-600 text-[10px] font-black uppercase tracking-widest rounded-lg border border-emerald-100">
                        <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                        <span>Saludable</span>
                      </span>
                    )}
                  </td>
                  <td className="px-8 py-5 text-right">
                    <div className="flex items-center justify-end space-x-2">
                      <button 
                        onClick={() => openModal(product)} 
                        className="p-2.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                      >
                        <Edit2 size={18} />
                      </button>
                      <button 
                        className="p-2.5 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-xl transition-all"
                      >
                        <MoreVertical size={18} />
                      </button>
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
          {filteredProducts.length === 0 && (
            <div className="p-20 text-center">
              <div className="w-20 h-20 bg-slate-50 rounded-[2rem] flex items-center justify-center text-slate-200 mx-auto mb-6">
                <Package size={40} />
              </div>
              <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">No hay coincidencias</p>
            </div>
          )}
        </div>
      </div>

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 sm:p-10">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white rounded-[2.5rem] w-full max-w-xl shadow-2xl relative z-10 overflow-hidden"
            >
              <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center space-x-4 text-indigo-600">
                  <div className="p-2 bg-indigo-100 rounded-2xl">
                    <Package size={24} />
                  </div>
                  <h3 className="text-xl font-black text-slate-800 tracking-tight">
                    {editingProduct ? "Actualizar Producto" : "Configurar Producto"}
                  </h3>
                </div>
                <button 
                  onClick={() => setIsModalOpen(false)} 
                  className="p-3 bg-white border border-slate-200 rounded-2xl text-slate-400 hover:text-slate-900 transition-all hover:rotate-90"
                >
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-8 space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="sm:col-span-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">Nombre del Producto</label>
                    <input 
                      required
                      type="text" 
                      className="w-full h-14 bg-slate-50 border border-slate-100 rounded-2xl px-5 text-sm font-bold focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 focus:bg-white transition-all text-slate-800"
                      value={formData.name}
                      onChange={e => setFormData({...formData, name: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">SKU / ID Interno</label>
                    <input 
                      type="text" 
                      className="w-full h-14 bg-slate-50 border border-slate-100 rounded-2xl px-5 text-sm font-bold focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 focus:bg-white transition-all text-slate-800"
                      value={formData.sku}
                      onChange={e => setFormData({...formData, sku: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">Precio Unitario</label>
                    <div className="relative">
                      <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                      <input 
                        required
                        type="number" step="1"
                        className="w-full h-14 bg-slate-50 border border-slate-100 rounded-2xl pl-10 pr-5 text-sm font-bold focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 focus:bg-white transition-all text-slate-800"
                        value={formData.price}
                        onChange={e => setFormData({...formData, price: Number(e.target.value)})}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">Stock Actual</label>
                    <input 
                      required
                      type="number" 
                      className="w-full h-14 bg-slate-50 border border-slate-100 rounded-2xl px-5 text-sm font-bold focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 focus:bg-white transition-all text-slate-800"
                      value={formData.stock}
                      onChange={e => setFormData({...formData, stock: Number(e.target.value)})}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">Min. Emergencia</label>
                    <input 
                      required
                      type="number" 
                      className="w-full h-14 bg-slate-50 border border-slate-100 rounded-2xl px-5 text-sm font-bold focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 focus:bg-white transition-all text-slate-800"
                      value={formData.minThreshold}
                      onChange={e => setFormData({...formData, minThreshold: Number(e.target.value)})}
                    />
                  </div>
                </div>

                <div className="pt-8 border-slate-50 flex flex-col sm:flex-row gap-3">
                  <button 
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 py-4 bg-slate-50 text-slate-500 font-black uppercase tracking-widest text-xs rounded-2xl hover:bg-slate-100 transition-all"
                  >
                    Descartar
                  </button>
                  <button 
                    type="submit"
                    className="flex-[2] py-4 bg-indigo-600 text-white font-black uppercase tracking-widest text-xs rounded-2xl hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 flex items-center justify-center space-x-2"
                  >
                    <Save size={18} />
                    <span>Confirmar Cambios</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
