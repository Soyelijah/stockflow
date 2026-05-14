import React, { useState, useEffect } from "react";
import { 
  collection, 
  query, 
  onSnapshot, 
  orderBy, 
  limit 
} from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../lib/firebase";
import { 
  History, 
  TrendingUp, 
  TrendingDown, 
  Filter, 
  Download,
  Calendar,
  User as UserIcon,
  Tag
} from "lucide-react";
import { cn, formatCurrency, formatDate } from "../lib/utils";

export function Transactions() {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, "transactions"), orderBy("timestamp", "desc"), limit(50));
    const unsub = onSnapshot(q, (snapshot) => {
      const txs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setTransactions(txs);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "transactions");
    });
    return unsub;
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Historial de Movimientos</h2>
          <p className="text-gray-500 text-sm">Registro inmutable de todas las entradas y salidas.</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b">
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Fecha y Hora</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Tipo</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Producto</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Cantidad</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Usuario</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Monto</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {transactions.map(tx => (
                <tr key={tx.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center space-x-2 text-sm text-gray-600">
                      <Calendar size={14} className="text-gray-400" />
                      <span>{formatDate(tx.timestamp?.toDate ? tx.timestamp.toDate() : tx.timestamp)}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className={cn(
                      "inline-flex items-center space-x-1 px-2 py-1 rounded-lg text-[10px] font-bold uppercase border",
                      tx.type === 'in' 
                        ? "bg-green-50 text-green-700 border-green-100" 
                        : "bg-blue-50 text-blue-700 border-blue-100"
                    )}>
                      {tx.type === 'in' ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                      <span>{tx.type === 'in' ? 'Entrada' : 'Salida'}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center space-x-2">
                      <Tag size={14} className="text-gray-400" />
                      <span className="font-semibold text-gray-900 text-sm">{tx.productName}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="font-bold text-gray-900 text-sm">
                      {tx.quantity}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center space-x-2 text-sm text-gray-600">
                      <UserIcon size={14} className="text-gray-400" />
                      <span>{tx.userName}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right whitespace-nowrap">
                    <span className={cn(
                      "font-bold text-sm",
                      tx.type === 'in' ? "text-gray-400" : "text-blue-600"
                    )}>
                      {tx.totalAmount ? formatCurrency(tx.totalAmount) : '-'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {loading ? (
             <div className="p-12 text-center">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent mb-4"></div>
              <p className="text-gray-500 animate-pulse">Cargando historial...</p>
            </div>
          ) : transactions.length === 0 && (
            <div className="p-12 text-center">
              <History className="mx-auto text-gray-300 mb-4 opacity-50" size={48} />
              <p className="text-gray-500 italic">No hay movimientos registrados.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
