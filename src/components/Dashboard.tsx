import React, { useEffect, useState } from "react";
import { collection, query, onSnapshot, limit, orderBy } from "firebase/firestore";
import { db } from "../lib/firebase";
import { 
  Package, 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle,
  ArrowRight
} from "lucide-react";
import { formatCurrency, cn } from "../lib/utils";
import { useAuth } from "../contexts/AuthContext";

export function Dashboard() {
  const { profile } = useAuth();
  const [stats, setStats] = useState({
    totalProducts: 0,
    totalStockValue: 0,
    lowStockCount: 0,
    recentSales: 0
  });
  const [lowStockProducts, setLowStockProducts] = useState<any[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<any[]>([]);

  useEffect(() => {
    // Listen to products
    const qProducts = query(collection(db, "products"));
    const unsubProducts = onSnapshot(qProducts, (snapshot) => {
      let totalValue = 0;
      let lowStock = 0;
      const lowStockList: any[] = [];
      
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
    const qTx = query(collection(db, "transactions"), orderBy("timestamp", "desc"), limit(10));
    const unsubTx = onSnapshot(qTx, (snapshot) => {
      const txs: any[] = [];
      let salesCount = 0;
      snapshot.forEach((doc) => {
        const data = doc.data();
        txs.push({ id: doc.id, ...data });
        if (data.type === 'out') salesCount++;
      });
      setRecentTransactions(txs);
      setStats(prev => ({ ...prev, recentSales: salesCount }));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "transactions (Dashboard)");
    });

    return () => {
      unsubProducts();
      unsubTx();
    };
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Bienvenido, {profile?.name}</h2>
          <p className="text-gray-500">Aquí tienes el resumen de tu inventario hoy.</p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard 
          title="Productos" 
          value={stats.totalProducts} 
          icon={Package} 
          color="blue" 
        />
        <StatCard 
          title="Valor Total" 
          value={formatCurrency(stats.totalStockValue)} 
          icon={TrendingUp} 
          color="green" 
        />
        <StatCard 
          title="Stock Bajo" 
          value={stats.lowStockCount} 
          icon={AlertTriangle} 
          color="orange"
          alert={stats.lowStockCount > 0}
        />
        <StatCard 
          title="Ventas Recientes" 
          value={stats.recentSales} 
          icon={TrendingDown} 
          color="purple" 
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Low Stock Alerts */}
        <div className="bg-white rounded-2xl shadow-sm border p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-gray-900 flex items-center gap-2">
              <AlertTriangle className="text-orange-500" size={20} />
              Alertas de Stock Bajo
            </h3>
          </div>
          <div className="space-y-3">
            {lowStockProducts.length > 0 ? (
              lowStockProducts.map(product => (
                <div key={product.id} className="flex items-center justify-between p-3 bg-orange-50 rounded-xl border border-orange-100">
                  <div>
                    <p className="font-semibold text-gray-900 text-sm">{product.name}</p>
                    <p className="text-xs text-orange-700">Stock: {product.stock} / Min: {product.minThreshold}</p>
                  </div>
                  <div className="text-orange-600">
                    <AlertTriangle size={18} />
                  </div>
                </div>
              ))
            ) : (
              <p className="text-gray-500 text-sm text-center py-4 italic">Todo en orden, no hay stock bajo.</p>
            )}
          </div>
        </div>

        {/* Recent Transactions */}
        <div className="bg-white rounded-2xl shadow-sm border p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-gray-900 flex items-center gap-2">
              <History className="text-blue-500" size={20} />
              Últimos Movimientos
            </h3>
          </div>
          <div className="space-y-3">
            {recentTransactions.map(tx => (
              <div key={tx.id} className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-xl transition-colors border border-transparent hover:border-gray-100">
                <div className="flex items-center space-x-3">
                  <div className={cn(
                    "p-2 rounded-lg",
                    tx.type === 'in' ? "bg-green-50 text-green-600" : "bg-blue-50 text-blue-600"
                  )}>
                    {tx.type === 'in' ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900 text-sm">{tx.productName}</p>
                    <p className="text-xs text-gray-500">{tx.userName} • {new Date(tx.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                  </div>
                </div>
                <div className={cn(
                  "font-bold text-sm",
                  tx.type === 'in' ? "text-green-600" : "text-blue-600"
                )}>
                  {tx.type === 'in' ? '+' : '-'}{tx.quantity}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon: Icon, color, alert }: any) {
  const colors: any = {
    blue: "bg-blue-50 text-blue-600 border-blue-100",
    green: "bg-green-50 text-green-600 border-green-100",
    orange: "bg-orange-50 text-orange-600 border-orange-100",
    purple: "bg-purple-50 text-purple-600 border-purple-100",
  };

  return (
    <div className={cn(
      "bg-white p-6 rounded-2xl shadow-sm border transition-all hover:shadow-md",
      alert && "ring-2 ring-orange-500 ring-offset-2"
    )}>
      <div className="flex items-center justify-between mb-4">
        <div className={cn("p-3 rounded-xl", colors[color])}>
          <Icon size={24} />
        </div>
        {alert && <span className="flex h-3 w-3 rounded-full bg-orange-600 absolute -top-1 -right-1 animate-ping"></span>}
      </div>
      <div>
        <p className="text-sm font-medium text-gray-500 uppercase tracking-wider">{title}</p>
        <p className="text-3xl font-bold text-gray-900 mt-1">{value}</p>
      </div>
    </div>
  );
}

const History = ({ size, className }: any) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className={className}
  >
    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
    <path d="M3 3v5h5" />
    <path d="M12 7v5l4 2" />
  </svg>
);
