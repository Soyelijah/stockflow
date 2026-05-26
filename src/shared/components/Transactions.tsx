import React, { useState, useEffect, useMemo } from "react";
import { 
  collection, 
  query, 
  orderBy, 
  limit,
  where,
  getDocs,
  startAfter
} from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../../lib/firebase";
import { 
  History, 
  TrendingUp, 
  TrendingDown, 
  Filter, 
  Download,
  Calendar,
  User as UserIcon,
  Tag,
  CreditCard,
  Banknote,
  Smartphone,
  Search,
  ShoppingCart,
  ArrowUpRight,
  ArrowDownRight,
  Printer,
  ArrowRightLeft,
  ChevronRight,
  ChevronLeft
} from "lucide-react";
import { cn, formatCurrency, formatDate, formatNumber } from "../../lib/utils";
import { motion, AnimatePresence } from "motion/react";
import { useAuth } from "../../contexts/AuthContext";
import { useSettings } from "../../contexts/SettingsContext";
import { printReceipt } from "../../lib/printUtils";

export function Transactions() {
  const { profile } = useAuth();
  const { settings } = useSettings();
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  const isAdmin = profile?.role === 'admin' || profile?.role === 'manager';

  const PAGE_SIZE = 25;
  const [currentPage, setCurrentPage] = useState(1);
  const [cursors, setCursors] = useState<any[]>([]); // Historial de los últimos documentos de cada página visible
  const [hasMore, setHasMore] = useState(true);

  const fetchTransactions = async (direction: "init" | "next" | "prev" = "init") => {
    setLoading(true);
    try {
      let q = query(
        collection(db, "transactions"),
        orderBy("timestamp", "desc")
      );

      if (!isAdmin) {
        q = query(
          collection(db, "transactions"),
          where("userId", "==", profile?.uid),
          orderBy("timestamp", "desc")
        );
      }

      // Aplicar cursor según la dirección
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
        // Inicial / Reset
        targetPage = 1;
        q = query(q, limit(PAGE_SIZE));
      }

      const snap = await getDocs(q);
      const txs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setTransactions(txs);

      // Guardar el último documento para el siguiente cursor
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

      // Para saber si hay más, consultamos si el lote de resultados es de tamaño completo
      setHasMore(snap.docs.length === PAGE_SIZE);
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, "transactions");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions("init");
  }, []);

  const stats = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return transactions.reduce((acc, tx) => {
      const txDate = tx.timestamp?.toDate ? tx.timestamp.toDate() : new Date(tx.timestamp);
      const isToday = txDate >= today;

      if (tx.type === "sale") {
        acc.totalSales += Number(tx.amount) || 0;
        if (isToday) acc.todaySales += Number(tx.amount) || 0;
      }
      return acc;
    }, { totalSales: 0, todaySales: 0 });
  }, [transactions]);

  const filteredTransactions = transactions.filter(tx => 
    tx.productName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    tx.userName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    tx.orderId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    tx.customerName?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handlePrint = (tx: any) => {
    // Find all items in this order
    const orderItems = transactions.filter(t => t.orderId === tx.orderId);
    
    printReceipt({
      orderId: tx.orderId || tx.id,
      timestamp: tx.timestamp,
      items: orderItems.map(item => ({
        name: item.productName || "Producto",
        quantity: item.quantity || 1,
        price: (item.amount || 0) / (item.quantity || 1)
      })),
      total: orderItems.reduce((acc, i) => acc + (i.amount || 0), 0),
      paymentMethod: tx.paymentBreakdown ? Object.entries(tx.paymentBreakdown)
        .filter(([_, val]) => (val as number) > 0)
        .map(([key, _]) => key)
        .join(", ") : "Manual",
      customerName: tx.customerName,
      businessName: settings.businessName,
      address: settings.address,
      phone: settings.phone
    });
  };


  const isOnlyAdmin = profile?.role === 'admin';

  const exportToCSV = async () => {
    try {
      const snap = await getDocs(query(collection(db, "transactions"), orderBy("timestamp", "desc")));
      const allTx = snap.docs.map(doc => ({ id: doc.id, ...doc.data() as any }));

      const headers = ["Fecha", "Producto", "Tipo", "Cantidad", "Monto", "Usuario"];
      
      const rows = allTx.map(tx => {
        const dateStr = tx.timestamp?.toDate 
          ? formatDate(tx.timestamp.toDate()) 
          : (tx.timestamp ? formatDate(new Date(tx.timestamp)) : "S/F");
        
        let productsDesc = "";
        let quantity = 0;
        
        if (Array.isArray(tx.items)) {
          productsDesc = tx.items.map((i: any) => `${i.productName || i.name || "Producto"}`).join(" | ");
          quantity = tx.items.reduce((sum: number, i: any) => sum + (Number(i.quantity) || 0), 0);
        } else {
          productsDesc = tx.productName || "Gastos / Ajuste";
          quantity = Number(tx.quantity) || 0;
        }

        const escapedProducts = `"${productsDesc.replace(/"/g, '""')}"`;
        const type = tx.type === "sale" ? "Venta" : (tx.type === "reception" ? "Recepción" : tx.type || "Ajuste");
        const amount = Number(tx.totalAmount) || Number(tx.amount) || 0;
        const userStr = `"${(tx.userName || tx.userEmail || "Sistema").replace(/"/g, '""')}"`;

        return [dateStr, escapedProducts, type, quantity, amount, userStr].join(",");
      });

      const csvContent = "\uFEFF" + [headers.join(","), ...rows].join("\n");
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `transacciones_completas_${new Date().toISOString().split("T")[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error("Error al exportar transacciones a CSV:", err);
      alert("Error al exportar transacciones.");
    }
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black text-slate-800 tracking-tight">
            {isAdmin ? "Historial de Caja" : "Mi Registro de Ventas"}
          </h1>
          <p className="text-slate-500 font-medium text-sm">
            {isAdmin 
              ? "Registro detallado de todas las ventas y movimientos de la tienda." 
              : "Listado de tus ventas procesadas y tickets emitidos."}
          </p>
        </div>
        {isAdmin && (
          <div className="flex items-center space-x-2">
            {isOnlyAdmin && (
              <button type="button" 
                onClick={exportToCSV}
                className="bg-indigo-600 text-white font-bold px-5 py-3 rounded-2xl shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all flex items-center space-x-2 text-sm"
              >
                <Download size={18} />
                <span>Exportar CSV</span>
              </button>
            )}
            <button className="bg-white text-slate-700 font-bold px-5 py-3 rounded-2xl border border-slate-200 shadow-sm hover:bg-slate-50 transition-all flex items-center space-x-2 text-sm" type="button">
              <Filter size={18} />
              <span>Filtros Avanzados</span>
            </button>
          </div>
        )}
      </header>

      {/* Sales Summaries */}
      <div className={cn("grid gap-6", isAdmin ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1")}>
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className={cn(
            "rounded-[2.5rem] p-8 text-white flex items-center justify-between relative overflow-hidden group shadow-xl",
            isAdmin ? "bg-indigo-600 shadow-indigo-100" : "bg-slate-900 shadow-slate-100"
          )}
        >
          <div className="relative z-10">
            <p className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em] mb-1">
              {isAdmin ? "Ventas de Hoy" : "Mi Venta del Día"}
            </p>
            <h3 className="text-4xl font-black">{formatCurrency(stats.todaySales)}</h3>
            <div className="flex items-center mt-2 text-white/40 text-xs font-bold">
              <ArrowUpRight size={14} className="mr-1" />
              <span>Sincronizado</span>
            </div>
          </div>
          <div className="size-24 bg-white/10 rounded-[2.5rem] flex items-center justify-center -rotate-12 group-hover:rotate-0 transition-transform">
            <TrendingUp size={48} className="text-white/20" />
          </div>
        </motion.div>

        {isAdmin && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white rounded-[2.5rem] p-8 border border-slate-200 flex items-center justify-between relative overflow-hidden group shadow-sm"
          >
            <div className="relative z-10">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Historial Acumulado (Muestra)</p>
              <h3 className="text-4xl font-black text-slate-800">{formatCurrency(stats.totalSales)}</h3>
              <p className="text-slate-400 text-xs font-medium mt-2">Últimos 100 movimientos</p>
            </div>
            <div className="size-24 bg-slate-50 rounded-[2.5rem] flex items-center justify-center rotate-12 group-hover:rotate-0 transition-transform">
              <ShoppingCart size={48} className="text-slate-200" />
            </div>
          </motion.div>
        )}
      </div>

      {/* Search and Filters */}
      <div className="bg-white p-4 rounded-3xl border border-slate-200 flex items-center shadow-sm">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
          <input 
            type="text" 
            placeholder="Buscar por producto, cajero o ID de orden…"
            className="w-full bg-slate-50 border-none rounded-2xl py-4 pl-12 pr-4 text-sm font-bold focus:ring-4 focus:ring-indigo-500/10 focus:bg-white transition-all text-slate-700"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden min-h-[400px]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[850px] text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50">
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.15em]">Fecha / Orden</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.15em]">Tipo</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.15em]">Referencia</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.15em]">Método</th>
                {isAdmin && <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.15em]">Cajero</th>}
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              <AnimatePresence mode="popLayout">
                {filteredTransactions.map((tx, idx) => (
                  <motion.tr 
                    layout
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    key={tx.id} 
                    className="group hover:bg-indigo-50/20 transition-colors"
                  >
                    <td className="px-8 py-5">
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-slate-800">
                          {tx.timestamp?.toDate ? formatDate(tx.timestamp.toDate()) : "Pendiente"}
                        </span>
                        <span className="text-[9px] text-slate-400 font-black tracking-widest mt-1">
                          #{tx.orderId?.slice(-6).toUpperCase() || tx.id.slice(-6).toUpperCase()}
                        </span>
                      </div>
                    </td>
                    <td className="px-8 py-5">
                      <div className={cn(
                        "inline-flex items-center space-x-2 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border transition-all",
                        tx.type === 'in' 
                          ? "bg-emerald-50 text-emerald-600 border-emerald-100" 
                          : tx.type === 'sale'
                          ? "bg-indigo-50 text-indigo-600 border-indigo-100"
                          : "bg-rose-50 text-rose-600 border-rose-100"
                      )}>
                        {tx.type === 'in' ? <TrendingUp size={12} /> : tx.type === 'sale' ? <ShoppingCart size={12} /> : <TrendingDown size={12} />}
                        <span>{tx.type === 'in' ? 'Entrada' : tx.type === 'sale' ? 'Venta' : 'Salida'}</span>
                      </div>
                    </td>
                    <td className="px-8 py-5">
                      <div className="flex items-center space-x-3">
                        <div className="size-8 skeleton-bg bg-slate-50 rounded-lg flex items-center justify-center text-slate-400 group-hover:text-indigo-500 transition-colors">
                          <Tag size={16} />
                        </div>
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-800 text-xs truncate max-w-[150px]">
                            {tx.productName || tx.customerName || "Venta General"}
                          </span>
                          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">
                            {tx.quantity ? `${tx.quantity} Unidades` : 'Movimiento Caja'}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-5">
                      {tx.type === 'sale' ? (
                        <div className="flex items-center space-x-2">
                          {tx.paymentBreakdown?.efectivo > 0 && (
                            <div className="size-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shadow-sm border border-emerald-100" title="Efectivo">
                              <Banknote size={14} />
                            </div>
                          )}
                          {tx.paymentBreakdown?.tarjeta > 0 && (
                            <div className="size-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shadow-sm border border-blue-100" title="Tarjeta">
                              <CreditCard size={14} />
                            </div>
                          )}
                          {(tx.paymentBreakdown?.transferencia > 0 || tx.paymentMethod === 'transferencia') && (
                            <div className="size-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shadow-sm border border-purple-100" title="Transferencia">
                              <ArrowRightLeft size={14} />
                            </div>
                          )}
                          {tx.paymentBreakdown?.digital > 0 && (
                            <div className="size-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shadow-sm border border-amber-100" title="Pago Digital">
                              <Smartphone size={14} />
                            </div>
                          )}
                          {!tx.paymentBreakdown && !tx.paymentMethod && (
                            <div className="text-[10px] font-black text-slate-300 bg-slate-50 px-2 py-1 rounded-lg">N/D</div>
                          )}
                        </div>
                      ) : (
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter opacity-50 px-2 py-1 bg-slate-50 rounded-lg">Mov. Stock</span>
                      )}
                    </td>
                    {isAdmin && (
                      <td className="px-8 py-5">
                        <div className="flex items-center space-x-2">
                          <div className="size-6 bg-slate-100 rounded-full flex items-center justify-center text-slate-500">
                            <UserIcon size={12} />
                          </div>
                          <span className="text-xs font-bold text-slate-600">{tx.userName || "Sistema"}</span>
                        </div>
                      </td>
                    )}
                    <td className="px-8 py-5 text-right">
                      <div className="flex items-center justify-end space-x-3">
                        <div className="flex flex-col items-end">
                          <span className={cn(
                            "font-black text-sm",
                            tx.type === 'in' ? "text-slate-300" : "text-slate-800"
                          )}>
                            {tx.amount ? formatCurrency(tx.amount) : '-'}
                          </span>
                          {tx.note && <span className="text-[9px] text-slate-400 font-medium italic mt-0.5 truncate max-w-[120px]">{tx.note}</span>}
                        </div>
                        {tx.type === 'sale' && (
                          <button type="button" 
                            onClick={() => handlePrint(tx)}
                            className="p-2 hover:bg-indigo-50 rounded-xl text-slate-300 hover:text-indigo-600 transition-all shadow-sm border border-slate-50 flex items-center justify-center"
                            title="Reimprimir Ticket"
                          >
                            <Printer size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </AnimatePresence>
            </tbody>
          </table>

          {loading && (
            <div className="py-20 flex flex-col items-center justify-center">
              <div className="size-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4" />
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] animate-pulse">Sincronizando Historial...</p>
            </div>
          )}

          {!loading && filteredTransactions.length === 0 && (
            <div className="py-24 text-center">
              <div className="size-20 bg-slate-50 rounded-[2rem] flex items-center justify-center text-slate-200 mx-auto mb-6">
                <History size={40} />
              </div>
              <p className="text-slate-400 text-xs font-black uppercase tracking-widest">Sin registros que mostrar</p>
            </div>
          )}

          {/* Controles de Paginación */}
          {!loading && (
            <div className="flex items-center justify-between px-8 py-5 border-t border-slate-100 bg-slate-50/30">
              <span className="text-xs font-semibold text-slate-500">
                Página <span className="font-bold text-slate-700">{currentPage}</span>
              </span>
              <div className="flex items-center space-x-2">
                <button type="button"
                  onClick={() => fetchTransactions("prev")}
                  disabled={currentPage === 1 || loading}
                  className={cn(
                    "p-2 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition-all flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed shadow-xs"
                  )}
                  title="Página Anterior"
                >
                  <ChevronLeft size={16} />
                </button>
                <button type="button"
                  onClick={() => fetchTransactions("next")}
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
      </div>
    </div>
  );
}
