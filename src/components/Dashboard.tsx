import React, { useEffect, useState } from "react";
import { collection, query, onSnapshot, limit, orderBy } from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../lib/firebase";
import { 
  Package, 
  TrendingUp, 
  AlertTriangle, 
  ShoppingCart,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  Activity,
  Box,
  DollarSign
} from "lucide-react";
import { formatCurrency, cn } from "../lib/utils";
import { motion } from "motion/react";
import { useAuth } from "../contexts/AuthContext";

export function Dashboard() {
  const { profile } = useAuth();
  const [stats, setStats] = useState({
    totalProducts: 0,
    totalStockValue: 0,
    recentSales: 0,
    lowStockCount: 0
  });
  const [recentTransactions, setRecentTransactions] = useState<any[]>([]);
  const [lowStockProducts, setLowStockProducts] = useState<any[]>([]);

  useEffect(() => {
    // Listen to products for stats
    const qProducts = query(collection(db, "products"));
    const unsubProducts = onSnapshot(qProducts, (snapshot) => {
      let totalValue = 0;
      let lowStock = 0;
      let lowStockList: any[] = [];
      
      snapshot.forEach((doc) => {
        const data = doc.data();
        const price = Number(data.price) || 0;
        const stock = Number(data.stock) || 0;
        const minThreshold = Number(data.minThreshold) || 0;
        
        totalValue += price * stock;
        if (stock <= minThreshold && data.name) {
          lowStock++;
          lowStockList.push({ id: doc.id, ...data, price, stock, minThreshold });
        }
      });

      setStats(prev => ({
        ...prev,
        totalProducts: snapshot.size,
        totalStockValue: totalValue,
        lowStockCount: lowStock
      }));
      setLowStockProducts(lowStockList.slice(0, 5));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "products (Dashboard)");
    });

    // Listen to recent transactions
    const qTransactions = query(
      collection(db, "transactions"), 
      orderBy("timestamp", "desc"), 
      limit(10)
    );
    const unsubTransactions = onSnapshot(qTransactions, (snapshot) => {
      let salesCount = 0;
      const txs = snapshot.docs.map(doc => {
        const data = doc.data();
        if (data.type === "sale" || data.type === "out") {
           if(data.type === "sale") salesCount++;
        }
        return { id: doc.id, ...data };
      });
      setRecentTransactions(txs);
      setStats(prev => ({ ...prev, recentSales: salesCount }));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "transactions (Dashboard)");
    });

    return () => {
      unsubProducts();
      unsubTransactions();
    };
  }, []);

  const topStats = [
    { label: "Valor Inventario", value: formatCurrency(stats.totalStockValue), icon: DollarSign, color: "bg-indigo-600", trend: "+2.4%", up: true },
    { label: "Ventas Recientes", value: stats.recentSales, icon: ShoppingCart, color: "bg-emerald-500", trend: "+12.1%", up: true },
    { label: "Alertas Críticas", value: stats.lowStockCount, icon: AlertTriangle, color: "bg-rose-500", trend: "-5%", up: false },
    { label: "Items Totales", value: stats.totalProducts, icon: Box, color: "bg-blue-500", trend: "+0.8%", up: true },
  ];

  return (
    <div className="space-y-10 max-w-7xl mx-auto">
      {/* Welcome Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black text-slate-800 tracking-tight">Centro de Mando</h1>
          <p className="text-slate-500 font-medium mt-1">Sincronizado y listo para operar, {profile?.name}.</p>
        </div>
        <div className="flex items-center space-x-2 bg-indigo-50 border border-indigo-100 px-4 py-2 rounded-2xl">
          <div className="w-2 h-2 bg-indigo-600 rounded-full animate-pulse" />
          <span className="text-xs font-black text-indigo-700 uppercase tracking-widest">Estado: Activo</span>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {topStats.map((stat, i) => (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            key={stat.label}
            className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-xl hover:shadow-indigo-500/5 transition-all group"
          >
            <div className="flex items-start justify-between mb-4">
              <div className={cn("p-4 rounded-3xl text-white shadow-lg", stat.color)}>
                <stat.icon size={24} />
              </div>
              <div className={cn(
                "flex items-center space-x-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest",
                stat.up ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
              )}>
                {stat.up ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                <span>{stat.trend}</span>
              </div>
            </div>
            <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px] mb-1">{stat.label}</p>
            <h3 className="text-2xl font-black text-slate-800 tracking-tight">{stat.value}</h3>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Main Activity Feed */}
        <div className="lg:col-span-8 space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-3 bg-slate-900 rounded-2xl text-white">
                <Activity size={20} />
              </div>
              <h2 className="text-xl font-black text-slate-800 tracking-tight">Actividad del Sistema</h2>
            </div>
            <button className="text-xs font-black text-indigo-600 uppercase tracking-widest hover:text-indigo-400 transition-colors">Ver Registro Completo</button>
          </div>

          <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden p-2">
            <div className="divide-y divide-slate-50">
              {recentTransactions.map((tx, i) => (
                <motion.div 
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  key={tx.id} 
                  className="flex items-center justify-between p-5 hover:bg-slate-50/80 transition-all rounded-3xl group"
                >
                  <div className="flex items-center space-x-4">
                    <div className={cn(
                      "w-12 h-12 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110",
                      tx.type === "sale" || tx.type === "out" ? "bg-rose-50 text-rose-600" : "bg-emerald-50 text-emerald-600"
                    )}>
                      {tx.type === "sale" ? <ShoppingCart size={22} /> : 
                       tx.type === "in" ? <ArrowDownRight size={22} /> : <ArrowUpRight size={22} />}
                    </div>
                    <div>
                      <p className="font-bold text-slate-800 text-sm">{tx.productName}</p>
                      <div className="flex items-center space-x-2 mt-1">
                        <Clock size={12} className="text-slate-400" />
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                          {tx.timestamp?.toDate ? tx.timestamp.toDate().toLocaleTimeString() : "Reciente"}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={cn(
                      "font-black text-sm",
                      tx.type === "sale" || tx.type === "out" ? "text-rose-600" : "text-emerald-600"
                    )}>
                      {tx.type === "sale" || tx.type === "out" ? "-" : "+"}{tx.quantity}
                    </p>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">{tx.userName || "Sistema"}</p>
                  </div>
                </motion.div>
              ))}
              {recentTransactions.length === 0 && (
                <div className="p-20 text-center text-slate-400 font-bold uppercase tracking-widest text-xs">
                  Sin actividad registrada
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Status Side Panel */}
        <div className="lg:col-span-4 space-y-6">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-amber-500 rounded-2xl text-white shadow-lg shadow-amber-100">
              <AlertTriangle size={20} />
            </div>
            <h2 className="text-xl font-black text-slate-800 tracking-tight">Alertas Rápidas</h2>
          </div>

          <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm p-6 space-y-4">
            {lowStockProducts.map((product) => (
              <div key={product.id} className="p-4 bg-slate-50 rounded-2xl flex items-center justify-between border border-transparent hover:border-amber-200 transition-all group">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-slate-400 border border-slate-100 group-hover:text-amber-500 transition-colors">
                    <Package size={20} />
                  </div>
                  <div>
                    <p className="text-xs font-black text-slate-800 leading-tight">{product.name}</p>
                    <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-0.5">{product.stock} restantes</p>
                  </div>
                </div>
                <div className="w-2 h-2 bg-amber-500 rounded-full animate-ping" />
              </div>
            ))}
            {lowStockProducts.length === 0 && (
              <div className="text-center py-10">
                <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center text-emerald-500 mx-auto mb-4">
                  <TrendingUp size={32} />
                </div>
                <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Nivel de stock óptimo</p>
              </div>
            )}
            <button className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-slate-800 transition-all shadow-xl shadow-slate-200">
              Optimizar Stock
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
