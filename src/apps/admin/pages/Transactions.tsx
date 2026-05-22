import React, { useState, useEffect, useMemo } from "react";
import { 
  collection, 
  query, 
  onSnapshot, 
  orderBy, 
  limit,
  where
} from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "@/src/lib/firebase";
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
  ChevronRight
} from "lucide-react";
import { cn, formatCurrency, formatDate, formatNumber } from "@/src/lib/utils";
import { motion, AnimatePresence } from "motion/react";
import { useAuth } from "@/src/contexts/AuthContext";
import { useSettings } from "@/src/contexts/SettingsContext";
import { printReceipt } from "@/src/lib/printUtils";

export function Transactions() {
  const { profile } = useAuth();
  const { settings } = useSettings();
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  const isAdmin = profile?.role === 'admin' || profile?.role === 'manager';

  useEffect(() => {
    let q = query(collection(db, "transactions"), orderBy("timestamp", "desc"), limit(100));
    
    // If user is a seller, only show their own transactions
    if (!isAdmin) {
      q = query(
        collection(db, "transactions"), 
        where("userId", "==", profile?.uid),
        orderBy("timestamp", "desc"), 
        limit(100)
      );
    }

    const unsub = onSnapshot(q, (snapshot) => {
      const txs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setTransactions(txs);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "transactions");
    });
    return unsub;
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


  const exportToCSV = () => {
    const headers = ["ID Orden", "Fecha", "Tipo", "Producto", "Monto", "Efectivo", "Tarjeta", "Digital", "Cajero", "Notas"];
    const rows = filteredTransactions.map(tx => [
      tx.orderId || tx.id,
      tx.timestamp?.toDate ? formatDate(tx.timestamp.toDate()) : "",
      tx.type === "sale" ? "Venta" : tx.type === "in" ? "Entrada" : "Salida",
      tx.productName,
      tx.amount || 0,
      tx.paymentBreakdown?.efectivo || 0,
      tx.paymentBreakdown?.tarjeta || 0,
      tx.paymentBreakdown?.digital || 0,
      tx.userName || "Sistema",
      tx.note || ""
    ]);

    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers, ...rows].map(e => e.join(",")).join("\n");
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `transacciones_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
            <button 
              onClick={exportToCSV}
              className="bg-indigo-600 text-white font-bold px-5 py-3 rounded-2xl shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all flex items-center space-x-2 text-sm"
            >
              <Download size={18} />
              <span>Exportar CSV</span>
            </button>
            <button className="bg-white text-slate-700 font-bold px-5 py-3 rounded-2xl border border-slate-200 shadow-sm hover:bg-slate-50 transition-all flex items-center space-x-2 text-sm">
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
          <div className="w-24 h-24 bg-white/10 rounded-[2.5rem] flex items-center justify-center -rotate-12 group-hover:rotate-0 transition-transform">
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
            <div className="w-24 h-24 bg-slate-50 rounded-[2.5rem] flex items-center justify-center rotate-12 group-hover:rotate-0 transition-transform">
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
            placeholder="Buscar por producto, cajero o ID de orden..."
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
                        <div className="w-8 h-8 skeleton-bg bg-slate-50 rounded-lg flex items-center justify-center text-slate-400 group-hover:text-indigo-500 transition-colors">
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
                            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shadow-sm border border-emerald-100" title="Efectivo">
                              <Banknote size={14} />
                            </div>
                          )}
                          {tx.paymentBreakdown?.tarjeta > 0 && (
                            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shadow-sm border border-blue-100" title="Tarjeta">
                              <CreditCard size={14} />
                            </div>
                          )}
                          {(tx.paymentBreakdown?.transferencia > 0 || tx.paymentMethod === 'transferencia') && (
                            <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shadow-sm border border-purple-100" title="Transferencia">
                              <ArrowRightLeft size={14} />
                            </div>
                          )}
                          {tx.paymentBreakdown?.digital > 0 && (
                            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shadow-sm border border-amber-100" title="Pago Digital">
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
                          <div className="w-6 h-6 bg-slate-100 rounded-full flex items-center justify-center text-slate-500">
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
                          <button 
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
              <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4" />
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] animate-pulse">Sincronizando Historial...</p>
            </div>
          )}

          {!loading && filteredTransactions.length === 0 && (
            <div className="py-24 text-center">
              <div className="w-20 h-20 bg-slate-50 rounded-[2rem] flex items-center justify-center text-slate-200 mx-auto mb-6">
                <History size={40} />
              </div>
              <p className="text-slate-400 text-xs font-black uppercase tracking-widest">Sin registros que mostrar</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
