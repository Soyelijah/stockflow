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
  where,
  limit,
  writeBatch,
  serverTimestamp,
  Timestamp,
  getDocs,
  startAfter
} from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../../lib/firebase";
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
  Tag,
  Truck,
  Zap,
  ShoppingCart,
  Camera,
  ChevronLeft,
  ChevronRight,
  FileText
} from "lucide-react";
import { ModernAlert } from "./ui/ModernAlert";
import { BarcodeScanner } from "./ui/BarcodeScanner";
import { useAuth } from "../../contexts/AuthContext";
import { cn, formatCurrency } from "../../lib/utils";
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
    wholesalePrice: 0,
    wholesaleMinQty: 6,
    stock: 0,
    minThreshold: 5,
    description: "",
    image: "",
    category: "",
    categoryId: "",
    supplierId: ""
  });
  const [lastLookupStatus, setLastLookupStatus] = useState<"unused" | "searching" | "found" | "not_found">("unused");
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [isFetchingInfo, setIsFetchingInfo] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [salesVelocity, setSalesVelocity] = useState<Record<string, number>>({});
  
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
    // Calculate sales velocity for all products (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const qSales = query(
      collection(db, "transactions"),
      where("type", "==", "sale"),
      where("timestamp", ">=", Timestamp.fromDate(thirtyDaysAgo))
    );

    const unsubSales = onSnapshot(qSales, (snapshot) => {
      const velocityMap: Record<string, number> = {};
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        // Handle both single product transactions and multi-item orders
        if (data.items) {
          data.items.forEach((item: any) => {
            if (item.id) {
              velocityMap[item.id] = (velocityMap[item.id] || 0) + (Number(item.quantity) || 0);
            }
          });
        } else if (data.productId) {
          velocityMap[data.productId] = (velocityMap[data.productId] || 0) + (Number(data.quantity) || 0);
        }
      });
      
      // Convert to daily velocity
      Object.keys(velocityMap).forEach(id => {
        velocityMap[id] = velocityMap[id] / 30;
      });
      setSalesVelocity(velocityMap);
    });

    return unsubSales;
  }, []);

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

  const PAGE_SIZE = 25;
  const [currentPage, setCurrentPage] = useState(1);
  const [cursors, setCursors] = useState<any[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);

  const fetchProducts = async (direction: "init" | "next" | "prev" = "init") => {
    setLoading(true);
    try {
      let q = query(collection(db, "products"), orderBy("name"));
      
      let targetPage = currentPage;
      if (direction === "next") {
        targetPage = currentPage + 1;
        const lastVisible = cursors[currentPage - 1];
        if (lastVisible) {
          q = query(q, startAfter(lastVisible), limit(PAGE_SIZE));
        } else {
          q = query(q, limit(PAGE_SIZE));
        }
      } else if (direction === "prev") {
        targetPage = Math.max(1, currentPage - 1);
        const prevIndex = targetPage - 1;
        const prevVisible = prevIndex > 0 ? cursors[prevIndex - 1] : null;
        if (prevVisible) {
          q = query(q, startAfter(prevVisible), limit(PAGE_SIZE));
        } else {
          q = query(q, limit(PAGE_SIZE));
        }
      } else {
        targetPage = 1;
        q = query(q, limit(PAGE_SIZE));
      }

      const snap = await getDocs(q);
      const prods = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setProducts(prods);

      const lastVisibleDoc = snap.docs[snap.docs.length - 1];
      if (direction === "init") {
        setCursors([lastVisibleDoc]);
        setCurrentPage(1);
      } else if (direction === "next") {
        setCursors(prev => {
          const nextCursors = [...prev];
          nextCursors[targetPage - 1] = lastVisibleDoc;
          return nextCursors;
        });
        setCurrentPage(targetPage);
      } else if (direction === "prev") {
        setCurrentPage(targetPage);
      }

      setHasMore(snap.docs.length === PAGE_SIZE);
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, "products (Inventory)");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts("init");
  }, []);

  const handleExportCSV = async () => {
    try {
      const snap = await getDocs(query(collection(db, "products"), orderBy("name")));
      const allProds = snap.docs.map(doc => doc.data());

      const headers = ["Nombre", "Categoría", "Precio", "Costo", "Stock Actual", "Stock Mínimo"];
      const csvRows = [
        headers.join(","),
        ...allProds.map(p => {
          const name = `"${(p.name || "").replace(/"/g, '""')}"`;
          const category = `"${(p.category || "").replace(/"/g, '""')}"`;
          const price = Number(p.price) || 0;
          const cost = Number(p.costPrice) || 0;
          const stock = Number(p.stock) || 0;
          const min = Number(p.minThreshold) || 0;
          return [name, category, price, cost, stock, min].join(",");
        })
      ];

      const csvContent = "\uFEFF" + csvRows.join("\n");
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `inventario_completo_${new Date().toISOString().split("T")[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error("Error al exportar inventario a CSV:", err);
      alert("Error al exportar inventario");
    }
  };

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
        wholesalePrice: product.wholesalePrice || product.price,
        wholesaleMinQty: product.wholesaleMinQty || 6,
        stock: product.stock,
        minThreshold: product.minThreshold,
        description: product.description || "",
        image: product.image || "",
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
        wholesalePrice: 0,
        stock: 0,
        minThreshold: 5,
        description: "",
        image: "",
        category: "",
        categoryId: "",
        supplierId: ""
      });
    }
    setIsModalOpen(true);
  };

  const handleBarcodeLookup = async (barcode: string) => {
    if (!barcode) return;
    setIsFetchingInfo(true);
    setLastLookupStatus("searching");
    try {
      const resp = await fetch(`/api/barcode-lookup?barcode=${barcode}`);
      const data = await resp.json();
      if (data.name) {
        setFormData(prev => ({
          ...prev,
          name: data.name,
          description: data.description || prev.description,
          image: data.imageUrl || prev.image,
          category: data.category || prev.category
        }));
        setLastLookupStatus("found");
      } else {
        setLastLookupStatus("not_found");
      }
    } catch (err) {
      console.error("Failed to fetch product info", err);
      setLastLookupStatus("not_found");
    } finally {
      setIsFetchingInfo(false);
    }
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

      // Ensure absolutely no undefined values are passed to Firestore
      const cleanData: any = {};
      Object.entries(formData).forEach(([k, v]) => {
        if (v !== undefined) {
          cleanData[k] = v;
        }
      });

      const finalData = {
        ...cleanData,
        barcodes: allFormBarcodes || [],
        category: finalCategoryName || "",
      };

      const updatedByName = profile?.name || "Admin";
      const userUidVal = profile?.uid || "";

      if (editingProduct) {
        const stockDiff = formData.stock - editingProduct.stock;
        const batch = writeBatch(db);
        const prodRef = doc(db, "products", editingProduct.id);
        
        batch.update(prodRef, {
          ...finalData,
          updatedAt: serverTimestamp(),
          updatedBy: updatedByName
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
            userId: userUidVal,
            userName: updatedByName,
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
          updatedBy: updatedByName
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
            userId: userUidVal,
            userName: updatedByName,
            source: "web",
            timestamp: serverTimestamp()
          });
        }
      }
      setIsModalOpen(false);
      fetchProducts("init");
      setAlertConfig({
        isOpen: true,
        type: "success",
        title: "¡Éxito!",
        message: editingProduct ? `El producto ${formData.name} ha sido actualizado.` : "Producto añadido al inventario."
      });
    } catch (err: any) {
      console.error("Failed to save product:", err);
      let errorMsg = "No se pudo guardar la información del producto.";
      if (err instanceof Error) {
        if (err.message.includes("permission") || err.message.includes("Permission")) {
          errorMsg += " (Detalle: No tiene permisos suficientes en Firestore para crear este producto. Verifique su rol o inicio de sesión)";
        } else {
          try {
            const parsed = JSON.parse(err.message);
            if (parsed.error) {
              errorMsg += ` (Detalle: ${parsed.error})`;
            }
          } catch {
            errorMsg += ` (Detalle: ${err.message})`;
          }
        }
      }
      setAlertConfig({
        isOpen: true,
        type: "error",
        title: "Error de Registro",
        message: errorMsg
      });
      // Don't rethrow to avoid crashing the app environment loop, let the user read the clear UI alert.
    }
  };

  const handleDeleteProduct = async (id: string, name: string) => {
    setAlertConfig({
      isOpen: true,
      type: "delete",
      title: "¿Eliminar Producto?",
      message: `¿Realmente desea eliminar "${name}" del catálogo? Esta acción no se puede deshacer.`,
      onConfirm: async () => {
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
          
          fetchProducts("init");
          
          setAlertConfig(prev => ({
            ...prev,
            isOpen: true,
            type: "success",
            title: "Eliminado",
            message: "El producto ha sido borrado exitosamente.",
            onConfirm: undefined
          }));
        } catch (err: any) {
          console.error(err);
          setAlertConfig({
            isOpen: true,
            type: "error",
            title: "Permiso Denegado",
            message: "No tienes permisos suficientes para eliminar registros."
          });
          handleFirestoreError(err, OperationType.WRITE, "delete product");
        }
      }
    });
  };

  const isAdmin = profile?.role === "admin" || profile?.role === "manager";
  const isLogistics = profile?.role === "logistics";

  const inventorySummary = useMemo(() => {
    return products.reduce((acc, p) => {
      const stock = Number(p.stock) || 0;
      const price = Number(p.price) || 0;
      const cost = Number(p.costPrice) || 0;
      const threshold = Number(p.minThreshold) || 5;

      acc.totalItems += stock;
      acc.totalValue += stock * price;
      acc.totalCost += stock * cost;
      if (stock <= threshold && stock > 0) acc.lowStock++;
      if (stock === 0) acc.outOfStock++;
      return acc;
    }, { totalItems: 0, totalValue: 0, totalCost: 0, lowStock: 0, outOfStock: 0 });
  }, [products]);

  const potentialProfit = inventorySummary.totalValue - inventorySummary.totalCost;
  const [activeTab, setActiveTab] = useState<"all" | "low" | "smart">("all");

  const smartActions = useMemo(() => {
    return products.map(p => {
      const stock = Number(p.stock) || 0;
      const velocity = salesVelocity[p.id] || 0;
      const daysLeft = velocity > 0 ? stock / velocity : Infinity;
      
      if (daysLeft < 7 && velocity > 0) {
        return {
          id: p.id,
          type: "reorder",
          severity: "high",
          title: "Reabastecimiento Urgente",
          message: `${p.name} se agota en ~${Math.round(daysLeft)} días.`,
          action: "Pedir Stock",
          icon: Truck
        };
      }

      if (stock > 20 && velocity === 0 && p.createdAt && (Date.now() - (p.createdAt as any).toDate().getTime() > 1000 * 60 * 60 * 24 * 30)) {
        return {
          id: p.id,
          type: "promotion",
          severity: "medium",
          title: "Optimización de Capital",
          message: `${p.name} sin rotación en 30 días (${formatCurrency(stock * (p.price || 0))} inmovilizados).`,
          action: "Crear Promo",
          icon: Zap
        };
      }

      return null;
    }).filter(Boolean);
  }, [products, salesVelocity]);

  const filteredProducts = products.filter(p => {
    const matchesSearch = (p.name?.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (p.sku?.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (p.category?.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (p.barcodes?.some((bc: string) => bc.includes(searchTerm))) ||
      (p.barcode?.includes(searchTerm));
    
    if (!matchesSearch) return false;

    if (activeTab === "low") {
      const stock = Number(p.stock) || 0;
      const threshold = Number(p.minThreshold) || 5;
      return stock <= threshold;
    }

    if (activeTab === "smart") {
      const velocity = salesVelocity[p.id] || 0;
      if (velocity === 0) return false;
      const daysLeft = p.stock / velocity;
      return daysLeft < 15;
    }

    return true;
  });

  return (
    <div className="space-y-8 max-w-[1600px] mx-auto p-4 md:p-8">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black text-slate-800 tracking-tight">Inventario Global</h1>
          <p className="text-slate-500 font-medium">Control total de existencias y valor de activos.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          {isAdmin && (
            <button
              onClick={handleExportCSV}
              className="bg-white border border-slate-200 text-slate-700 font-bold px-6 py-3 rounded-2xl shadow-sm hover:bg-slate-50 hover:-translate-y-0.5 transition-all flex items-center space-x-2"
            >
              <FileText size={18} className="text-amber-600" />
              <span>Exportar CSV</span>
            </button>
          )}
          <button 
            onClick={() => openModal()}
            className="bg-indigo-600 text-white font-bold px-6 py-3 rounded-2xl shadow-xl shadow-indigo-200 hover:bg-indigo-500 hover:-translate-y-0.5 transition-all flex items-center space-x-2"
          >
            <Plus size={20} />
            <span>Añadir Producto</span>
          </button>
        </div>
      </header>

      {/* Smart Actions Panel */}
      {smartActions.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between px-2">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Sugerencias de la IA</h3>
            <span className="bg-indigo-100 text-indigo-600 text-[8px] font-black px-2 py-0.5 rounded-full uppercase">Beta</span>
          </div>
          <div className="flex overflow-x-auto gap-4 pb-2 scrollbar-hide">
            {smartActions.map((action, idx) => (
              <motion.div 
                key={idx}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.1 }}
                className={cn(
                  "min-w-[300px] p-5 rounded-[2rem] border flex items-start space-x-4 shadow-sm",
                  action.severity === "high" ? "bg-rose-50 border-rose-100" : "bg-indigo-50 border-indigo-100"
                )}
              >
                <div className={cn(
                  "w-12 h-12 rounded-2xl flex items-center justify-center shrink-0",
                  action.severity === "high" ? "bg-rose-100 text-rose-600" : "bg-indigo-100 text-indigo-600"
                )}>
                  <action.icon size={24} />
                </div>
                <div className="flex-1">
                  <p className={cn(
                    "text-[10px] font-black uppercase tracking-widest mb-1",
                    action.severity === "high" ? "text-rose-600" : "text-indigo-600"
                  )}>
                    {action.title}
                  </p>
                  <p className="text-xs font-bold text-slate-700 leading-relaxed mb-3">
                    {action.message}
                  </p>
                  <button 
                    onClick={() => {
                      if (action.type === "reorder") {
                        setSearchTerm(products.find(p => p.id === action.id)?.name || "");
                      } else {
                        openModal(products.find(p => p.id === action.id));
                      }
                    }}
                    className={cn(
                      "text-[9px] font-black uppercase tracking-tighter px-4 py-2 rounded-xl transition-all",
                      action.severity === "high" ? "bg-rose-600 text-white hover:bg-rose-700" : "bg-indigo-600 text-white hover:bg-indigo-700"
                    )}
                  >
                    {action.action}
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Stats Summary Area */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white flex items-center justify-between overflow-hidden relative group">
          <div className="relative z-10">
            <p className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em] mb-1">Inversión (Costo)</p>
            <h3 className="text-3xl font-black">{formatCurrency(inventorySummary.totalCost)}</h3>
          </div>
          <div className="w-16 h-16 bg-white/5 rounded-[1.5rem] flex items-center justify-center -rotate-12 group-hover:rotate-0 transition-transform">
            <DollarSign size={32} className="text-white/20" />
          </div>
        </div>

        <div className="bg-white rounded-[2.5rem] p-8 border border-slate-200 flex items-center justify-between overflow-hidden relative group shadow-sm">
          <div className="relative z-10">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Margen Potencial</p>
            <h3 className="text-3xl font-black text-emerald-600">{formatCurrency(potentialProfit)}</h3>
            <p className="text-[9px] font-bold text-slate-400 mt-1 uppercase">ROI: {inventorySummary.totalCost > 0 ? ((potentialProfit / inventorySummary.totalCost) * 100).toFixed(0) : 0}%</p>
          </div>
          <div className="w-16 h-16 bg-emerald-50 rounded-[1.5rem] flex items-center justify-center rotate-12 group-hover:rotate-0 transition-transform">
            <TrendingUp size={32} className="text-emerald-200" />
          </div>
        </div>

        <div className="bg-white rounded-[2.5rem] p-8 border border-slate-200 flex items-center justify-between overflow-hidden relative group shadow-sm">
          <div className="relative z-10">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Alertas de Stock</p>
            <h3 className="text-3xl font-black text-rose-600">{inventorySummary.lowStock} <span className="text-slate-300">/</span> {inventorySummary.outOfStock}</h3>
            <p className="text-[9px] font-bold text-slate-400 mt-1 uppercase">Crítico / Agotado</p>
          </div>
          <div className="w-16 h-16 bg-rose-50 rounded-[1.5rem] flex items-center justify-center rotate-12 group-hover:rotate-0 transition-transform">
            <ArrowRightLeft size={32} className="text-rose-200" />
          </div>
        </div>

        <div className="bg-white rounded-[2.5rem] p-8 border border-slate-200 flex items-center justify-between overflow-hidden relative group shadow-sm">
          <div className="relative z-10">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Total Unidades</p>
            <h3 className="text-3xl font-black text-slate-800">{inventorySummary.totalItems}</h3>
            <p className="text-[9px] font-bold text-slate-400 mt-1 uppercase">Catálogo: {products.length} SKU</p>
          </div>
          <div className="w-16 h-16 bg-slate-50 rounded-[1.5rem] flex items-center justify-center rotate-12 group-hover:rotate-0 transition-transform">
            <Layers size={32} className="text-slate-200" />
          </div>
        </div>
      </div>

      {/* Control Bar & Tabs */}
      <div className="bg-white p-4 rounded-3xl border border-slate-200 flex flex-col lg:flex-row gap-6 items-center shadow-sm">
        <div className="flex bg-slate-100 p-1 rounded-2xl w-full lg:w-auto overflow-x-auto scrollbar-none whitespace-nowrap">
          <button
            onClick={() => setActiveTab("all")}
            className={cn(
              "flex-1 lg:flex-none px-3 sm:px-6 py-2.5 text-[10px] sm:text-xs font-bold uppercase tracking-wider rounded-xl transition-all cursor-pointer",
              activeTab === "all" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
            )}
          >
            Todos
          </button>
          <button
            onClick={() => setActiveTab("low")}
            className={cn(
              "flex-1 lg:flex-none px-3 sm:px-6 py-2.5 text-[10px] sm:text-xs font-bold uppercase tracking-wider rounded-xl transition-all cursor-pointer",
              activeTab === "low" ? "bg-rose-50 text-rose-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
            )}
          >
            Faltantes
          </button>
          <button
            onClick={() => setActiveTab("smart")}
            className={cn(
              "flex-1 lg:flex-none px-3 sm:px-6 py-2.5 text-[10px] sm:text-xs font-bold uppercase tracking-wider rounded-xl transition-all flex items-center justify-center space-x-1 sm:space-x-2 cursor-pointer",
              activeTab === "smart" ? "bg-indigo-50 text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
            )}
          >
            <TrendingUp size={12} className="shrink-0" />
            <span>Sugerencias IA</span>
          </button>
        </div>

        <div className="relative flex-1 w-full flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Filtrar por nombre, SKU o categoría..."
              className="w-full bg-slate-50 border-none rounded-2xl py-3 pl-12 pr-12 text-sm font-medium focus:ring-2 focus:ring-indigo-500/20 transition-all placeholder:text-slate-400 text-slate-700"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <button 
              onClick={() => setIsScanning(true)}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 bg-white rounded-lg flex items-center justify-center text-slate-400 hover:text-indigo-600 transition-colors shadow-sm"
              title="Escanear Código de Barras"
            >
              <Camera size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Card View + Desktop Table */}
      <div className="bg-white rounded-3xl md:rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden mb-20 md:mb-0">
        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50">
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.15em]">Producto y SKU</th>
                {isAdmin && <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.15em]">Valor Unitario</th>}
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
                        <div className="w-12 h-12 bg-white border border-slate-100 rounded-2xl flex items-center justify-center text-slate-400 shadow-sm overflow-hidden">
                          {product.image ? (
                            <img src={product.image} alt={product.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          ) : (
                            <Package size={24} />
                          )}
                        </div>
                      <div>
                        <p className="font-bold text-slate-800 text-sm truncate max-w-[200px]">{product.name || "Sin nombre"}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <p className="text-[10px] text-slate-400 font-bold tracking-widest uppercase">
                            {product.barcode || (product.barcodes && product.barcodes[0]) || "Sin código"}
                          </p>
                        </div>
                      </div>
                    </div>
                  </td>
                  {isAdmin && (
                    <td className="px-8 py-5">
                      <div className="flex items-center space-x-1 font-black text-slate-700">
                        <span>{formatCurrency(product.price || 0)}</span>
                      </div>
                    </td>
                  )}
                  <td className="px-8 py-5">
                    <div className="flex flex-col">
                      <span className={cn(
                        "font-black text-base",
                        Number(product.stock) <= Number(product.minThreshold) ? "text-orange-600" : "text-slate-800"
                      )}>
                        {product.stock || 0} <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">uds</span>
                      </span>
                    </div>
                  </td>
                  <td className="px-8 py-5">
                    {Number(product.stock) <= 0 ? (
                      <span className="inline-flex items-center space-x-1.5 px-3 py-1 bg-rose-50 text-rose-600 text-[10px] font-black uppercase tracking-widest rounded-lg border border-rose-100">
                        <span>Agotado</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center space-x-1.5 px-3 py-1 bg-emerald-50 text-emerald-600 text-[10px] font-black uppercase tracking-widest rounded-lg border border-emerald-100">
                        <span>En Stock</span>
                      </span>
                    )}
                  </td>
                  <td className="px-8 py-5 text-right">
                    <div className="flex items-center justify-end space-x-2">
                      <button onClick={() => openModal(product)} className="p-2 text-slate-400 hover:text-indigo-600 transition-colors">
                        <Edit2 size={18} />
                      </button>
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile Card View */}
        <div className="md:hidden divide-y divide-slate-100">
          {filteredProducts.map(product => (
            <div key={product.id} className="p-6 flex flex-col space-y-4">
               <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400 overflow-hidden border border-slate-100">
                      {product.image ? (
                        <img src={product.image} alt={product.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        <Package size={28} />
                      )}
                    </div>
                    <div>
                      <h4 className="font-black text-slate-800 tracking-tight">{product.name}</h4>
                      <div className="flex flex-col gap-0.5 mt-1">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">SKU: {product.sku || 'N/A'}</p>
                        <p className="text-[10px] font-black text-indigo-500 uppercase tracking-wider flex items-center gap-1">
                          <span>EAN / IBAN:</span>
                          <span className="font-mono text-xs">{product.barcode || (product.barcodes && product.barcodes[0]) || 'Sin código'}</span>
                        </p>
                      </div>
                    </div>
                  </div>
                  <button onClick={() => openModal(product)} className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400">
                    <Edit2 size={18} />
                  </button>
               </div>
               
               <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-50 p-3 rounded-2xl">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Precio Venta</p>
                    <p className="text-lg font-black text-slate-800 leading-none">{formatCurrency(product.price)}</p>
                  </div>
                  <div className={cn(
                    "p-3 rounded-2xl border",
                    Number(product.stock) <= Number(product.minThreshold) ? "bg-rose-50 border-rose-100" : "bg-emerald-50 border-emerald-100"
                  )}>
                    <p className="text-[9px] font-black opacity-60 uppercase tracking-widest mb-1">Disponible</p>
                    <p className={cn(
                      "text-xl font-black leading-none",
                      Number(product.stock) <= Number(product.minThreshold) ? "text-rose-600" : "text-emerald-600"
                    )}>
                      {product.stock} <span className="text-xs uppercase opacity-60">un</span>
                    </p>
                  </div>
               </div>
            </div>
          ))}
        </div>
          {filteredProducts.length === 0 && (
            <div className="p-20 text-center">
              <div className="w-20 h-20 bg-slate-50 rounded-[2rem] flex items-center justify-center text-slate-200 mx-auto mb-6">
                <Package size={40} />
              </div>
              <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">No hay coincidencias</p>
            </div>
          )}

          {/* Controles de Paginación */}
          {!loading && (
            <div className="flex items-center justify-between px-8 py-5 border-t border-slate-100 bg-slate-50/30">
              <span className="text-xs font-semibold text-slate-500">
                Página <span className="font-bold text-slate-700">{currentPage}</span>
              </span>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => fetchProducts("prev")}
                  disabled={currentPage === 1 || loading}
                  className={cn(
                    "p-2 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition-all flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed shadow-xs"
                  )}
                  title="Página Anterior"
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  onClick={() => fetchProducts("next")}
                  disabled={!hasMore || loading}
                  className={cn(
                    "p-2 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition-all flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed shadow-xs"
                  )}
                  title="Siguiente Página"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </div>

      <AnimatePresence>
        {isCategoryModalOpen && (
          <CategoryManager onClose={() => setIsCategoryModalOpen(false)} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-10">
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
              className="bg-white rounded-[2.5rem] w-full max-w-xl shadow-2xl relative z-10 overflow-hidden flex flex-col max-h-[85vh] sm:max-h-[90vh]"
            >
              <div className="p-6 md:p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50 shrink-0">
                <div className="flex items-center space-x-4 text-indigo-600">
                  <div className="p-2 bg-indigo-100 rounded-2xl">
                    <Package size={24} />
                  </div>
                  <h3 className="text-lg md:text-xl font-black text-slate-800 tracking-tight">
                    {editingProduct ? "Actualizar Producto" : "Configurar Producto"}
                  </h3>
                </div>
                <button 
                  onClick={() => setIsModalOpen(false)} 
                  className="p-2.5 bg-white border border-slate-200 rounded-2xl text-slate-400 hover:text-slate-900 transition-all hover:rotate-90"
                >
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6 text-slate-700">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="sm:col-span-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">Nombre del Producto</label>
                    <div className="flex gap-4">
                      <input 
                        required
                        type="text" 
                        placeholder="Escribe el nombre del producto manualmente"
                        className="flex-1 h-14 bg-slate-50 border border-slate-100 rounded-2xl px-5 text-sm font-bold focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 focus:bg-white transition-all text-slate-800"
                        value={formData.name}
                        onChange={e => setFormData({...formData, name: e.target.value})}
                      />
                      {formData.image && (
                        <div className="w-14 h-14 bg-slate-100 rounded-2xl border border-slate-200 overflow-hidden shrink-0">
                          <img src={formData.image} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        </div>
                      )}
                    </div>
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
                    <div className="flex gap-3">
                      <div className="relative flex-1">
                        <Tag className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input 
                          type="text" 
                          placeholder="Escanee o escriba un código..."
                          className="w-full h-14 bg-slate-50 border border-slate-100 rounded-2xl pl-10 pr-12 text-sm font-bold focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 focus:bg-white transition-all text-slate-800"
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              const val = e.currentTarget.value.trim();
                              if (val && !formData.barcodes.includes(val)) {
                                setFormData(prev => ({
                                  ...prev, 
                                  barcodes: [...prev.barcodes, val],
                                  barcode: prev.barcode || val,
                                  sku: prev.sku || val
                                }));
                                e.currentTarget.value = "";
                              }
                            }
                          }}
                        />
                        <button 
                          type="button"
                          onClick={() => setIsScanning(true)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 bg-white border border-slate-100 rounded-lg flex items-center justify-center text-slate-400 hover:text-indigo-600 transition-colors shadow-sm"
                        >
                          <Camera size={16} />
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="sm:col-span-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">Imagen URL (Opcional)</label>
                    <input 
                      type="url" 
                      className="w-full h-14 bg-slate-50 border border-slate-100 rounded-2xl px-5 text-sm font-bold focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 focus:bg-white transition-all text-slate-800"
                      value={formData.image}
                      onChange={e => setFormData({...formData, image: e.target.value})}
                      placeholder="https://ejemplo.com/imagen.jpg (En blanco si no desea imagen)"
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
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">Precio Mayorista (Default: Venta)</label>
                    <div className="relative">
                      <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                      <input 
                        required
                        type="number" step="1"
                        className="w-full h-14 bg-slate-50 border border-slate-100 rounded-2xl pl-10 pr-5 text-sm font-bold focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 focus:bg-white transition-all text-slate-800"
                        value={formData.wholesalePrice}
                        onChange={e => setFormData({...formData, wholesalePrice: Number(e.target.value)})}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">Mínimo para Mayorista (Unidades)</label>
                    <div className="relative">
                      <Package className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                      <input 
                        required
                        type="number" min="1"
                        className="w-full h-14 bg-slate-50 border border-slate-100 rounded-2xl pl-10 pr-5 text-sm font-bold focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 focus:bg-white transition-all text-slate-800"
                        value={formData.wholesaleMinQty}
                        onChange={e => setFormData({...formData, wholesaleMinQty: Number(e.target.value)})}
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

                <div className="pt-8 border-slate-50 flex flex-col sm:flex-row gap-3 w-full">
                  <button 
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="w-full sm:flex-1 py-4 bg-slate-100 text-slate-500 font-bold uppercase tracking-wider text-[13px] rounded-2xl hover:bg-slate-200 transition-all min-h-[3.25rem] md:min-h-[3.5rem] flex items-center justify-center cursor-pointer"
                  >
                    Descartar
                  </button>
                  <button 
                    type="submit"
                    className="w-full sm:flex-[2] py-4 bg-indigo-600 text-white font-bold uppercase tracking-wider text-[13px] rounded-2xl hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 flex items-center justify-center space-x-2 min-h-[3.25rem] md:min-h-[3.5rem] cursor-pointer"
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

      <AnimatePresence>
        {isScanning && (
          <BarcodeScanner 
            onScan={(code) => {
              if (code) {
                // If the modal is not open, open it
                if (!isModalOpen) {
                  openModal();
                }
                
                setFormData(prev => {
                  const newBarcodes = prev.barcodes.includes(code) ? prev.barcodes : [...prev.barcodes, code];
                  return {
                    ...prev,
                    barcodes: newBarcodes,
                    barcode: prev.barcode || code,
                    sku: prev.sku || code
                  };
                });
              }
              setIsScanning(false);
            }}
            onClose={() => setIsScanning(false)}
          />
        )}
      </AnimatePresence>

      <ModernAlert 
        isOpen={alertConfig.isOpen}
        onClose={() => setAlertConfig(prev => ({ ...prev, isOpen: false }))}
        onConfirm={alertConfig.onConfirm}
        title={alertConfig.title}
        message={alertConfig.message}
        type={alertConfig.type}
        confirmText={alertConfig.type === "delete" ? "Eliminar" : "Aceptar"}
      />
    </div>
  );
}
