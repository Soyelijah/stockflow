import React, { useState, useEffect, useRef } from "react";
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
  ArrowUpRight, 
  ArrowDownLeft, 
  RefreshCcw, 
  AlertOctagon, 
  ShoppingCart, 
  Smartphone, 
  Monitor,
  Search,
  Filter,
  History,
  ChevronLeft,
  ChevronRight,
  Calendar
} from "lucide-react";
import { formatCurrency, cn } from "../../lib/utils";
import { motion, AnimatePresence } from "motion/react";

export function StockLedger() {
  const [movements, setMovements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<string>("all");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  const PAGE_SIZE = 25;
  const [currentPage, setCurrentPage] = useState(1);
  const cursorsRef = useRef<any[]>([]);
  const [hasMore, setHasMore] = useState(true);

  const fetchMovements = async (direction: "init" | "next" | "prev" = "init") => {
    setLoading(true);
    try {
      let q = query(collection(db, "stockMovements"), orderBy("timestamp", "desc"));

      if (filterType !== "all") {
        q = query(q, where("type", "==", filterType));
      }

      if (startDate) {
        const start = new Date(startDate + "T00:00:00");
        q = query(q, where("timestamp", ">=", start));
      }

      if (endDate) {
        const end = new Date(endDate + "T23:59:59.999");
        q = query(q, where("timestamp", "<=", end));
      }

      let targetPage = currentPage;
      if (direction === "next") {
        targetPage = currentPage + 1;
        const lastVisible = cursorsRef.current[currentPage - 1];
        if (lastVisible) {
          q = query(q, startAfter(lastVisible), limit(PAGE_SIZE));
        } else {
          q = query(q, limit(PAGE_SIZE));
        }
      } else if (direction === "prev") {
        targetPage = Math.max(1, currentPage - 1);
        const prevIndex = targetPage - 1;
        const prevVisible = prevIndex > 0 ? cursorsRef.current[prevIndex - 1] : null;
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
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setMovements(data);

      const lastVisibleDoc = snap.docs[snap.docs.length - 1];
      if (direction === "init") {
        cursorsRef.current = [lastVisibleDoc];
        setCurrentPage(1);
      } else if (direction === "next") {
        {
        
          const nextCursors = [...cursorsRef.current];
          nextCursors[targetPage - 1] = lastVisibleDoc;
        cursorsRef.current = nextCursors;
      }
        setCurrentPage(targetPage);
      } else if (direction === "prev") {
        setCurrentPage(targetPage);
      }

      setHasMore(snap.docs.length === PAGE_SIZE);
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, "stockMovements");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMovements("init");
    // Filter-driven refetch; fetchMovements closes over pagination state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterType, startDate, endDate]);

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
        <p className="text-slate-500 font-medium">Historial sincronizado de movimientos de inventario con paginación.</p>
      </header>

      {/* Filtros de Tipo y Fecha */}
      <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex flex-wrap gap-2 items-center">
            <button type="button" 
              onClick={() => setFilterType("all")}
              className={cn(
                "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                filterType === "all" ? "bg-indigo-600 text-white shadow-md shadow-indigo-100" : "bg-slate-50 text-slate-400 hover:bg-slate-100"
              )}
            >
              Todos
            </button>
            {["purchase", "sale", "adjustment", "loss", "return"].map(type => (
              <button type="button" 
                key={type}
                onClick={() => setFilterType(type)}
                className={cn(
                  "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                  filterType === type ? "bg-indigo-600 text-white shadow-md shadow-indigo-100" : "bg-slate-50 text-slate-400 hover:bg-slate-100"
                )}
              >
                {getMovementConfig(type).label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-x-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-150">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Desde:</span>
              <input 
                type="date" 
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-transparent border-none text-xs font-bold text-slate-700 focus:outline-none focus:ring-0 p-0"
              />
            </div>
            
            <div className="flex items-center gap-x-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-150">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Hasta:</span>
              <input 
                type="date" 
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-transparent border-none text-xs font-bold text-slate-700 focus:outline-none focus:ring-0 p-0"
              />
            </div>

            {(startDate || endDate) && (
              <button type="button" 
                onClick={() => { setStartDate(""); setEndDate(""); }}
                className="text-[10px] font-black uppercase tracking-widest text-indigo-600 hover:text-indigo-800 bg-indigo-50 px-3 py-2 rounded-xl transition-colors"
              >
                Limpiar fechas
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-20 text-center flex flex-col items-center justify-center space-y-4">
              <div className="size-8 animate-spin rounded-full border-4 border-indigo-100 border-t-indigo-600" />
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Cargando movimientos…</p>
            </div>
          ) : (
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
                          {move.timestamp?.toDate ? move.timestamp.toDate().toLocaleDateString() : new Date(move.timestamp).toLocaleDateString()}
                        </p>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                          {move.timestamp?.toDate ? move.timestamp.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : new Date(move.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </td>
                      <td className="px-8 py-5">
                        <p className="font-bold text-slate-800 text-sm truncate max-w-[200px]">{move.productName || "Producto Desconocido"}</p>
                        <p className="text-[10px] text-slate-400 font-bold uppercase truncate">{move.reason || "Sin observación"}</p>
                      </td>
                      <td className="px-8 py-5">
                        <div className={cn("inline-flex items-center gap-x-2 px-3 py-1.5 rounded-xl font-black uppercase text-[10px] tracking-widest", config.bg, config.color)}>
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
                         <div className="flex items-center gap-x-2">
                           <span className="text-xs text-slate-400 font-bold">{move.previousStock}</span>
                           <ArrowUpRight size={12} className="text-slate-300" />
                           <span className="text-sm font-black text-slate-800">{move.newStock}</span>
                         </div>
                      </td>
                      <td className="px-8 py-5">
                        <div className="flex items-center gap-x-2 text-slate-400">
                          {move.source === 'mobile' ? <Smartphone size={16} /> : <Monitor size={16} />}
                          <span className="text-[10px] font-black uppercase tracking-widest">{move.userName?.split(' ')[0]}</span>
                        </div>
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          )}
          {!loading && movements.length === 0 && (
            <div className="p-20 text-center">
              <div className="size-16 bg-slate-50 rounded-full flex items-center justify-center text-slate-200 mx-auto mb-4">
                <History size={32} />
              </div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">No hay movimientos registrados</p>
            </div>
          )}
        </div>
      </div>

      {/* Controles de Paginación */}
      {!loading && movements.length > 0 && (
        <div className="flex items-center justify-between px-8 py-5 border-t border-slate-100 bg-white rounded-[2rem] shadow-sm">
          <span className="text-xs font-semibold text-slate-500">
            Página <span className="font-bold text-slate-700">{currentPage}</span>
          </span>
          <div className="flex items-center gap-x-2">
            <button
              type="button"
              onClick={() => fetchMovements("prev")}
              disabled={currentPage === 1 || loading}
              className={cn(
                "p-2 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition-all flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed shadow-xs"
              )}
              title="Página Anterior"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              type="button"
              onClick={() => fetchMovements("next")}
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
  );
}
