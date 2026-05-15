import React, { useState, useEffect, useMemo } from "react";
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
  TrendingUp,
  ArrowRightLeft,
  Tag
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { cn, formatCurrency } from "../lib/utils";
import { motion, AnimatePresence } from "motion/react";
import { CategoryManager } from "./CategoryManager";

export function Inventory() {
  const { profile } = useAuth();
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [formData, setFormData] = useState({
    name: "",
    sku: "",
    barcode: "",
    barcodes: [] as string[],
    costPrice: 0,
    price: 0,
    stock: 0,
    minThreshold: 5,
    description: "",
    category: "",
    categoryId: "",
    supplierId: ""
  });
  const [suppliers, setSuppliers] = useState<any[]>([]);

  useEffect(() => {
    const qCats = query(collection(db, "categories"), orderBy("name"));
    const unsubCats = onSnapshot(qCats, (snapshot) => {
      setCategories(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return unsubCats;
  }, []);

  useEffect(() => {
    const qSuppliers = query(collection(db, "suppliers"));
    const unsubSuppliers = onSnapshot(qSuppliers, (snapshot) => {
      setSuppliers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return unsubSuppliers;
  }, []);

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
        barcode: product.barcode || "",
        barcodes: product.barcodes || (product.barcode ? [product.barcode] : []),
        costPrice: product.costPrice || 0,
        price: product.price,
        stock: product.stock,
        minThreshold: product.minThreshold,
        description: product.description || "",
        category: product.category || "",
        categoryId: product.categoryId || "",
        supplierId: product.supplierId || ""
      });
    } else {
      setEditingProduct(null);
      setFormData({
        name: "",
        sku: "",
        barcode: "",
        barcodes: [],
        costPrice: 0,
        price: 0,
        stock: 0,
        minThreshold: 5,
        description: "",
        category: "",
        categoryId: "",
        supplierId: ""
      });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate barcode uniqueness (across primary and array)
    const allFormBarcodes = [...formData.barcodes];
    if (formData.barcode && !allFormBarcodes.includes(formData.barcode)) {
      allFormBarcodes.push(formData.barcode);
    }

    for (const bc of allFormBarcodes) {
      const duplicate = products.find(p => 
        (p.barcode === bc || (p.barcodes && p.barcodes.includes(bc))) && 
        p.id !== editingProduct?.id
      );
      if (duplicate) {
        alert(`Error: El código de barras "${bc}" ya existe en el producto "${duplicate.name}". No se permiten duplicados.`);
        return;
      }
    }

    try {
      const selectedCategory = categories.find(c => c.id === formData.categoryId);
      const finalCategoryName = selectedCategory ? selectedCategory.name : formData.category;

      const finalData = {
        ...formData,
        barcodes: allFormBarcodes, // Keep synced
        category: finalCategoryName,
      };

      if (editingProduct) {
        const stockDiff = formData.stock - editingProduct.stock;
        const batch = writeBatch(db);
        const prodRef = doc(db, "products", editingProduct.id);
        
        batch.update(prodRef, {
          ...finalData,
          updatedAt: serverTimestamp(),
          updatedBy: profile?.name
        });

        if (stockDiff !== 0) {
          const moveRef = doc(collection(db, "stockMovements"));
          batch.set(moveRef, {
            productId: editingProduct.id,
            productName: formData.name,
            type: stockDiff > 0 ? "adjustment" : "loss",
            quantity: Math.abs(stockDiff),
            previousStock: Number(editingProduct.stock) || 0,
            newStock: Number(formData.stock) || 0,
            reason: "Ajuste manual web",
            userId: profile?.uid,
            userName: profile?.name,
            source: "web",
            timestamp: serverTimestamp()
          });
        }
        await batch.commit();
      } else {
        const prodRef = await addDoc(collection(db, "products"), {
          ...finalData,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          updatedBy: profile?.name
        });

        if (formData.stock > 0) {
          await addDoc(collection(db, "stockMovements"), {
            productId: prodRef.id,
            productName: formData.name,
            type: "purchase",
            quantity: formData.stock,
            previousStock: 0,
            newStock: formData.stock,
            reason: "Inventario inicial",
            userId: profile?.uid,
            userName: profile?.name,
            source: "web",
            timestamp: serverTimestamp()
          });
        }
      }
      setIsModalOpen(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, "products");
    }
  };

  const handleDeleteProduct = async (id: string, name: string) => {
    if (!window.confirm(`¿Está seguro de eliminar "${name}"? Esta acción no se puede deshacer.`)) return;
    
    try {
      await deleteDoc(doc(db, "products", id));
      // Log stock movement for deletion
      await addDoc(collection(db, "stockMovements"), {
        productId: id,
        productName: name,
        type: "loss",
        quantity: 0,
        previousStock: 0,
        newStock: 0,
        userId: profile?.uid,
        userName: profile?.name,
        timestamp: serverTimestamp(),
        reason: `Producto eliminado del catálogo`,
        source: "web"
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, "delete product");
    }
  };

  const inventorySummary = useMemo(() => {
    return products.reduce((acc, p) => {
      acc.totalItems += Number(p.stock) || 0;
      acc.totalValue += (Number(p.stock) || 0) * (Number(p.price) || 0);
      acc.totalCost += (Number(p.stock) || 0) * (Number(p.costPrice) || 0);
      return acc;
    }, { totalItems: 0, totalValue: 0, totalCost: 0 });
  }, [products]);

  const potentialProfit = inventorySummary.totalValue - inventorySummary.totalCost;

  const filteredProducts = products.filter(p => 
    (p.name?.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (p.sku?.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (p.category?.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (p.barcodes?.some((bc: string) => bc.includes(searchTerm))) ||
    (p.barcode?.includes(searchTerm))
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

      {/* Stats Summary Area */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white flex items-center justify-between overflow-hidden relative group">
          <div className="relative z-10">
            <p className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em] mb-1">Valor Venta Stock</p>
            <h3 className="text-3xl font-black">{formatCurrency(inventorySummary.totalValue)}</h3>
          </div>
          <div className="w-16 h-16 bg-white/5 rounded-[1.5rem] flex items-center justify-center -rotate-12 group-hover:rotate-0 transition-transform">
            <DollarSign size={32} className="text-white/20" />
          </div>
        </div>

        <div className="bg-white rounded-[2.5rem] p-8 border border-slate-200 flex items-center justify-between overflow-hidden relative group shadow-sm">
          <div className="relative z-10">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Margen Potencial Bruto</p>
            <h3 className="text-3xl font-black text-emerald-600">{formatCurrency(potentialProfit)}</h3>
            <p className="text-[9px] font-bold text-slate-400 mt-1 uppercase">Costo: {formatCurrency(inventorySummary.totalCost)}</p>
          </div>
          <div className="w-16 h-16 bg-emerald-50 rounded-[1.5rem] flex items-center justify-center rotate-12 group-hover:rotate-0 transition-transform">
            <TrendingUp size={32} className="text-emerald-200" />
          </div>
        </div>

        <div className="bg-white rounded-[2.5rem] p-8 border border-slate-200 flex items-center justify-between overflow-hidden relative group shadow-sm">
          <div className="relative z-10">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Unidades en Stock</p>
            <h3 className="text-3xl font-black text-slate-800">{inventorySummary.totalItems}</h3>
          </div>
          <div className="w-16 h-16 bg-slate-50 rounded-[1.5rem] flex items-center justify-center rotate-12 group-hover:rotate-0 transition-transform">
            <Layers size={32} className="text-slate-200" />
          </div>
        </div>
      </div>

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
          <button 
            onClick={() => setIsCategoryModalOpen(true)}
            className="flex-1 sm:flex-none flex items-center justify-center space-x-2 bg-slate-50 text-slate-600 px-4 py-3 rounded-2xl text-sm font-bold border border-transparent hover:border-slate-200 transition-all"
          >
            <Tag size={16} />
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
                        <div className="flex items-center gap-2 mt-1">
                          <p className="text-[10px] text-slate-400 font-bold tracking-widest uppercase">
                            {product.barcode || (product.barcodes && product.barcodes[0]) || "Sin código"}
                            {product.barcodes && product.barcodes.length > 1 && ` (+${product.barcodes.length - 1})`}
                          </p>
                          {product.categoryId && (
                            <span className={cn(
                              "text-[8px] font-black uppercase px-2 py-0.5 rounded-full border",
                              categories.find(c => c.id === product.categoryId)?.color?.replace("bg-", "text-").replace("500", "600") || "text-slate-400",
                              categories.find(c => c.id === product.categoryId)?.color?.replace("bg-", "bg-")?.replace("500", "50") || "bg-slate-50",
                              categories.find(c => c.id === product.categoryId)?.color?.replace("bg-", "border-")?.replace("500", "100") || "border-slate-100"
                            )}>
                              {product.category}
                            </span>
                          )}
                        </div>
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
                        title="Editar"
                      >
                        <Edit2 size={18} />
                      </button>
                      <button 
                        onClick={() => handleDeleteProduct(product.id, product.name)}
                        className="p-2.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
                        title="Eliminar"
                      >
                        <Trash2 size={18} />
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
        {isCategoryModalOpen && (
          <CategoryManager onClose={() => setIsCategoryModalOpen(false)} />
        )}
      </AnimatePresence>

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
                  <div className="sm:col-span-2 space-y-4">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">Códigos de Barra (Escriba y presione Enter para múltiples)</label>
                    <div className="flex flex-wrap gap-2 mb-2">
                      {formData.barcodes.map((bc, idx) => (
                        <span key={idx} className="inline-flex items-center space-x-2 bg-indigo-50 text-indigo-600 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tight">
                          <span>{bc}</span>
                          <button 
                            type="button"
                            onClick={() => setFormData({...formData, barcodes: formData.barcodes.filter((_, i) => i !== idx)})}
                            className="hover:text-indigo-900"
                          >
                            <X size={12} />
                          </button>
                        </span>
                      ))}
                    </div>
                    <div className="relative">
                      <Tag className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                      <input 
                        type="text" 
                        placeholder="Escanee o escriba un código y presione Enter..."
                        className="w-full h-14 bg-slate-50 border border-slate-100 rounded-2xl pl-10 pr-5 text-sm font-bold focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 focus:bg-white transition-all text-slate-800"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            const val = e.currentTarget.value.trim();
                            if (val && !formData.barcodes.includes(val)) {
                              setFormData({...formData, barcodes: [...formData.barcodes, val]});
                              e.currentTarget.value = "";
                            }
                          }
                        }}
                      />
                    </div>
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
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">Costo Unitario</label>
                    <div className="relative">
                      <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                      <input 
                        required
                        type="number" step="1"
                        className="w-full h-14 bg-slate-50 border border-slate-100 rounded-2xl pl-10 pr-5 text-sm font-bold focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 focus:bg-white transition-all text-slate-800"
                        value={formData.costPrice}
                        onChange={e => setFormData({...formData, costPrice: Number(e.target.value)})}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">Precio Venta</label>
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
                  <div className="sm:col-span-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">Categoría</label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <select 
                        className="w-full h-14 bg-slate-50 border border-slate-100 rounded-2xl px-5 text-sm font-bold focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 focus:bg-white transition-all text-slate-800 appearance-none"
                        value={formData.categoryId}
                        onChange={e => setFormData({...formData, categoryId: e.target.value})}
                      >
                        <option value="">Seleccionar categoría...</option>
                        {categories.map(c => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                      <input 
                        type="text" 
                        placeholder="O escribir nueva..."
                        className="w-full h-14 bg-slate-50 border border-slate-100 rounded-2xl px-5 text-sm font-bold focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 focus:bg-white transition-all text-slate-800"
                        value={formData.category}
                        onChange={e => setFormData({...formData, category: e.target.value})}
                      />
                    </div>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">Proveedor</label>
                    <select 
                      className="w-full h-14 bg-slate-50 border border-slate-100 rounded-2xl px-5 text-sm font-bold focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 focus:bg-white transition-all text-slate-800 appearance-none"
                      value={formData.supplierId}
                      onChange={e => setFormData({...formData, supplierId: e.target.value})}
                    >
                      <option value="">Seleccionar proveedor...</option>
                      {suppliers.map(s => (
                        <option key={s.id} value={s.id}>{s.name} ({s.category})</option>
                      ))}
                    </select>
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
