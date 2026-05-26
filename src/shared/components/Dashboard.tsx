import React, { useEffect, useState, useMemo } from "react";
import { collection, query, onSnapshot, limit, orderBy, where, getDocs, updateDoc, doc, serverTimestamp, addDoc } from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../../lib/firebase";
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
  Zap,
  Users,
  Smartphone
} from "lucide-react";
import { formatCurrency, cn } from "../../lib/utils";
import { motion, AnimatePresence } from "motion/react";
import { useAuth } from "../../contexts/AuthContext";
import { useSettings } from "../../contexts/SettingsContext";
import { getStockInsights, StockInsight } from "../../services/aiService";

const DashboardAreaChart = React.lazy(() => import("./DashboardCharts").then(m => ({ default: m.DashboardAreaChart })));
const DashboardPieChart = React.lazy(() => import("./DashboardCharts").then(m => ({ default: m.DashboardPieChart })));
const ExecutiveTrendChart = React.lazy(() => import("./DashboardCharts").then(m => ({ default: m.ExecutiveTrendChart })));
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
  const { user, profile } = useAuth();
  const { settings } = useSettings();
  const [stats, setStats] = useState({
    totalProducts: 0,
    totalStockValue: 0,
    recentSales: 0,
    lowStockCount: 0,
    avgTicket: 0,
    totalProfit: 0,
    totalExpenses: 0,
    activeCustomers: 0,
    salesVelocity: 0,
    avgLifetimeValue: 0
  });
  const [topProducts, setTopProducts] = useState<any[]>([]);
  const [topCustomers, setTopCustomers] = useState<any[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<any[]>([]);
  const [lowStockProducts, setLowStockProducts] = useState<any[]>([]);
  const [chartData, setChartData] = useState<any[]>([]);
  const [categoryData, setCategoryData] = useState<any[]>([]);
  const [allProducts, setAllProducts] = useState<any[]>([]);
  const [recentExpenses, setRecentExpenses] = useState<any[]>([]);
  const [expenseChartData, setExpenseChartData] = useState<any[]>([]);
  
  const [isMounted, setIsMounted] = useState(false);
  const [activeDashboardTab, setActiveDashboardTab] = useState<"overview" | "charts" | "finances" | "sales" | "inventory">("overview");
  const allProductsRef = React.useRef<any[]>([]);
  const [isClosingModalOpen, setIsClosingModalOpen] = useState(false);
  
  const [isAIModalOpen, setIsAIModalOpen] = useState(false);
  const [aiInsight, setAiInsight] = useState<StockInsight | null>(null);
  const [isAILoading, setIsAILoading] = useState(false);
  const [customers, setCustomers] = useState<any[]>([]);
  const [pendingClaimsList, setPendingClaimsList] = useState<any[]>([]);
  const [recentClaimsList, setRecentClaimsList] = useState<any[]>([]);
  const [selectedClaim, setSelectedClaim] = useState<any | null>(null);
  const [isImageZoomed, setIsImageZoomed] = useState<boolean>(false);
  const [resolutionNote, setResolutionNote] = useState<string>("");
  const [isResolvingClaim, setIsResolvingClaim] = useState<boolean>(false);
  const [claimFilter, setClaimFilter] = useState<"pending" | "resolved">("pending");

  const loadClaims = async () => {
    try {
      const qClaims = query(collection(db, "claims"), limit(250));
      const snap = await getDocs(qClaims);
      const allClaims: any[] = [];
      snap.forEach(doc => {
        allClaims.push({ id: doc.id, ...doc.data() });
      });

      const pendingList = allClaims.filter(c => c.status !== "resolved");
      setPendingClaimsList(pendingList);
      setRecentClaimsList(allClaims);
    } catch (error) {
      console.error("Error fetching claims for dashboard stats:", error);
    }
  };

  const claimsStats = useMemo(() => {
    const pending = pendingClaimsList.length;
    
    const now = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    let resolvedLastMonthCount = 0;
    let totalResolutionTimeMs = 0;
    let resolvedWithTimeCount = 0;
    
    recentClaimsList.forEach(data => {
      if (data.status === "resolved") {
        const resolvedAtDate = data.resolvedAt?.toDate ? data.resolvedAt.toDate() : (data.resolvedAt ? new Date(data.resolvedAt) : null);
        const createdAtDate = data.timestamp?.toDate ? data.timestamp.toDate() : (data.timestamp ? new Date(data.timestamp) : null);
        
        if (resolvedAtDate) {
          if (resolvedAtDate >= thirtyDaysAgo && resolvedAtDate <= now) {
            resolvedLastMonthCount++;
          }
          if (createdAtDate) {
            const diffMs = resolvedAtDate.getTime() - createdAtDate.getTime();
            if (diffMs >= 0) {
              totalResolutionTimeMs += diffMs;
              resolvedWithTimeCount++;
            }
          }
        }
      }
    });
    
    let avgText = "Sin casos";
    if (resolvedWithTimeCount > 0) {
      const avgMs = totalResolutionTimeMs / resolvedWithTimeCount;
      const avgHours = avgMs / (1000 * 60 * 60);
      if (avgHours < 24) {
        avgText = `${avgHours.toFixed(1)} h`;
      } else {
        const avgDays = avgHours / 24;
        avgText = `${avgDays.toFixed(1)} d`;
      }
    }
    
    return {
      pendingCount: pending,
      resolvedLastMonth: resolvedLastMonthCount,
      avgResolutionTimeText: avgText
    };
  }, [pendingClaimsList, recentClaimsList]);

  const executiveStats = useMemo(() => {
    // Total stock valuation and cost
    let totalStockCost = 0;
    let inactiveStockCost = 0;
    
    const activeProductIds = new Set(recentTransactions.filter(t => t.type === "sale").map(t => t.productId));

    allProducts.forEach(p => {
      const cost = Number(p.costPrice || p.price * 0.6 || 0);
      const qty = Number(p.stock || 0);
      const itemCostVal = cost * qty;
      totalStockCost += itemCostVal;
      
      if (!activeProductIds.has(p.id) && qty > 0) {
        inactiveStockCost += itemCostVal;
      }
    });

    const netProfit = stats.totalProfit - stats.totalExpenses;
    const projectedExpenses = stats.totalExpenses > 0 ? stats.totalExpenses * 1.15 : 120000;

    return {
      totalStockCost,
      netProfit,
      projectedExpenses,
      inactiveStockCost
    };
  }, [allProducts, stats.totalProfit, stats.totalExpenses, recentTransactions]);

  useEffect(() => {
    const timer = setTimeout(() => setIsMounted(true), 1000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    // Listen to customers
    const qCust = query(collection(db, "customers"));
    const unsubCust = onSnapshot(qCust, (snapshot) => {
      const custData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setCustomers(custData);
      setStats(prev => ({ ...prev, activeCustomers: snapshot.size }));
    });

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
      allProductsRef.current = prods;
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

    const isAdminEffect = profile?.role === "admin" || profile?.role === "manager";
    const isLogisticsEffect = profile?.role === "logistics";

    // Listen to recent transactions
    let qTransactions = query(
      collection(db, "transactions"), 
      orderBy("timestamp", "desc"), 
      limit(200)
    );
    
    // Filter for sellers if not admin/manager/logistics
    if (!isAdminEffect && !isLogisticsEffect) {
      qTransactions = query(
        collection(db, "transactions"),
        where("userId", "==", profile?.uid),
        orderBy("timestamp", "desc"),
        limit(200)
      );
    }

    const unsubTransactions = onSnapshot(qTransactions, (snapshot) => {
      let salesCount = 0;
      let totalSalesAmount = 0;
      let totalProfitAmount = 0;
      const salesByDate: Record<string, number> = {};
      const profitByDate: Record<string, number> = {};
      const productCounts: Record<string, { count: number, name: string }> = {};
      const customerSales: Record<string, { id: string, name: string, total: number, visits: number }> = {};
      const categoriesProfit: Record<string, number> = {};
      
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

          if (data.customerName && data.customerName !== "VENTA GENERAL") {
            const cId = data.customerId || data.customerName;
            if (!customerSales[cId]) {
              customerSales[cId] = { id: cId, name: data.customerName, total: 0, visits: 0 };
            }
            customerSales[cId].total += amount;
            customerSales[cId].visits += 1;
          }

          // Use the ref to avoid dependency cycle
          const prod = allProductsRef.current.find(p => p.id === data.productId || p.name === data.productName);
          const cat = prod?.category || "Otros";
          categoriesProfit[cat] = (categoriesProfit[cat] || 0) + profit;
        }
        return { id: doc.id, ...data } as any;
      });

      // VIP Customers
      const sortedCustomers = Object.values(customerSales)
        .sort((a, b) => b.total - a.total)
        .slice(0, 5);

      // Top Products
      const sortedProducts = Object.values(productCounts)
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      // Category Profitability
      const catChart = Object.entries(categoriesProfit).map(([name, profit]) => ({ name, profit }));

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

      setRecentTransactions(txs.slice(0, 10));
      setTopProducts(sortedProducts);
      setTopCustomers(sortedCustomers);
      setCategoryData(catChart);
      setChartData(last7Days);
      
      const totalSalesAllTime = txs.reduce((acc: number, current: any) => acc + (current.type === 'sale' ? (Number(current.amount) || 0) : 0), 0);
      const uniqueCustomersCount = Object.keys(customerSales).length;

      setStats(prev => ({ 
        ...prev, 
        recentSales: salesCount,
        totalProfit: totalProfitAmount,
        avgTicket: salesCount > 0 ? totalSalesAmount / salesCount : 0,
        salesVelocity: salesCount / (snapshot.size || 1), // Sales per transaction density
        avgLifetimeValue: uniqueCustomersCount > 0 ? totalSalesAllTime / uniqueCustomersCount : 0
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

    // Fetch claims once on load (instead of real-time listener) to optimize connections
    loadClaims();

    return () => {
      unsubCust();
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

  const predictiveStockAlerts = useMemo(() => {
    return allProducts
      .map(p => {
        const salesInPeriod = topProducts.find(tp => tp.name === p.name)?.count || 0;
        const velocity = salesInPeriod / 7; // rough 7 day velocity
        const daysRemaining = velocity > 0 ? Math.floor(p.stock / velocity) : 999;
        return { ...p, velocity, daysRemaining };
      })
      .filter(p => Number(p.stock) <= Number(p.minThreshold) || p.daysRemaining < 30)
      .sort((a, b) => a.daysRemaining - b.daysRemaining)
      .slice(0, 4);
  }, [allProducts, topProducts]);

  const forecastSales7Days = useMemo(() => {
    const totalLast7 = chartData.reduce((acc, curr) => acc + curr.sales, 0);
    const avgDaily = totalLast7 / (chartData.length || 7);
    return avgDaily * 7;
  }, [chartData]);

  const churnRiskStats = useMemo(() => {
    return customers.reduce((acc, c) => {
      if (c.churnRisk === "crítico") acc.highRisk++;
      else if (c.churnRisk === "advertencia") acc.mediumRisk++;
      return acc;
    }, { highRisk: 0, mediumRisk: 0 });
  }, [customers]);

  const executiveTrendData = useMemo(() => {
    const expensesByDate: Record<string, number> = {};
    recentExpenses.forEach(exp => {
      let d: Date;
      if (exp.date) {
        d = new Date(exp.date);
      } else if (exp.timestamp?.toDate) {
        d = exp.timestamp.toDate();
      } else {
        d = new Date();
      }
      const dateStr = d.toLocaleDateString();
      expensesByDate[dateStr] = (expensesByDate[dateStr] || 0) + (Number(exp.amount) || 0);
    });

    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toLocaleDateString();
      
      const dayName = d.toLocaleDateString('es-CL', { weekday: 'short' });
      const chartDay = chartData.find(c => c.name === dayName);
      const salesVal = chartDay ? chartDay.sales : 0;

      return {
        name: dayName,
        ventas: salesVal,
        gastos: expensesByDate[dateStr] || 0
      };
    }).reverse();
  }, [chartData, recentExpenses]);

  const isAdmin = profile?.role === "admin" || profile?.role === "manager";
  const isLogistics = profile?.role === "logistics";

  if (isLogistics) {
    return (
      <div className="space-y-10 max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <h1 className="text-4xl font-black text-slate-800 tracking-tight">Panel de Bodega</h1>
            <p className="text-slate-500 font-medium mt-1">Niveles de stock y alertas de reposición.</p>
          </div>
          <div className="flex items-center space-x-2 bg-amber-50 border border-amber-100 px-4 py-3 rounded-2xl">
            <div className="size-2 bg-amber-600 rounded-full animate-pulse" />
            <span className="text-xs font-black text-amber-700 uppercase tracking-widest">
              Rol: Logística
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            { label: "Stock Total", value: `${stats.totalProducts} SKU`, icon: Box, color: "bg-indigo-600" },
            { label: "Bajo Stock", value: stats.lowStockCount, icon: AlertTriangle, color: "bg-amber-500" },
            { label: "Salud Inventario", value: `${Math.round(((stats.totalProducts - stats.lowStockCount) / stats.totalProducts) * 100) || 0}%`, icon: Activity, color: "bg-emerald-500" },
            { label: "Movimientos Hoy", value: recentTransactions.length, icon: RefreshCw, color: "bg-slate-800" },
          ].map((stat, i) => (
            <div key={i} className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
              <div className="flex items-start justify-between mb-4">
                <div className={cn("p-4 rounded-3xl text-white shadow-lg", stat.color)}>
                  <stat.icon size={24} />
                </div>
              </div>
              <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px] mb-1">{stat.label}</p>
              <h3 className="text-2xl font-black text-slate-800 tracking-tight">{stat.value}</h3>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="space-y-6">
            <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
              <AlertTriangle className="text-amber-500" />
              Prioridad de Reposición
            </h2>
            <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm p-6 space-y-4">
              {predictiveStockAlerts.map((product) => (
                <div key={product.id} className="p-4 bg-slate-50 rounded-2xl flex items-center justify-between">
                  <div>
                    <p className="text-xs font-black text-slate-800">{product.name}</p>
                    <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest mt-1">Stock Actual: {product.stock}</p>
                  </div>
                  <span className="text-[10px] font-black text-rose-600 bg-rose-50 px-3 py-1 rounded-lg uppercase">
                    {product.daysRemaining < 30 ? `~${product.daysRemaining} días` : "CRÍTICO"}
                  </span>
                </div>
              ))}
            </div>
          </div>
          
          <div className="space-y-6">
             <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
              <Activity className="text-indigo-600" />
              Últimos Movimientos
            </h2>
            <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden divide-y divide-slate-50">
              {recentTransactions.slice(0, 6).map((tx) => (
                <div key={tx.id} className="p-4 flex items-center justify-between">
                   <div className="flex items-center space-x-3">
                      <div className={cn(
                        "size-10 rounded-xl flex items-center justify-center",
                        tx.type === "in" ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
                      )}>
                        {tx.type === "in" ? <ArrowDownRight size={18} /> : <ArrowUpRight size={18} />}
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-800">{tx.productName}</p>
                        <p className="text-[9px] text-slate-400 uppercase font-black">{tx.type === 'sale' ? 'Venta' : tx.type === 'in' ? 'Entrada' : 'Salida'}</p>
                      </div>
                   </div>
                   <p className="text-xs font-black text-slate-700">{tx.quantity} uds</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const topStats = isAdmin ? [
    { label: "Ventas Totales", value: formatCurrency(chartData.reduce((a, b) => a + b.sales, 0)), icon: ShoppingCart, color: "bg-indigo-600", trend: "+12.4%", up: true },
    { label: "Forecast (7d)", value: formatCurrency(forecastSales7Days), icon: Sparkles, color: "bg-fuchsia-600", trend: "Proyección IA", up: true },
    { label: "Utilidad Neta", value: formatCurrency(stats.totalProfit - stats.totalExpenses), icon: TrendingUp, color: "bg-emerald-500", trend: "+8.2%", up: true },
    { label: "Riesgo Fuga", value: churnRiskStats.highRisk, icon: AlertTriangle, color: "bg-rose-500", trend: "Crítico", up: false },
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
          <div className="flex items-center space-x-2 bg-slate-50 border border-slate-100 px-4 py-3 rounded-2xl">
            <div className={cn("size-2 rounded-full", "bg-emerald-500 animate-pulse")} />
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none">
              Nube Sincronizada
            </span>
          </div>
          {isAdmin && (
            <button type="button" 
              onClick={handlePrintZReport}
              className="flex items-center space-x-2 bg-white border border-slate-200 px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-600 hover:bg-slate-50 transition-all shadow-sm"
            >
              <FileText size={18} />
              <span>Cierre Z</span>
            </button>
          )}
          <div className="flex items-center space-x-2 bg-indigo-50 border border-indigo-100 px-4 py-3 rounded-2xl">
            <div className="size-2 bg-indigo-600 rounded-full animate-pulse" />
            <span className="text-xs font-black text-indigo-700 uppercase tracking-widest">
              {isAdmin ? "Admin" : "Vendedor"} Activo
            </span>
          </div>
        </div>
      </div>

      {/* Sub-Navigation Tabs */}
      <div className="bg-slate-100 p-1.5 rounded-[1.8rem] flex items-center overflow-x-auto gap-1 border border-slate-200/80 scrollbar-none shadow-inner no-scrollbar">
        <button type="button"
          onClick={() => setActiveDashboardTab("overview")}
          className={cn(
            "flex items-center justify-center gap-2 py-3.5 px-6 rounded-2xl text-[10px] sm:text-xs font-black uppercase tracking-wider shrink-0 transition-all duration-300 active:scale-[0.97]",
            activeDashboardTab === "overview"
              ? "bg-white text-indigo-600 shadow-sm border border-slate-200/40"
              : "text-slate-500 hover:text-slate-800 hover:bg-white/50"
          )}
        >
          <Activity size={16} />
          <span>Resumen</span>
        </button>
        <button type="button"
          onClick={() => setActiveDashboardTab("charts")}
          className={cn(
            "flex items-center justify-center gap-2 py-3.5 px-6 rounded-2xl text-[10px] sm:text-xs font-black uppercase tracking-wider shrink-0 transition-all duration-300 active:scale-[0.97]",
            activeDashboardTab === "charts"
              ? "bg-white text-indigo-600 shadow-sm border border-slate-200/40"
              : "text-slate-500 hover:text-slate-800 hover:bg-white/50"
          )}
        >
          <BarChart3 size={16} />
          <span>Análisis Visual</span>
        </button>
        {(profile?.role === "owner" || profile?.role === "admin") && (
          <button type="button"
            onClick={() => setActiveDashboardTab("finances")}
            className={cn(
              "flex items-center justify-center gap-2 py-3.5 px-6 rounded-2xl text-[10px] sm:text-xs font-black uppercase tracking-wider shrink-0 transition-all duration-300 active:scale-[0.97]",
              activeDashboardTab === "finances"
                ? "bg-white text-indigo-600 shadow-sm border border-slate-200/40"
                : "text-slate-500 hover:text-slate-800 hover:bg-white/50"
          )}
        >
          <DollarSign size={16} />
          <span>Mando Directivo</span>
        </button>
        )}
        <button type="button"
          onClick={() => setActiveDashboardTab("sales")}
          className={cn(
            "flex items-center justify-center gap-2 py-3.5 px-6 rounded-2xl text-[10px] sm:text-xs font-black uppercase tracking-wider shrink-0 transition-all duration-300 active:scale-[0.97]",
            activeDashboardTab === "sales"
              ? "bg-white text-indigo-600 shadow-sm border border-slate-200/40"
              : "text-slate-500 hover:text-slate-800 hover:bg-white/50"
          )}
        >
          <ShoppingCart size={16} />
          <span>Ventas y Actividad</span>
        </button>
        <button type="button"
          onClick={() => setActiveDashboardTab("inventory")}
          className={cn(
            "flex items-center justify-center gap-2 py-3.5 px-6 rounded-2xl text-[10px] sm:text-xs font-black uppercase tracking-wider shrink-0 transition-all duration-300 active:scale-[0.97]",
            activeDashboardTab === "inventory"
              ? "bg-white text-indigo-600 shadow-sm border border-slate-200/40"
              : "text-slate-500 hover:text-slate-800 hover:bg-white/50"
          )}
        >
          <Box size={16} />
          <span>Salud de Stock</span>
        </button>
      </div>

      {/* Tab Contents */}
      {activeDashboardTab === "overview" && (
        <div className="space-y-10">
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
                <button type="button" 
                  onClick={handleFetchAI}
                  className="bg-white text-indigo-600 px-10 py-5 rounded-[2rem] font-black uppercase tracking-widest text-xs hover:bg-indigo-50 transition-all flex items-center space-x-3 shadow-xl hover:scale-105 active:scale-95 group"
                >
                  <RefreshCw size={20} className="group-hover:rotate-180 transition-transform duration-500" />
                  <span>Consultar a la IA</span>
                </button>
              </div>
              <div className="absolute top-0 right-0 size-80 bg-white/10 blur-[100px] rounded-full -mr-40 -mt-40" />
              <div className="absolute bottom-0 left-0 size-64 bg-indigo-500/30 blur-[80px] rounded-full -ml-32 -mb-32" />
            </motion.div>
          )}

          {/* Apps & Channels Section */}
          <div className="bg-indigo-50 border border-indigo-100 p-8 rounded-[3rem] flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="flex items-center space-x-6">
              <div className="size-16 bg-white rounded-[1.5rem] flex items-center justify-center text-indigo-600 shadow-sm border border-indigo-100">
                <Smartphone size={32} />
              </div>
              <div>
                <h2 className="text-xl font-black text-slate-800 tracking-tight">App Móvil de Clientes</h2>
                <p className="text-sm font-medium text-slate-500 max-w-md">
                  Tus clientes pueden ver sus puntos, historial y ofertas exclusivas desde su propio celular. Comparte el link o imprime el QR en tus comprobantes.
                </p>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
              <a 
                href="/cliente" 
                target="_blank" 
                className="w-full sm:w-auto bg-white text-slate-900 font-black px-8 py-4 rounded-2xl shadow-sm border border-slate-200 hover:bg-slate-50 transition-all flex items-center justify-center space-x-2 text-xs uppercase tracking-widest"
              >
                <Activity size={16} />
                <span>Ver Portal Cliente</span>
              </a>
              <button type="button" 
                onClick={() => {
                  const url = window.location.origin + "/cliente";
                  navigator.clipboard.writeText(url);
                  alert("Link del Portal de Clientes copiado: " + url);
                }}
                className="w-full sm:w-auto bg-indigo-600 text-white font-black px-8 py-4 rounded-2xl shadow-xl shadow-indigo-100 hover:bg-indigo-500 transition-all flex items-center justify-center space-x-2 text-xs uppercase tracking-widest"
              >
                <Plus size={16} />
                <span>Copiar Link</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {activeDashboardTab === "charts" && (
        <div className="space-y-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Sales Chart Area - Restricted to Admin or simplified for Seller */}
            <div className={cn(isAdmin ? "lg:col-span-8" : "lg:col-span-12")}>
              <div className="bg-white p-4 sm:p-8 rounded-[2rem] sm:rounded-[2.5rem] border border-slate-100 shadow-sm h-full">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
                  <div className="flex items-center space-x-3">
                    <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl shrink-0">
                      {isAdmin ? <BarChart3 size={20} /> : <Zap size={20} />}
                    </div>
                    <div>
                      <h2 className="text-lg sm:text-xl font-black text-slate-800 tracking-tight">
                        {isAdmin ? "Rendimiento de Ventas" : "Resumen de Actividad"}
                      </h2>
                      <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mt-1">Últimos 7 días</p>
                    </div>
                  </div>
                  <div className="text-left sm:text-right">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                      {isAdmin ? "Ventas vs Utilidad" : "Tendencia de Ventas"}
                    </p>
                    <div className="flex items-center space-x-4">
                        <div className="flex items-center space-x-1.5"><div className="size-2 rounded-full bg-indigo-600" /> <span className="text-[10px] font-bold text-slate-500 uppercase">Ventas</span></div>
                        {isAdmin && (
                          <div className="flex items-center space-x-1.5"><div className="size-2 rounded-full bg-emerald-500" /> <span className="text-[10px] font-bold text-slate-500 uppercase">Utilidad</span></div>
                        )}
                    </div>
                  </div>
                </div>
                
                <div className="h-[300px] w-full relative overflow-hidden" style={{ minHeight: '300px' }}>
                  <React.Suspense fallback={<div className="h-[300px] w-full flex items-center justify-center text-slate-400">Cargando gráfico de ventas...</div>}>
                    <DashboardAreaChart chartData={chartData} isAdmin={isAdmin} isMounted={isMounted} />
                  </React.Suspense>
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
                  
                  <div className="h-[250px] relative w-full overflow-hidden" style={{ minHeight: '250px' }}>
                    {isMounted && expenseChartData.length > 0 ? (
                      <React.Suspense fallback={<div className="h-[250px] w-full flex items-center justify-center text-slate-400">Cargando gráfico de gastos...</div>}>
                        <DashboardPieChart expenseChartData={expenseChartData} isMounted={isMounted} />
                      </React.Suspense>
                    ) : (
                      <div className="absolute inset-0 flex flex-col items-center justify-center text-center space-y-3">
                         <div className="size-16 bg-slate-50 rounded-full flex items-center justify-center text-slate-200">
                           <CreditCard size={32} />
                         </div>
                         <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Sin gastos registrados</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Curva de Tendencia Ventas vs Gastos - Semanal */}
          <div className="bg-slate-900 text-white rounded-[2.5rem] border border-slate-800 p-8 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 size-84 bg-indigo-500/5 blur-[100px] rounded-full pointer-events-none" />
            <div className="relative z-10">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6">
                <div>
                  <h4 className="text-sm font-black uppercase text-slate-300">Tendencia de Rentabilidad Semanal</h4>
                  <p className="text-[10px] text-slate-500 font-bold uppercase">Comparativa de ingresos vs gastos operacionales</p>
                </div>
                <div className="flex items-center space-x-4">
                  <span className="flex items-center text-[10px] font-black uppercase text-indigo-400">
                    <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 mr-1.5" /> Ventas
                  </span>
                  <span className="flex items-center text-[10px] font-black uppercase text-rose-400">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500 mr-1.5" /> Gastos
                  </span>
                </div>
              </div>
              <React.Suspense fallback={<div className="h-[240px] w-full flex items-center justify-center text-slate-500">Iniciando gráficos de tendencia...</div>}>
                <ExecutiveTrendChart data={executiveTrendData} isMounted={isMounted} />
              </React.Suspense>
            </div>
          </div>
        </div>
      )}

      {activeDashboardTab === "finances" && (profile?.role === "owner" || profile?.role === "admin") && (
        <div className="space-y-10">
          {/* Executive Cockpit for Owners and Admins */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-slate-900 text-white rounded-[3rem] p-8 border border-slate-800 shadow-2xl relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 size-96 bg-indigo-500/10 blur-[120px] rounded-full pointer-events-none" />
            <div className="relative z-10">
              <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-800 pb-6 mb-6 gap-4">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-widest bg-indigo-50/20 text-indigo-300 px-3 py-1 rounded-full border border-indigo-500/30">
                    Mando Directivo y Administrativo
                  </span>
                  <h2 className="text-2xl font-black tracking-tight mt-1">Executive Cockpit ("Mando Corporativo")</h2>
                </div>
                <div className="flex items-center space-x-3">
                  <span className="text-xs font-black uppercase py-2 px-3 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-full">
                    Rentabilidad Máxima
                  </span>
                  <button type="button" 
                    onClick={handlePrintZReport}
                    className="flex items-center space-x-2 bg-white/10 hover:bg-white/20 border border-white/10 px-5 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest text-white transition-all shadow-sm shrink-0"
                  >
                    <FileText size={16} />
                    <span>Imprimir Reporte Z</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Margen de Ganancia Neto */}
                <div className="bg-slate-800/40 border border-slate-800 p-6 rounded-2xl">
                  <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Margen de Ganancia Neto</p>
                  <div className="flex items-baseline space-x-2">
                    <h3 className="text-2xl font-black text-emerald-400">
                      {formatCurrency(executiveStats.netProfit)}
                    </h3>
                    <span className="text-[10px] font-bold text-slate-400">Neto real</span>
                  </div>
                  <div className="mt-4">
                    <div className="flex justify-between text-[10px] font-black uppercase tracking-tight text-slate-400 mb-1">
                      <span>Rentabilidad</span>
                      <span>{stats.totalProfit > 0 ? Math.round((executiveStats.netProfit / stats.totalProfit) * 100) : 0}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-700 rounded-full overflow-hidden">
                      <div 
                        className="bg-emerald-400 h-full transition-all duration-1000" 
                        style={{ width: `${Math.max(0, Math.min(100, stats.totalProfit > 0 ? (executiveStats.netProfit / stats.totalProfit) * 100 : 0))}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Proyección de Gastos Mensuales */}
                <div className="bg-slate-800/40 border border-slate-800 p-6 rounded-2xl">
                  <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Proyección de Gastos Mensuales</p>
                  <div className="flex items-baseline space-x-2">
                    <h3 className="text-2xl font-black text-amber-400">
                      {formatCurrency(executiveStats.projectedExpenses)}
                    </h3>
                    <span className="text-[10px] font-bold text-slate-400">Estimado 30d</span>
                  </div>
                  <div className="mt-4">
                    <div className="flex justify-between text-[10px] font-black uppercase tracking-tight text-slate-400 mb-1">
                      <span>Desviación Presupuestaria</span>
                      <span>+15% oper</span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-700 rounded-full overflow-hidden">
                      <div className="bg-amber-400 h-full" style={{ width: "85%" }} />
                    </div>
                  </div>
                </div>

                {/* Costo Total del Stock Inmovilizado */}
                <div className="bg-slate-800/40 border border-slate-800 p-6 rounded-2xl">
                  <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Costo de Stock Inmovilizado</p>
                  <div className="flex items-baseline space-x-2">
                    <h3 className="text-2xl font-black text-rose-400">
                      {formatCurrency(executiveStats.inactiveStockCost)}
                    </h3>
                    <span className="text-[10px] font-bold text-slate-400">Inactivo 30d</span>
                  </div>
                  <div className="mt-4">
                    <div className="flex justify-between text-[10px] font-black uppercase tracking-tight text-slate-400 mb-1">
                      <span>Valuación Total Activos</span>
                      <span>{formatCurrency(executiveStats.totalStockCost)}</span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-700 rounded-full overflow-hidden">
                      <div 
                        className="bg-rose-400 h-full transition-all duration-1000" 
                        style={{ width: `${Math.max(0, Math.min(100, executiveStats.totalStockCost > 0 ? (executiveStats.inactiveStockCost / executiveStats.totalStockCost) * 100 : 0))}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Curva de Tendencia Ventas vs Gastos */}
              <div className="mt-8 bg-slate-800/20 border border-slate-800/80 p-6 rounded-3xl">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
                  <div>
                    <h4 className="text-sm font-black uppercase text-slate-300">Tendencia de Rentabilidad Semanal</h4>
                    <p className="text-[10px] text-slate-500 font-bold uppercase">Comparativa de ingresos vs gastos operacionales</p>
                  </div>
                  <div className="flex items-center space-x-4">
                    <span className="flex items-center text-[10px] font-black uppercase text-indigo-400">
                      <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 mr-1.5" /> Ventas
                    </span>
                    <span className="flex items-center text-[10px] font-black uppercase text-rose-400">
                      <span className="w-2.5 h-2.5 rounded-full bg-rose-500 mr-1.5" /> Gastos
                    </span>
                  </div>
                </div>
                <React.Suspense fallback={<div className="h-[210px] w-full flex items-center justify-center text-slate-500">Iniciando gráficos de tendencia...</div>}>
                  <ExecutiveTrendChart data={executiveTrendData} isMounted={isMounted} />
                </React.Suspense>
              </div>

              <p className="text-slate-400 text-xs font-medium mt-6 leading-relaxed">
                💡 **Análisis de Cartera**: Tienes un <span className="font-bold text-rose-300">{executiveStats.totalStockCost > 0 ? Math.round((executiveStats.inactiveStockCost / executiveStats.totalStockCost) * 100) : 0}%</span> de tu capital invertido en inventario inmovilizado. Se aconseja utilizar el módulo de **Optimización Inteligente de IA** para liquidar o programar reabastecimiento estratégico.
              </p>
            </div>
          </motion.div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Clientes VIP */}
            <div className="space-y-6">
              <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest ml-1">Mayores Compradores</h3>
              <div className="bg-white rounded-[2rem] border border-slate-100 p-6 space-y-4">
                {topCustomers.slice(0, 4).map((cust, i) => (
                  <div key={cust.id || i} className="bg-slate-50/50 p-4 rounded-2xl flex items-center justify-between border border-slate-100 transition-all hover:bg-slate-50 gap-2">
                    <div className="flex items-center space-x-3 min-w-0">
                      <div className="size-10 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600 font-extrabold text-xs shrink-0">
                        {cust.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-bold text-slate-800 text-xs truncate">{cust.name}</h4>
                        <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">{cust.visits} compras</p>
                      </div>
                    </div>
                    <p className="font-black text-emerald-600 text-xs shrink-0">{formatCurrency(cust.total)}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* High Margin Analysis */}
            <div className="space-y-6">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Productos de Alta Rentabilidad</h3>
              <div className="bg-white rounded-[2rem] border border-slate-100 p-6 space-y-4">
                {allProducts.sort((a, b) => (Number(b.price) - Number(b.costPrice)) - (Number(a.price) - Number(a.costPrice))).slice(0, 4).map((p) => (
                  <div key={p.id} className="bg-emerald-50/20 p-4 rounded-2xl border border-emerald-100 flex items-center justify-between gap-1.5">
                    <div>
                      <p className="text-[11px] font-black text-slate-800">{p.name}</p>
                      <p className="text-[9px] font-bold text-emerald-600 uppercase mt-0.5">
                        +{Math.round(((Number(p.price) - Number(p.costPrice)) / Number(p.price)) * 100) || 0}% margen
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-[8px] font-bold text-slate-400 uppercase">Utilidad unitaria</p>
                      <p className="text-xs font-black text-emerald-600">{formatCurrency(p.price - p.costPrice)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeDashboardTab === "sales" && (
        <div className="space-y-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Recent activity logs */}
            <div className="lg:col-span-8 space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="p-3 bg-slate-900 rounded-2xl text-white">
                    <Activity size={20} />
                  </div>
                  <h2 className="text-xl font-black text-slate-800 tracking-tight">
                    {isAdmin ? "Actividad Reciente del Sistema" : "Mis Ventas Recientes"}
                  </h2>
                </div>
                <button type="button" 
                  onClick={() => onNavigate?.("transactions")}
                  className="text-xs font-black text-indigo-600 uppercase tracking-widest hover:text-indigo-400 transition-colors"
                >
                  {isAdmin ? "Ver Todo el Registro" : "Ver Mi Historial"}
                </button>
              </div>

              <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden p-1.5">
                <div className="divide-y divide-slate-50">
                  {recentTransactions.map((tx, i) => (
                    <motion.div 
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05 }}
                      key={tx.id} 
                      className="flex items-center justify-between p-4 sm:p-5 hover:bg-slate-50/80 transition-all rounded-2xl group gap-3"
                    >
                      <div className="flex items-center space-x-3 sm:space-x-4 min-w-0 flex-1">
                        <div className={cn(
                          "size-10 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110 shrink-0",
                          tx.type === "sale" || tx.type === "out" ? "bg-rose-50 text-rose-600" : "bg-emerald-50 text-emerald-600"
                        )}>
                          {tx.type === "sale" ? <ShoppingCart size={20} /> : 
                           tx.type === "in" ? <ArrowDownRight size={20} /> : <ArrowUpRight size={20} />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-slate-800 text-xs sm:text-sm truncate">{tx.productName}</p>
                          <div className="flex items-center space-x-2 mt-1 min-w-0">
                            <Clock size={10} className="text-slate-400 shrink-0" />
                            <div className="text-[9px] text-slate-400 font-bold uppercase tracking-wide flex items-center gap-1 truncate">
                              <span>{tx.timestamp?.toDate ? tx.timestamp.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "Reciente"}</span>
                              <span>•</span>
                              <span className="truncate max-w-[124px]">{tx.customerName || "Venta General"}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className={cn(
                          "font-black text-xs sm:text-sm",
                          tx.type === "sale" || tx.type === "out" ? "text-rose-600" : "text-emerald-600"
                        )}>
                          {tx.type === "sale" || tx.type === "out" ? "-" : "+"}{tx.quantity}
                        </p>
                        <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wide mt-0.5 max-w-[110px] truncate" title={tx.userName}>
                          {tx.userName || "Sistema"}
                        </p>
                      </div>
                    </motion.div>
                  ))}
                  {recentTransactions.length === 0 && (
                    <div className="p-16 text-center text-slate-400 font-bold uppercase tracking-widest text-xs">
                      Sin actividad registrada
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Side column: VIP + Trending */}
            <div className="lg:col-span-4 space-y-10">
              {/* Clientes VIP */}
              {isAdmin && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Compradores Estrella</h3>
                    <span className="text-[8px] bg-emerald-50 text-emerald-600 py-0.5 px-2.5 rounded-full font-black uppercase">Cliente VIP</span>
                  </div>
                  <div className="bg-white rounded-[2rem] border border-slate-100 p-6 space-y-4">
                    {topCustomers.slice(0, 3).map((cust, i) => (
                      <div key={cust.id || i} className="flex items-center justify-between gap-1.5">
                        <div className="flex items-center space-x-3 min-w-0">
                          <div className="size-8 rounded-lg bg-emerald-50 text-emerald-600 font-bold text-xs flex items-center justify-center shrink-0">
                            {cust.name[0]?.toUpperCase()}
                          </div>
                          <span className="text-xs font-bold text-slate-800 truncate">{cust.name}</span>
                        </div>
                        <span className="text-xs font-black text-emerald-600">{formatCurrency(cust.total)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Trending Products */}
              <div className="space-y-4">
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Los Más Vendidos</h3>
                <div className="bg-white rounded-[2rem] border border-slate-100 p-6 space-y-4">
                  {topProducts.map((p, idx) => (
                    <div key={p.name} className="flex items-center justify-between gap-1.5">
                      <div className="flex items-center space-x-3 min-w-0">
                        <span className="text-xs font-black text-slate-200">0{idx + 1}</span>
                        <p className="text-xs font-bold text-slate-800 truncate">{p.name}</p>
                      </div>
                      <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-lg shrink-0">
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
        </div>
      )}

      {activeDashboardTab === "inventory" && (
        <div className="space-y-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Left side column: Support ticket, inventory health bar */}
            <div className="lg:col-span-6 space-y-10">
              {/* Soporte y Reclamos */}
              <div className="space-y-4">
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Auditoría de Reclamos y Soporte</h3>
                <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm space-y-4">
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="p-3 bg-rose-50 rounded-2xl">
                      <p className="text-[8px] font-black text-slate-400 uppercase tracking-tight">Pendientes</p>
                      <p className="text-xl font-black text-rose-500 mt-1">{claimsStats.pendingCount}</p>
                    </div>
                    <div className="p-3 bg-emerald-50 rounded-2xl">
                      <p className="text-[8px] font-black text-slate-400 uppercase tracking-tight">Resueltos (30d)</p>
                      <p className="text-xl font-black text-emerald-600 mt-1">{claimsStats.resolvedLastMonth}</p>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-2xl">
                      <p className="text-[8px] font-black text-slate-400 uppercase tracking-tight">Diag. Promedio</p>
                      <p className="text-xl font-black text-slate-700 mt-1">{claimsStats.avgResolutionTimeText}</p>
                    </div>
                  </div>

                  {/* Claims visual list with toggle tabs */}
                  <div className="border-t border-slate-100 pt-4 mt-2">
                    <div className="flex items-center justify-between mb-3 bg-slate-50 p-1 rounded-xl">
                      <button type="button"
                        onClick={() => setClaimFilter("pending")}
                        className={cn(
                          "flex-1 py-1.5 text-[9px] font-black uppercase tracking-wider rounded-lg transition-all",
                          claimFilter === "pending"
                            ? "bg-white text-slate-800 shadow-sm"
                            : "text-slate-400 hover:text-slate-600"
                        )}
                      >
                        Pendientes ({pendingClaimsList.length})
                      </button>
                      <button type="button"
                        onClick={() => setClaimFilter("resolved")}
                        className={cn(
                          "flex-1 py-1.5 text-[9px] font-black uppercase tracking-wider rounded-lg transition-all",
                          claimFilter === "resolved"
                            ? "bg-white text-emerald-700 shadow-sm"
                            : "text-slate-400 hover:text-slate-600"
                        )}
                      >
                        Historial Resueltos
                      </button>
                    </div>

                    <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                      {(claimFilter === "pending" 
                        ? pendingClaimsList 
                        : recentClaimsList.filter(c => c.status === "resolved")
                      ).map((claim) => (
                        <div
                          key={claim.id}
                          className="p-3 bg-slate-50 border border-slate-100 rounded-xl hover:border-indigo-100 transition-all flex items-center justify-between gap-2"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center space-x-2">
                              <span className={cn(
                                "text-[7px] font-black uppercase px-1.5 py-0.2 rounded-full",
                                claim.reason === "damaged"
                                  ? "bg-rose-100 text-rose-700"
                                  : claim.reason === "incorrect"
                                  ? "bg-amber-100 text-amber-700"
                                  : "bg-slate-200 text-slate-700"
                              )}>
                                {claim.reason === "damaged" ? "Dañado/Mermado" : claim.reason === "incorrect" ? "Incorrecto" : "Faltante"}
                              </span>
                              <span className="text-[9px] text-slate-400 font-bold">RUT: {claim.customerRUT || "Sin RUT"}</span>
                            </div>
                            <p className="text-[11px] font-black text-slate-700 mt-1 truncate">{claim.customerName}</p>
                            <p className="text-[9px] text-slate-400 truncate">Pedido: {claim.orderId || "S/I"}</p>
                          </div>
                          
                          <button type="button"
                            onClick={() => {
                              setSelectedClaim(claim);
                              setResolutionNote(claim.resolutionNote || "");
                            }}
                            className={cn(
                              "px-3 py-1.5 text-[8px] font-black uppercase tracking-wider rounded-lg transition-all shrink-0",
                              claim.status === "resolved"
                                ? "bg-emerald-50 text-emerald-750 hover:bg-emerald-100"
                                : "bg-indigo-650 text-white hover:bg-indigo-700"
                            )}
                          >
                            {claim.status === "resolved" ? "Ver Detalle" : "Resolver"}
                          </button>
                        </div>
                      ))}

                      {((claimFilter === "pending" 
                        ? pendingClaimsList 
                        : recentClaimsList.filter(c => c.status === "resolved")
                      ).length === 0) && (
                        <p className="text-center py-6 text-[10px] text-slate-400 font-bold uppercase tracking-widest bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                          No hay casos {claimFilter === "pending" ? "pendientes" : "resueltos"}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Salud del Inventario */}
              <div className="space-y-4">
                <div className="flex items-center justify-between px-1">
                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest leading-none">Salud del Inventario</h3>
                  <span className="text-[10px] font-black text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-lg">
                    {Math.round(((stats.totalProducts - stats.lowStockCount) / stats.totalProducts) * 100) || 0}% Óptimo
                  </span>
                </div>
                <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm space-y-4">
                  <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden flex">
                    <div className="bg-emerald-500 h-full transition-all duration-1000" style={{ width: `${((stats.totalProducts - stats.lowStockCount) / stats.totalProducts) * 100}%` }} />
                    <div className="bg-amber-400 h-full transition-all duration-1000" style={{ width: `${(stats.lowStockCount / stats.totalProducts) * 100}%` }} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                       <p className="text-[9px] font-black text-slate-400 uppercase tracking-tight mb-1">Items en buen nivel</p>
                       <p className="text-2xl font-black text-emerald-600">{stats.totalProducts - stats.lowStockCount} SKU</p>
                    </div>
                    <div>
                       <p className="text-[9px] font-black text-slate-400 uppercase tracking-tight mb-1">Items en quiebre crítico</p>
                       <p className="text-2xl font-black text-amber-500">{stats.lowStockCount} SKU</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right side column: Predictive alerts, restocking button */}
            <div className="lg:col-span-6 space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="p-3 bg-amber-500 rounded-2xl text-white shadow-lg shadow-amber-100">
                    <AlertTriangle size={20} />
                  </div>
                  <h2 className="text-xl font-black text-slate-800 tracking-tight">Stock Inteligente</h2>
                </div>
                <span className="text-[9px] font-black bg-amber-50 text-amber-600 px-2 py-1 rounded-lg uppercase">Predicción de Demanda</span>
              </div>

              <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm p-6 space-y-4">
                {predictiveStockAlerts.map((product) => (
                  <div key={product.id} className="p-4 bg-slate-50 rounded-2xl flex items-center justify-between border border-transparent hover:border-amber-200 transition-all group gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-black text-slate-800 leading-tight truncate">{product.name}</p>
                      <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-1">
                        Stock: {product.stock} u. | ~{Math.round(product.velocity * 7)} vtas/sem
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={cn(
                        "text-[10px] font-black uppercase tracking-tighter",
                        product.daysRemaining < 5 ? "text-rose-600 animate-pulse" : "text-amber-500"
                      )}>
                        {product.daysRemaining < 30 ? `Agotado en ~${product.daysRemaining}d` : "Nivel Crítico"}
                      </p>
                    </div>
                  </div>
                ))}
                {predictiveStockAlerts.length === 0 && (
                  <div className="text-center py-10">
                    <div className="size-16 bg-emerald-55 rounded-full flex items-center justify-center text-emerald-500 mx-auto mb-4">
                      <TrendingUp size={32} />
                    </div>
                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Nivel de stock óptimo en toda la tienda</p>
                  </div>
                )}
                <button type="button" 
                  onClick={() => onNavigate?.("inventory")}
                  className="w-full py-4.5 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] transition-all shadow-xl shadow-slate-200 flex items-center justify-center gap-2"
                >
                  <Plus size={16} />
                  <span>Abastecer Inventario / Crear Orden</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
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
                <button type="button" onClick={() => setIsAIModalOpen(false)} className="p-2 hover:bg-white/10 rounded-xl transition-all">
                  <X size={24} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-10 space-y-10">
                {isAILoading ? (
                  <div className="flex flex-col items-center justify-center py-20 space-y-6">
                    <div className="relative">
                      <div className="size-20 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin" />
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
                                  {rec.action === "RESTOCK" ? "REABASTECER" :
                                   rec.action === "DISCOUNT" ? "DESCUENTO / LIQUIDAR" :
                                   rec.action === "MONITOR" ? "MONITOREAR" : rec.action}
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
                <button type="button" 
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

      {/* Support Ticket Resolution Modal */}
      <AnimatePresence>
        {selectedClaim && (
          <div className="fixed inset-0 z-50 overflow-y-auto flex items-start justify-center p-2 sm:p-4 md:p-10">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedClaim(null)}
              className="fixed inset-0 bg-slate-900/70 backdrop-blur-md"
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="relative bg-white w-full max-w-xl rounded-3xl md:rounded-[2.5rem] shadow-2xl overflow-hidden my-auto flex flex-col border border-slate-100 z-10"
            >
              <div className="p-4 sm:p-6 overflow-y-auto space-y-4 max-h-[85vh]">
                <div className="flex justify-between items-start">
                  <div>
                    <span className={cn(
                      "text-[9px] font-black uppercase px-2 py-0.5 rounded-full inline-block mb-1",
                      selectedClaim.reason === "damaged"
                        ? "bg-rose-100 text-rose-700"
                        : selectedClaim.reason === "incorrect"
                        ? "bg-amber-100 text-amber-700"
                        : "bg-slate-200 text-slate-700"
                    )}>
                      {selectedClaim.reason === "damaged" ? "Dañado/Mermado" : selectedClaim.reason === "incorrect" ? "Incorrecto" : "Faltante en Entrega"}
                    </span>
                    <h3 className="text-xl font-black text-slate-800 tracking-tight">Resolución de Reclamo</h3>
                  </div>
                  <button type="button" 
                    onClick={() => setSelectedClaim(null)}
                    className="p-2 hover:bg-slate-100 rounded-full transition-all text-slate-400 hover:text-slate-600 font-bold"
                  >
                    ✕
                  </button>
                </div>

                <div className="bg-slate-50 p-4 rounded-2xl space-y-2 text-xs">
                  <div className="grid grid-cols-2 gap-2">
                    <p className="text-slate-400 font-bold uppercase">Cliente:</p>
                    <p className="text-slate-800 font-black text-right">{selectedClaim.customerName}</p>
                    
                    <p className="text-slate-400 font-bold uppercase">RUT Cliente:</p>
                    <p className="text-slate-800 font-mono text-right">{selectedClaim.customerRUT || "S/R"}</p>
                    
                    <p className="text-slate-400 font-bold uppercase">ID del Pedido:</p>
                    <p className="text-slate-800 font-mono text-right truncate">{selectedClaim.orderId || "S/I"}</p>

                    <p className="text-slate-400 font-bold uppercase">Fecha reporte:</p>
                    <p className="text-slate-800 font-bold text-right">
                      {selectedClaim.timestamp?.toDate ? selectedClaim.timestamp.toDate().toLocaleString() : new Date(selectedClaim.timestamp).toLocaleString()}
                    </p>
                  </div>
                  <div className="border-t border-slate-200/60 pt-2 mt-2">
                    <p className="text-slate-400 font-bold uppercase mb-1">Descripción del Cliente:</p>
                    <p className="p-3 bg-white border border-slate-100 rounded-xl text-slate-700 italic leading-relaxed">
                      "{selectedClaim.description}"
                    </p>
                  </div>

                  {selectedClaim.photo && (
                    <div className="border-t border-slate-200/60 pt-2 mt-2">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-slate-400 font-bold uppercase">Evidencia visual / Foto:</p>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => setIsImageZoomed(true)}
                            className="text-[10px] font-black text-indigo-600 hover:text-indigo-800 uppercase tracking-wider"
                          >
                            🔍 Ampliar
                          </button>
                          <span className="text-slate-300">|</span>
                          <a
                            href={selectedClaim.photo}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[10px] font-black text-indigo-600 hover:text-indigo-800 uppercase tracking-wider"
                          >
                            Abrir nueva pestaña ↗
                          </a>
                        </div>
                      </div>
                      <div 
                        onClick={() => setIsImageZoomed(true)}
                        className="group relative rounded-xl overflow-hidden border border-slate-200 max-h-48 flex justify-center bg-slate-200 cursor-pointer hover:border-indigo-400 transition-all"
                        title="Haga clic para expandir en pantalla completa"
                      >
                        <img 
                          src={selectedClaim.photo} 
                          alt="Evidencia" 
                          referrerPolicy="no-referrer"
                          className="object-contain max-h-48 w-full group-hover:scale-105 transition-all duration-300"
                        />
                        <div className="absolute inset-0 bg-slate-900/30 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center">
                          <span className="bg-white/90 text-slate-950 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg flex items-center gap-1">
                            <span>🔍 VER PANTALLA COMPLETA</span>
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block ml-1">Nota de Resolución de Soporte</label>
                  <textarea
                    rows={4}
                    value={resolutionNote}
                    onChange={(e) => setResolutionNote(e.target.value)}
                    placeholder="Escriba el diagnóstico del soporte, compensación aplicada (ej: reembolso, cupón, nota de crédito) y notas internas…"
                    className="w-full text-xs p-4 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-600 focus:outline-none transition-all resize-none bg-slate-50 text-slate-800"
                    disabled={selectedClaim.status === "resolved"}
                  />
                </div>

                {selectedClaim.status !== "resolved" ? (
                  <button type="button"
                    onClick={async () => {
                      if (!resolutionNote.trim()) {
                        alert("Por favor, ingrese una nota de resolución antes de continuar.");
                        return;
                      }
                      setIsResolvingClaim(true);
                      try {
                        const claimRef = doc(db, "claims", selectedClaim.id);
                        await updateDoc(claimRef, {
                          status: "resolved",
                          resolutionNote: resolutionNote,
                          resolvedAt: serverTimestamp(),
                          operatorEmail: user?.email || "cajero@stockflow.com",
                          operatorUid: user?.uid || "sys"
                        });

                        // Create actual resolution notification for the customer in real time
                        await addDoc(collection(db, "notifications"), {
                          title: "Reclamo Resuelto",
                          message: `Tu reclamo del pedido #${selectedClaim.orderId || "interno"} fue resuelto: "${resolutionNote}"`,
                          type: "success",
                          userId: selectedClaim.customerId || "customer",
                          read: false,
                          timestamp: serverTimestamp()
                        });
                        
                        // Fire secure audit logging to Express backend
                        try {
                          const token = await user?.getIdToken();
                          await fetch("/api/audit/log", {
                            method: "POST",
                            headers: {
                              "Content-Type": "application/json",
                              "Authorization": `Bearer ${token || "sys-operator"}`
                            },
                            body: JSON.stringify({
                              action: `CLAIM_RESOLVED`,
                              targetId: selectedClaim.id,
                              details: {
                                reason: selectedClaim.reason,
                                customerRUT: selectedClaim.customerRUT || "S/R",
                                resolutionNote: resolutionNote
                              }
                            })
                          });
                        } catch (ae) {
                          console.warn("Audit log post failed:", ae);
                        }

                        // Close dialog, reload active lists
                        setSelectedClaim(null);
                        setResolutionNote("");
                        await loadClaims();
                      } catch (err: any) {
                        console.error("Fail to resolve support ticket:", err);
                        alert(`Fallo al actualizar estado del ticket de soporte: ${err.message}`);
                      } finally {
                        setIsResolvingClaim(false);
                      }
                    }}
                    disabled={isResolvingClaim}
                    className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black uppercase tracking-widest text-xs transition-all shadow-xl shadow-emerald-100 flex items-center justify-center gap-2"
                  >
                    {isResolvingClaim ? "Procesando resolución…" : "Marcar como Resuelto & Notificar Cliente"}
                  </button>
                ) : (
                  <div className="p-3 bg-emerald-50 rounded-2xl border border-emerald-100 text-center">
                    <p className="text-[10px] font-black uppercase tracking-wider text-emerald-800">
                      Caso Resuelto
                    </p>
                    <p className="text-[9px] text-emerald-600 font-medium">
                      Este ticket fue finalizado y archivado con nota de resolución.
                    </p>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Lightbox Modal for Claim Evidence Image */}
      <AnimatePresence>
        {isImageZoomed && selectedClaim?.photo && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-2 bg-slate-950/95 backdrop-blur-md overflow-hidden select-none">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsImageZoomed(false)}
              className="absolute inset-0 cursor-zoom-out"
            />
            
            {/* Control bar */}
            <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
              <a 
                href={selectedClaim.photo} 
                target="_blank" 
                rel="noopener noreferrer" 
                className="bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all backdrop-blur-sm shadow flex items-center gap-1.5"
                title="Abrir en pestaña nueva"
              >
                <span>Abrir Original ↗</span>
              </a>
              <button 
                type="button"
                onClick={() => setIsImageZoomed(false)}
                className="bg-white/20 hover:bg-white/40 text-white p-2 size-8 flex items-center justify-center rounded-full text-xs font-black transition-all backdrop-blur-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative max-w-full max-h-[90vh] flex flex-col items-center justify-center p-2"
            >
              <div className="overflow-auto max-w-full max-h-[80vh] rounded-2xl shadow-2xl bg-slate-900 border border-white/10">
                <img 
                  src={selectedClaim.photo} 
                  alt="Evidencia Ampliada" 
                  className="max-w-none md:max-w-4xl max-h-[75vh] object-contain rounded-xl cursor-zoom-out"
                  onClick={() => setIsImageZoomed(false)}
                />
              </div>
              <p className="text-white/60 text-[10px] font-bold mt-3 text-center uppercase tracking-wider">
                Haga clic para cerrar • Evidencia de {selectedClaim.customerName}
              </p>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
