import React, { useState, useEffect, useId } from "react";
import { collection, query, orderBy, limit, getDocs, where, doc, updateDoc, serverTimestamp, startAfter, endBefore, limitToLast } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { Branch } from "../../lib/branches";
import { useAuth } from "../../contexts/AuthContext";
import { RefreshCw, Search, CheckCircle2, ChevronRight, ChevronLeft, Calendar } from "lucide-react";

interface RefundsHistoryProps {
  branchesList: Branch[];
}

export function RefundsHistory({ branchesList }: RefundsHistoryProps) {
  const { profile } = useAuth();
  const fid = useId();
  const fId = (s: string) => `${fid}-${s}`;

  const [refunds, setRefunds] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  
  // Filters
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [branchFilter, setBranchFilter] = useState("");

  // Pagination
  const PAGE_SIZE = 20;
  const [page, setPage] = useState(1);
  const [lastVisibleDocs, setLastVisibleDocs] = useState<any[]>([]); // Stack to keep track of pagination
  const [firstVisibleDocs, setFirstVisibleDocs] = useState<any[]>([]); // Stack
  const [hasNextPage, setHasNextPage] = useState(false);

  // Action state
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const fetchRefunds = async (direction: "initial" | "next" | "prev" = "initial") => {
    setIsLoading(true);
    try {
      let qConstraints: any[] = [orderBy("refundedAt", "desc")];
      
      if (dateFrom) {
        const fromDate = new Date(`${dateFrom}T00:00:00`);
        qConstraints.push(where("refundedAt", ">=", fromDate));
      }
      if (dateTo) {
        const toDate = new Date(`${dateTo}T23:59:59`);
        qConstraints.push(where("refundedAt", "<=", toDate));
      }
      if (branchFilter) {
        qConstraints.push(where("branchId", "==", branchFilter));
      }

      if (direction === "next" && lastVisibleDocs.length >= page - 1) {
        qConstraints.push(startAfter(lastVisibleDocs[page - 2]));
        qConstraints.push(limit(PAGE_SIZE));
      } else if (direction === "prev" && firstVisibleDocs.length >= page) {
        qConstraints.push(endBefore(firstVisibleDocs[page - 1]));
        qConstraints.push(limitToLast(PAGE_SIZE));
      } else {
        qConstraints.push(limit(PAGE_SIZE));
      }

      const q = query(collection(db, "refunds"), ...qConstraints);
      const snap = await getDocs(q);

      if (!snap.empty) {
        setRefunds(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        
        if (direction === "initial") {
          setFirstVisibleDocs([snap.docs[0]]);
          setLastVisibleDocs([snap.docs[snap.docs.length - 1]]);
        } else if (direction === "next") {
          setFirstVisibleDocs(prev => {
            const newDocs = [...prev];
            newDocs[page - 1] = snap.docs[0];
            return newDocs;
          });
          setLastVisibleDocs(prev => {
            const newDocs = [...prev];
            newDocs[page - 1] = snap.docs[snap.docs.length - 1];
            return newDocs;
          });
        } else if (direction === "prev") {
          // Going back just re-uses the already recorded stack
        }

        // Check if there's a next page
        const nextQ = query(collection(db, "refunds"), ...qConstraints.slice(0, -1), startAfter(snap.docs[snap.docs.length - 1]), limit(1));
        const nextSnap = await getDocs(nextQ);
        setHasNextPage(!nextSnap.empty);
      } else {
        if (direction === "initial") {
          setRefunds([]);
          setHasNextPage(false);
        }
      }
    } catch (err) {
      console.error("Error fetching refunds:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Reset to page 1 on filter change
    setPage(1);
    fetchRefunds("initial");
  }, [dateFrom, dateTo, branchFilter]);

  const handleNextPage = () => {
    if (hasNextPage && !isLoading) {
      setPage(p => p + 1);
      fetchRefunds("next");
    }
  };

  const handlePrevPage = () => {
    if (page > 1 && !isLoading) {
      setPage(p => p - 1);
      fetchRefunds("prev");
    }
  };

  const handleMarkPaymentReversed = async (refundId: string) => {
    if (profile?.role !== "admin") return;
    if (!window.confirm("¿Confirmar que el dinero ha sido reversado/devuelto al cliente a través del proveedor de pagos?")) return;

    setActionLoadingId(refundId);
    try {
      const ref = doc(db, "refunds", refundId);
      await updateDoc(ref, {
        paymentReversed: true,
        paymentReversedAt: serverTimestamp()
      });
      // Update local state
      setRefunds(prev => prev.map(r => r.id === refundId ? { ...r, paymentReversed: true, paymentReversedAt: new Date() } : r));
    } catch (err) {
      console.error("Error marking payment reversed:", err);
      alert("Error al actualizar la devolución.");
    } finally {
      setActionLoadingId(null);
    }
  };

  const getBranchName = (id: string) => {
    const b = branchesList.find(br => br.id === id);
    return b ? b.name : id;
  };

  return (
    <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm p-8 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-800 tracking-tight">Historial de Devoluciones</h2>
          <p className="text-sm font-medium text-slate-500 mt-1">
            Registro de anulaciones y devoluciones de productos
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-2">
          <label htmlFor={fId("dateFrom")} className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Desde</label>
          <div className="relative">
            <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
            <input
              id={fId("dateFrom")}
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full h-12 bg-slate-50 border border-slate-100 rounded-2xl px-12 text-sm font-bold focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all text-slate-800"
            />
          </div>
        </div>
        
        <div className="space-y-2">
          <label htmlFor={fId("dateTo")} className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Hasta</label>
          <div className="relative">
            <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
            <input
              id={fId("dateTo")}
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full h-12 bg-slate-50 border border-slate-100 rounded-2xl px-12 text-sm font-bold focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all text-slate-800"
            />
          </div>
        </div>

        <div className="space-y-2">
          <label htmlFor={fId("branchFilter")} className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Sucursal</label>
          <select
            id={fId("branchFilter")}
            value={branchFilter}
            onChange={(e) => setBranchFilter(e.target.value)}
            className="w-full h-12 bg-slate-50 border border-slate-100 rounded-2xl px-4 text-sm font-bold focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all text-slate-800"
          >
            <option value="">Todas las sucursales</option>
            {branchesList.map(b => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-100">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-100 text-xs font-black text-slate-400 uppercase tracking-widest">
              <th className="p-4">Fecha</th>
              <th className="p-4">Producto</th>
              <th className="p-4 text-center">Cant.</th>
              <th className="p-4 text-right">Monto</th>
              <th className="p-4">Sucursal</th>
              <th className="p-4">Operador</th>
              <th className="p-4 text-center">Reintegro</th>
              <th className="p-4 text-right">Acción</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && refunds.length === 0 ? (
              <tr>
                <td colSpan={8} className="p-8 text-center text-slate-400 font-bold">
                  <RefreshCw className="animate-spin mx-auto mb-2" size={24} />
                  Cargando...
                </td>
              </tr>
            ) : refunds.length === 0 ? (
              <tr>
                <td colSpan={8} className="p-8 text-center text-slate-400 font-bold">
                  <Search className="mx-auto mb-2 opacity-50" size={24} />
                  Sin devoluciones registradas en el período
                </td>
              </tr>
            ) : (
              refunds.map(refund => (
                <tr key={refund.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                  <td className="p-4 text-xs font-medium text-slate-600">
                    {refund.refundedAt?.toDate ? refund.refundedAt.toDate().toLocaleString() : ""}
                  </td>
                  <td className="p-4">
                    <p className="text-sm font-bold text-slate-800">{refund.productName}</p>
                    <p className="text-[10px] font-medium text-slate-400">Razón: {refund.reason}</p>
                  </td>
                  <td className="p-4 text-center text-sm font-black text-slate-800">
                    {refund.quantity}
                  </td>
                  <td className="p-4 text-right text-sm font-black text-red-500">
                    -${refund.amount?.toLocaleString("es-CL")}
                  </td>
                  <td className="p-4 text-xs font-bold text-slate-600">
                    {getBranchName(refund.branchId)}
                  </td>
                  <td className="p-4 text-xs font-bold text-slate-600">
                    {refund.refundedByName || refund.refundedBy}
                  </td>
                  <td className="p-4 text-center">
                    {refund.paymentReversed ? (
                      <span className="inline-flex items-center gap-x-1 px-2 py-1 rounded-lg bg-emerald-50 text-emerald-600 text-[10px] font-black uppercase">
                        <CheckCircle2 size={12} />
                        Reversado
                      </span>
                    ) : (
                      <span className="inline-block px-2 py-1 rounded-lg bg-amber-50 text-amber-600 text-[10px] font-black uppercase">
                        Pendiente
                      </span>
                    )}
                  </td>
                  <td className="p-4 text-right">
                    {!refund.paymentReversed && profile?.role === "admin" && (
                      <button
                        type="button"
                        onClick={() => handleMarkPaymentReversed(refund.id)}
                        disabled={actionLoadingId === refund.id}
                        className="text-[10px] font-black uppercase tracking-widest text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-3 py-2 rounded-xl transition-all disabled:opacity-50"
                      >
                        {actionLoadingId === refund.id ? "Procesando..." : "Marcar pago reversado"}
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      <div className="flex items-center justify-between pt-2">
        <p className="text-xs font-bold text-slate-400">
          Página {page}
        </p>
        <div className="flex gap-x-2">
          <button
            type="button"
            onClick={handlePrevPage}
            disabled={page === 1 || isLoading}
            className="p-2 bg-slate-50 text-slate-600 rounded-xl hover:bg-slate-100 disabled:opacity-50 transition-colors"
            aria-label="Página anterior"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            type="button"
            onClick={handleNextPage}
            disabled={!hasNextPage || isLoading}
            className="p-2 bg-slate-50 text-slate-600 rounded-xl hover:bg-slate-100 disabled:opacity-50 transition-colors"
            aria-label="Página siguiente"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
