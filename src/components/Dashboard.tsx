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
  DollarSign,
  BarChart3,
  Zap
} from "lucide-react";
import { formatCurrency, cn } from "../lib/utils";
import { motion, AnimatePresence } from "motion/react";
import { useAuth } from "../contexts/AuthContext";
import { useSettings } from "../contexts/SettingsContext";
import { getStockInsights, StockInsight } from "../services/aiService";
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts';
import { 
  Plus,
  Sparkles,
  Info,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  ChevronRight,
  CreditCard,
  X,
  FileText,
  PieChart as PieIcon
} from "lucide-react";

export function Dashboard({ onNavigate }: { onNavigate?: (page: any) => void }) {
  const { profile } = useAuth();
  const { settings } = useSettings();
  const [stats, setStats] = useState({
    totalProducts: 0,
    totalStockValue: 0,
    recentSales: 0,
    lowStockCount: 0,
    avgTicket: 0,
    totalProfit: 0,
    totalExpenses: 0
  });
  const [topProducts, setTopProducts] = useState<any[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<any[]>([]);
  const [lowStockProducts, setLowStockProducts] = useState<any[]>([]);
  const [chartData, setChartData] = useState<any[]>([]);
  const [allProducts, setAllProducts] = useState<any[]>([]);
  const [recentExpenses, setRecentExpenses] = useState<any[]>([]);
  const [expenseChartData, setExpenseChartData] = useState<any[]>([]);
  
  const [isMounted, setIsMounted] = useState(false);
  const [isClosingModalOpen, setIsClosingModalOpen] = useState(false);
  
  const [isAIModalOpen, setIsAIModalOpen] = useState(false);
  const [aiInsight, setAiInsight] = useState<StockInsight | null>(null);
  const [isAILoading, setIsAILoading] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    // Listen to products for stats
    const qProducts = query(collection(db, "products"));
    const unsubProducts = onSnapshot(qProducts, (snapshot) => {
      let totalValue = 0;
      let lowStock = 0;
      let lowStockList: any[] = [];
      const prods: any[] = [];
      
      snapshot.forEach((doc) => {
        const data = doc.data();
        prods.push({ id: doc.id, ...data });
        const price = Number(data.price) || 0;
        const stock = Number(data.stock) || 0;
        const minThreshold = Number(data.minThreshold) || 0;
        
        totalValue += price * stock;
        if (stock <= minThreshold && data.name) {
          lowStock++;
          lowStockList.push({ id: doc.id, ...data, price, stock, minThreshold });
        }
      });

      setAllProducts(prods);
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
      limit(100)
    );
    const unsubTransactions = onSnapshot(qTransactions, (snapshot) => {
      let salesCount = 0;
      let totalSalesAmount = 0;
      let totalProfitAmount = 0;
      const salesByDate: Record<string, number> = {};
      const profitByDate: Record<string, number> = {};
      const productCounts: Record<string, { count: number, name: string }> = {};
      
      const txs = snapshot.docs.map(doc => {
        const data = doc.data();
        if (data.type === "sale") {
          salesCount++;
          const amount = Number(data.amount) || 0;
          const profit = Number(data.profit) || 0;
          totalSalesAmount += amount;
          totalProfitAmount += profit;
          
          const d = data.timestamp?.toDate ? data.timestamp.toDate() : new Date();
          const dateStr = d.toLocaleDateString();
          salesByDate[dateStr] = (salesByDate[dateStr] || 0) + amount;
          profitByDate[dateStr] = (profitByDate[dateStr] || 0) + profit;

          if (data.productName) {
            productCounts[data.productName] = {
              count: (productCounts[data.productName]?.count || 0) + (Number(data.quantity) || 1),
              name: data.productName
            };
          }
        }
        return { id: doc.id, ...data };
      });

      // Prepare top products
      const sortedProducts = Object.values(productCounts)
        .sort((a, b) => b.count - a.count)
        .slice(0, 4);

      // Prepare chart data for last 7 days
      const last7Days = Array.from({ length: 7 }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateStr = d.toLocaleDateString();
        return {
          name: d.toLocaleDateString('es-CL', { weekday: 'short' }),
          sales: salesByDate[dateStr] || 0,
          profit: profitByDate[dateStr] || 0
        };
      }).reverse();

      setRecentTransactions(txs.slice(0, 7));
      setTopProducts(sortedProducts);
      setChartData(last7Days);
      setStats(prev => ({ 
        ...prev, 
        recentSales: salesCount,
        totalProfit: totalProfitAmount,
        avgTicket: salesCount > 0 ? totalSalesAmount / salesCount : 0
      }));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "transactions (Dashboard)");
    });

    // Listen to recent expenses
    const qExpenses = query(collection(db, "expenses"), limit(200));
    const unsubExpenses = onSnapshot(qExpenses, (snapshot) => {
      let expenseSum = 0;
      const exps: any[] = [];
      snapshot.forEach(doc => {
        const data = doc.data();
        exps.push({ id: doc.id, ...data });
        expenseSum += Number(data.amount) || 0;
      });
      setRecentExpenses(exps);
      setStats(prev => ({ ...prev, totalExpenses: expenseSum }));

      // Prepare expense chart data
      const catTotals: Record<string, number> = {};
      exps.forEach(e => {
        catTotals[e.category] = (catTotals[e.category] || 0) + (Number(e.amount) || 0);
      });
      const pieData = Object.entries(catTotals).map(([name, value]) => ({ name, value }));
      setExpenseChartData(pieData);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "expenses (Dashboard)");
    });

    return () => {
      unsubProducts();
      unsubTransactions();
      unsubExpenses();
    };
  }, []);

  const handleFetchAI = async () => {
    if (!settings.aiEnabled) {
      alert("La Inteligencia Artificial está desactivada. Actívala en Configuración.");
      return;
    }
    setIsAILoading(true);
    setIsAIModalOpen(true);
    try {
      const insight = await getStockInsights(allProducts, recentTransactions, recentExpenses);
      setAiInsight(insight);
    } catch (err) {
      console.error(err);
    } finally {
      setIsAILoading(false);
    }
  };

  const isAdmin = profile?.role === "admin" || profile?.role === "manager";

  const topStats = isAdmin ? [
    { label: "Ventas Totales", value: formatCurrency(chartData.reduce((a, b) => a + b.sales, 0)), icon: ShoppingCart, color: "bg-indigo-600", trend: "+12.4%", up: true },
    { label: "Utilidad Neta", value: formatCurrency(stats.totalProfit - stats.totalExpenses), icon: TrendingUp, color: "bg-emerald-500", trend: "+8.2%", up: true },
    { label: "Gastos (Egresos)", value: formatCurrency(stats.totalExpenses), icon: CreditCard, color: "bg-rose-500", trend: "+15%", up: false },
    { label: "Alertas de Stock", value: stats.lowStockCount, icon: AlertTriangle, color: "bg-amber-500", trend: "-2%", up: false },
  ] : [
    { label: "Ventas Hoy", value: formatCurrency(chartData[chartData.length - 1]?.sales || 0), icon: ShoppingCart, color: "bg-indigo-600", trend: "Hoy", up: true },
    { label: "Transacciones", value: stats.recentSales, icon: Activity, color: "bg-emerald-500", trend: "Total", up: true },
    { label: "Artículos Vendidos", value: topProducts.reduce((a, b) => a + b.count, 0), icon: Package, color: "bg-amber-500", trend: "Popular", up: true },
    { label: "Ticket Promedio", value: formatCurrency(stats.avgTicket), icon: DollarSign, color: "bg-indigo-400", trend: "Promedio", up: true },
  ];

  const COLORS = ['#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

  const handlePrintZReport = () => {
    // Basic implementation of a Z-Report (Daily Closing)
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const netProfit = stats.totalProfit - stats.totalExpenses;
    const totalSales = chartData.reduce((a, b) => a + b.sales, 0);

    const reportHtml = `
      <html>
        <head>
          <title>Cierre de Caja - ${new Date().toLocaleDateString()}</title>
          <style>
            body { font-family: sans-serif; padding: 40px; color: #1e293b; line-height: 1.6; }
            .header { border-bottom: 2px solid #e2e8f0; padding-bottom: 20px; margin-bottom: 30px; }
            .row { display: flex; justify-content: space-between; margin-bottom: 10px; }
            .total { border-top: 1px solid #e2e8f0; padding-top: 10px; font-weight: bold; font-size: 1.2em; }
            .section { margin-top: 40px; }
            h2 { color: #4f46e5; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>REPORTE DE CIERRE - ${settings.businessName}</h1>
            <p>Fecha: ${new Date().toLocaleString()}</p>
          </div>
          
          <div class="section">
            <h2>Resumen Financiero</h2>
            <div class="row"><span>Ventas Totales:</span><span>${formatCurrency(totalSales)}</span></div>
            <div class="row"><span>Margen de Utilidad Proyectado:</span><span>${formatCurrency(stats.totalProfit)}</span></div>
            <div class="row"><span>Gastos Operativos:</span><span>${formatCurrency(stats.totalExpenses)}</span></div>
            <div class="row total"><span>Utilidad Neta Real:</span><span>${formatCurrency(netProfit)}</span></div>
          </div>

          <div class="section">
            <h2>Inventario</h2>
            <div class="row"><span>Valor Total Stock:</span><span>${formatCurrency(stats.totalStockValue)}</span></div>
            <div class="row"><span>Productos con Bajo Stock:</span><span>${stats.lowStockCount}</span></div>
          </div>

          <div class="footer" style="margin-top: 100px; border-top: 1px dashed #ccc; padding-top: 20px; text-align: center;">
            <p>Generado por StockFlow ERP</p>
          </div>
          <script>window.print();</script>
        </body>
      </html>
    `;
    printWindow.document.write(reportHtml);
    printWindow.document.close();
  };

  return (
    <>
      <div className="space-y-10 max-w-7xl mx-auto">
      {/* Welcome Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black text-slate-800 tracking-tight">Centro de Mando</h1>
          <p className="text-slate-500 font-medium mt-1">Sincronizado y listo para operar, {profile?.name}.</p>
        </div>
        <div className="flex items-center space-x-3">
          {isAdmin && (
            <button 
              onClick={handlePrintZReport}
              className="flex items-center space-x-2 bg-white border border-slate-200 px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-600 hover:bg-slate-50 transition-all shadow-sm"
            >
              <FileText size={18} />
              <span>Cierre Z</span>
            </button>
          )}
          <div className="flex items-center space-x-2 bg-indigo-50 border border-indigo-100 px-4 py-3 rounded-2xl">
            <div className="w-2 h-2 bg-indigo-600 rounded-full animate-pulse" />
            <span className="text-xs font-black text-indigo-700 uppercase tracking-widest">
              {isAdmin ? "Admin" : "Vendedor"} Activo
            </span>
          </div>
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

      {/* AI CTA - Only for Admins */}
      {isAdmin && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative overflow-hidden bg-gradient-to-br from-indigo-600 to-violet-700 rounded-[3rem] p-8 text-white shadow-2xl shadow-indigo-200"
        >
          <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="space-y-3 text-center md:text-left max-w-xl">
              <div className="inline-flex items-center space-x-2 bg-white/10 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border border-white/10">
                <Sparkles size={12} className="text-yellow-300" />
                <span>Gemini IA Sincronizada</span>
              </div>
              <h2 className="text-4xl font-black tracking-tight leading-tight">Optimización Inteligente</h2>
              <p className="text-indigo-100 font-medium text-lg leading-relaxed">
                Nuestro motor de IA analiza tus 100 transacciones más recientes y el stock actual para darte sugerencias estratégicas.
              </p>
            </div>
            <button 
              onClick={handleFetchAI}
              className="bg-white text-indigo-600 px-10 py-5 rounded-[2rem] font-black uppercase tracking-widest text-xs hover:bg-indigo-50 transition-all flex items-center space-x-3 shadow-xl hover:scale-105 active:scale-95 group"
            >
              <RefreshCw size={20} className="group-hover:rotate-180 transition-transform duration-500" />
              <span>Consultar a la IA</span>
            </button>
          </div>
          <div className="absolute top-0 right-0 w-80 h-80 bg-white/10 blur-[100px] rounded-full -mr-40 -mt-40" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-indigo-500/30 blur-[80px] rounded-full -ml-32 -mb-32" />
        </motion.div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Sales Chart Area - Restricted to Admin or simplified for Seller */}
        <div className={cn(isAdmin ? "lg:col-span-8" : "lg:col-span-12")}>
          <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm h-full">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center space-x-3">
                <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl">
                  {isAdmin ? <BarChart3 size={20} /> : <Zap size={20} />}
                </div>
                <div>
                  <h2 className="text-xl font-black text-slate-800 tracking-tight">
                    {isAdmin ? "Rendimiento de Ventas" : "Resumen de Actividad"}
                  </h2>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mt-1">Últimos 7 días</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                  {isAdmin ? "Ventas vs Utilidad" : "Tendencia de Ventas"}
                </p>
                <div className="flex items-center space-x-4">
                   <div className="flex items-center space-x-1.5"><div className="w-2 h-2 rounded-full bg-indigo-600" /> <span className="text-[10px] font-bold text-slate-500 uppercase">Ventas</span></div>
                   {isAdmin && (
                     <div className="flex items-center space-x-1.5"><div className="w-2 h-2 rounded-full bg-emerald-500" /> <span className="text-[10px] font-bold text-slate-500 uppercase">Utilidad</span></div>
                   )}
                </div>
              </div>
            </div>
            
            <div className="h-[300px] w-full">
              {isMounted && (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.1}/>
                        <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                      </linearGradient>
                      {isAdmin && (
                        <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                        </linearGradient>
                      )}
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis 
                      dataKey="name" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }}
                      dy={10}
                    />
                    <YAxis 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }}
                    />
                    <Tooltip 
                      contentStyle={{ borderRadius: '24px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', padding: '16px' }}
                      labelStyle={{ fontWeight: 800, color: '#1e293b', marginBottom: '8px' }}
                      formatter={(value: any, name: any) => [formatCurrency(value), name === 'sales' ? 'Ventas' : 'Utilidad']}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="sales" 
                      stroke="#4f46e5" 
                      strokeWidth={4}
                      fillOpacity={1} 
                      fill="url(#colorSales)" 
                      animationDuration={1500}
                    />
                    {isAdmin && (
                      <Area 
                        type="monotone" 
                        dataKey="profit" 
                        stroke="#10b981" 
                        strokeWidth={4}
                        fillOpacity={1} 
                        fill="url(#colorProfit)" 
                        animationDuration={1500}
                      />
                    )}
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>

        {/* Expenses Pie Chart Area - Only for Admins */}
        {isAdmin && (
          <div className="lg:col-span-4">
            <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm h-full flex flex-col">
              <div className="flex items-center space-x-3 mb-8">
                <div className="p-3 bg-rose-50 text-rose-600 rounded-2xl">
                  <PieIcon size={20} />
                </div>
                <div>
                  <h2 className="text-xl font-black text-slate-800 tracking-tight">Distribución Gastos</h2>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mt-1">Costos Operativos</p>
                </div>
              </div>
              
              <div className="flex-1 min-h-[250px] relative">
                {isMounted && expenseChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={expenseChartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={8}
                        dataKey="value"
                      >
                        {expenseChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} cornerRadius={8} />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                        formatter={(value: any) => [formatCurrency(value), '']}
                      />
                      <Legend 
                         verticalAlign="bottom" 
                         content={({ payload }) => (
                           <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 mt-6">
                             {payload?.map((entry: any, index: number) => (
                               <div key={index} className="flex items-center space-x-1.5">
                                 <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
                                 <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter truncate max-w-[80px]">
                                   {entry.value}
                                 </span>
                               </div>
                             ))}
                           </div>
                         )}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center space-y-3">
                     <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center text-slate-200">
                       <CreditCard size={32} />
                     </div>
                     <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Sin gastos registrados</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
        
        {/* Main Activity Feed */}
        <div className="lg:col-span-8 space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-3 bg-slate-900 rounded-2xl text-white">
                <Activity size={20} />
              </div>
              <h2 className="text-xl font-black text-slate-800 tracking-tight">Actividad del Sistema</h2>
            </div>
            <button 
              onClick={() => onNavigate?.("transactions")}
              className="text-xs font-black text-indigo-600 uppercase tracking-widest hover:text-indigo-400 transition-colors"
            >
              Ver Registro Completo
            </button>
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
          {isAdmin && (
            <div className="flex items-center space-x-3 mt-10">
              <div className="p-3 bg-amber-500 rounded-2xl text-white shadow-lg shadow-amber-100">
                <AlertTriangle size={20} />
              </div>
              <h2 className="text-xl font-black text-slate-800 tracking-tight">Alertas Rápidas</h2>
            </div>
          )}

          {isAdmin && (
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
              <button 
                onClick={() => onNavigate?.("inventory")}
                className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-slate-800 transition-all shadow-xl shadow-slate-200"
              >
                Ver Inventario Completo
              </button>
            </div>
          )}

          {/* Trending Products */}
          <div className="flex items-center space-x-3 mt-10">
            <div className="p-3 bg-indigo-600 rounded-2xl text-white shadow-lg shadow-indigo-100">
              <Zap size={20} />
            </div>
            <h2 className="text-xl font-black text-slate-800 tracking-tight">Más Vendidos</h2>
          </div>
          
          <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm p-6 space-y-4">
            {topProducts.map((p, idx) => (
              <div key={p.name} className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <span className="text-xs font-black text-slate-200 w-4">0{idx + 1}</span>
                  <p className="text-xs font-black text-slate-800">{p.name}</p>
                </div>
                <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-2 py-1 rounded-lg">
                  {p.count} vtas
                </span>
              </div>
            ))}
            {topProducts.length === 0 && (
              <p className="text-center text-[10px] font-black text-slate-300 uppercase tracking-widest py-4">
                Pendiente de datos
              </p>
            )}
          </div>
        </div>
      </div>
      </div>

      {/* AI Insight Modal */}
      <AnimatePresence>
        {isAIModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAIModalOpen(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 40 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 40 }}
              className="relative bg-white w-full max-w-2xl rounded-[3rem] shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
            >
              <div className="p-10 border-b border-slate-50 flex items-center justify-between bg-indigo-600 text-white">
                <div className="flex items-center space-x-4">
                  <div className="p-3 bg-white/10 rounded-2xl">
                    <Sparkles size={24} className="text-yellow-300" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-black tracking-tight">Análisis Estratégico</h2>
                    <p className="text-xs font-black text-indigo-200 uppercase tracking-widest mt-1">Potenciado por Google Gemini</p>
                  </div>
                </div>
                <button onClick={() => setIsAIModalOpen(false)} className="p-2 hover:bg-white/10 rounded-xl transition-all">
                  <X size={24} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-10 space-y-10">
                {isAILoading ? (
                  <div className="flex flex-col items-center justify-center py-20 space-y-6">
                    <div className="relative">
                      <div className="w-20 h-20 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin" />
                      <Sparkles className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-indigo-600 animate-pulse" size={24} />
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-black text-slate-800">Analizando tu negocio...</p>
                      <p className="text-xs font-black text-slate-400 uppercase tracking-widest mt-2 animate-pulse">Este proceso toma unos segundos</p>
                    </div>
                  </div>
                ) : aiInsight ? (
                  <>
                    <div className="bg-indigo-50 p-6 rounded-3xl border border-indigo-100">
                      <h3 className="text-xs font-black text-indigo-700 uppercase tracking-widest mb-3 flex items-center space-x-2">
                        <Info size={14} />
                        <span>Resumen Ejecutivo</span>
                      </h3>
                      <p className="text-slate-700 font-bold leading-relaxed">{aiInsight.summary}</p>
                    </div>

                    <div className="space-y-4">
                      <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Recomendaciones de Inventario</h3>
                      <div className="grid gap-4">
                        {aiInsight.recommendations.map((rec, i) => (
                          <div key={i} className="bg-slate-50 p-5 rounded-3xl border border-slate-100 flex items-start space-x-4">
                            <div className={cn(
                              "p-3 rounded-2xl",
                              rec.action === "RESTOCK" ? "bg-amber-100 text-amber-600" :
                              rec.action === "DISCOUNT" ? "bg-rose-100 text-rose-600" :
                              "bg-blue-100 text-blue-600"
                            )}>
                              {rec.action === "RESTOCK" ? <RefreshCw size={20} /> :
                               rec.action === "DISCOUNT" ? <ArrowDownRight size={20} /> :
                               <CheckCircle2 size={20} />}
                            </div>
                            <div>
                              <p className="text-sm font-black text-slate-800">{rec.productName}</p>
                              <div className="flex items-center space-x-2 mt-0.5">
                                <span className={cn(
                                  "text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-lg",
                                  rec.action === "RESTOCK" ? "bg-amber-200 text-amber-800" :
                                  rec.action === "DISCOUNT" ? "bg-rose-200 text-rose-800" :
                                  "bg-blue-200 text-blue-800"
                                )}>
                                  {rec.action}
                                </span>
                              </div>
                              <p className="text-xs font-medium text-slate-500 mt-2 leading-relaxed">{rec.reason}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Análisis Detallado</h3>
                      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm">
                        <p className="text-slate-600 text-sm leading-loose whitespace-pre-wrap">{aiInsight.analysis}</p>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-20">
                    <p className="text-slate-400 font-bold">No se pudieron generar los insights.</p>
                  </div>
                )}
              </div>

              <div className="p-8 border-t border-slate-50 bg-slate-50 flex justify-end">
                <button 
                  onClick={() => setIsAIModalOpen(false)}
                  className="bg-slate-900 text-white px-8 py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-slate-800 transition-all"
                >
                  Entendido
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
