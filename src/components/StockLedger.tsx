import React, { useState, useEffect } from "react";
import { 
  collection, 
  query, 
  orderBy, 
  onSnapshot, 
  limit,
  where
} from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../lib/firebase";
import { 
  ArrowUpRight, 
  ArrowDownLeft, 
  RefreshCcw, 
  AlertOctagon, 
  ShoppingCart, 
  Smartphone, 
  Monitor,
  Search,
  Filter,
  History
} from "lucide-react";
import { formatCurrency, cn } from "../lib/utils";
import { motion, AnimatePresence } from "motion/react";

export function StockLedger() {
  const [movements, setMovements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<string>("all");

  useEffect(() => {
    let q = query(
      collection(db, "stockMovements"),
      orderBy("timestamp", "desc"),
      limit(50)
    );

    if (filterType !== "all") {
      q = query(q, where("type", "==", filterType));
    }

    const unsub = onSnapshot(q, (snapshot) => {
      setMovements(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "stockMovements");
    });
    return unsub;
  }, [filterType]);

  const getMovementConfig = (type: string) => {
    switch(type) {
      case 'purchase': return { icon: ArrowUpRight, color: "text-emerald-600", bg: "bg-emerald-50", label: "Compra / Ingreso" };
      case 'sale': return { icon: ShoppingCart, color: "text-indigo-600", bg: "bg-indigo-50", label: "Venta" };
      case 'adjustment': return { icon: RefreshCcw, color: "text-amber-600", bg: "bg-amber-50", label: "Ajuste" };
      case 'loss': return { icon: AlertOctagon, color: "text-rose-600", bg: "bg-rose-50", label: "Pérdida / Merma" };
      case 'return': return { icon: ArrowDownLeft, color: "text-sky-600", bg: "bg-sky-50", label: "Devolución" };
      default: return { icon: History, color: "text-slate-600", bg: "bg-slate-50", label: "Movimiento" };
    }
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      <header>
        <h1 className="text-3xl font-black text-slate-800 tracking-tight">Kardex Logístico</h1>
        <p className="text-slate-500 font-medium">Historial sincronizado de movimientos de inventario.</p>
      </header>

      <div className="bg-white p-4 rounded-3xl border border-slate-200 flex flex-wrap gap-4 items-center shadow-sm">
        <button 
          onClick={() => setFilterType("all")}
          className={cn(
            "px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all",
            filterType === "all" ? "bg-slate-900 text-white shadow-lg" : "bg-slate-50 text-slate-400 hover:bg-slate-100"
          )}
        >
          Todos
        </button>
        {["purchase", "sale", "adjustment", "loss"].map(type => (
          <button 
            key={type}
            onClick={() => setFilterType(type)}
            className={cn(
              "px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all",
              filterType === type ? "bg-slate-900 text-white shadow-lg" : "bg-slate-50 text-slate-400 hover:bg-slate-100"
            )}
          >
            {getMovementConfig(type).label}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[850px] text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50">
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.15em]">Fecha y Hora</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.15em]">Producto</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.15em]">Tipo</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.15em]">Cantidad</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.15em]">Stock Final</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.15em]">Origen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {movements.map(move => {
                const config = getMovementConfig(move.type);
                return (
                  <motion.tr 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    key={move.id} 
                    className="hover:bg-slate-50/50 transition-colors"
                  >
                    <td className="px-8 py-5 whitespace-nowrap">
                      <p className="text-sm font-bold text-slate-700">
                        {move.timestamp?.toDate().toLocaleDateString()}
                      </p>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                        {move.timestamp?.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </td>
                    <td className="px-8 py-5">
                      <p className="font-bold text-slate-800 text-sm truncate max-w-[200px]">{move.productName || "Producto Desconocido"}</p>
                      <p className="text-[10px] text-slate-400 font-bold uppercase truncate">{move.reason || "Sin observación"}</p>
                    </td>
                    <td className="px-8 py-5">
                      <div className={cn("inline-flex items-center space-x-2 px-3 py-1.5 rounded-xl font-black uppercase text-[10px] tracking-widest", config.bg, config.color)}>
                        <config.icon size={14} />
                        <span>{config.label}</span>
                      </div>
                    </td>
                    <td className="px-8 py-5">
                      <span className={cn(
                        "font-black text-sm",
                        ["purchase", "return", "adjustment"].includes(move.type) && move.quantity > 0 ? "text-emerald-600" : "text-rose-600"
                      )}>
                        {["purchase", "return", "adjustment"].includes(move.type) && move.quantity > 0 ? "+" : "-"}{move.quantity}
                      </span>
                    </td>
                    <td className="px-8 py-5 whitespace-nowrap">
                       <div className="flex items-center space-x-2">
                         <span className="text-xs text-slate-400 font-bold">{move.previousStock}</span>
                         <ArrowUpRight size={12} className="text-slate-300" />
                         <span className="text-sm font-black text-slate-800">{move.newStock}</span>
                       </div>
                    </td>
                    <td className="px-8 py-5">
                      <div className="flex items-center space-x-2 text-slate-400">
                        {move.source === 'mobile' ? <Smartphone size={16} /> : <Monitor size={16} />}
                        <span className="text-[10px] font-black uppercase tracking-widest">{move.userName?.split(' ')[0]}</span>
                      </div>
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
          {!loading && movements.length === 0 && (
            <div className="p-20 text-center">
              <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center text-slate-200 mx-auto mb-4">
                <History size={32} />
              </div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">No hay movimientos registrados</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
