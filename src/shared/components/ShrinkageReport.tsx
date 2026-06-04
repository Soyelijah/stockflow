import React, { useState, useEffect, useMemo } from "react";
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  Timestamp,
} from "firebase/firestore";
import { db } from "../../lib/firebase";
import { useAuth } from "../../contexts/AuthContext";
import { useBranch } from "../../contexts/BranchContext";
import { CROSS_BRANCH_SENTINEL } from "../../lib/branches";
import { cn, formatCurrency, toDate } from "../../lib/utils";
import { motion, AnimatePresence } from "motion/react";
import {
  TrendingDown,
  DollarSign,
  Package,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Download,
  FileText,
  Calendar,
  Filter,
  ChevronLeft,
  ChevronRight,
  BarChart3,
  PieChart as PieChartIcon,
  Activity,
  Search,
  X,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

const PIE_COLORS = [
  "#6366f1", "#f43f5e", "#f59e0b", "#10b981", "#8b5cf6",
  "#ec4899", "#06b6d4", "#84cc16", "#ef4444", "#14b8a6",
];

type PeriodKey = "today" | "7d" | "30d" | "90d" | "custom";

interface Movement {
  id: string;
  productId: string;
  productName: string;
  type: string;
  quantity: number;
  previousStock: number;
  newStock: number;
  reason: string;
  userName: string;
  userId: string;
  timestamp: any;
  source: string;
}

interface ProductInfo {
  id: string;
  name: string;
  costPrice: number;
  price: number;
  category: string;
}

function getDateRange(period: PeriodKey, customStart: string, customEnd: string): { start: Date; end: Date } {
  const now = new Date();
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  if (period === "custom" && customStart) {
    const s = new Date(customStart + "T00:00:00");
    const e = customEnd ? new Date(customEnd + "T23:59:59.999") : end;
    return { start: s, end: e };
  }

  const daysMap: Record<PeriodKey, number> = { today: 0, "7d": 7, "30d": 30, "90d": 90, custom: 30 };
  const days = daysMap[period];
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - days, 0, 0, 0, 0);
  return { start, end };
}

function getPreviousRange(start: Date, end: Date): { start: Date; end: Date } {
  const durationMs = end.getTime() - start.getTime();
  return {
    start: new Date(start.getTime() - durationMs),
    end: new Date(start.getTime() - 1),
  };
}

export function ShrinkageReport() {
  const { user, profile } = useAuth();
  const { selectedBranchId } = useBranch();

  // Data
  const [lossMovements, setLossMovements] = useState<Movement[]>([]);
  const [products, setProducts] = useState<ProductInfo[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [period, setPeriod] = useState<PeriodKey>("30d");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [motiveFilter, setMotiveFilter] = useState("all");
  const [userFilter, setUserFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");

  // Pagination
  const PAGE_SIZE = 15;
  const [currentPage, setCurrentPage] = useState(1);

  // Chart mounted flag
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setIsMounted(true), 300);
    return () => clearTimeout(t);
  }, []);

  // Build product map
  const productMap = useMemo(() => {
    const map = new Map<string, ProductInfo>();
    products.forEach((p) => map.set(p.id, p));
    return map;
  }, [products]);

  // Subscribe to products
  useEffect(() => {
    const q = query(collection(db, "products"), orderBy("name"));
    const unsub = onSnapshot(q, (snap) => {
      setProducts(
        snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            name: data.name || "",
            costPrice: Number(data.costPrice) || 0,
            price: Number(data.price) || 0,
            category: data.category || "Sin Categoría",
          };
        })
      );
    });
    return unsub;
  }, []);

  // Subscribe to loss movements. Multi-branch (Tier 1.4b): scope by selectedBranchId.
  useEffect(() => {
    setLoading(true);
    const constraints = [
      where("type", "==", "loss"),
      orderBy("timestamp", "desc"),
    ];
    if (selectedBranchId !== CROSS_BRANCH_SENTINEL) {
      constraints.unshift(where("branchId", "==", selectedBranchId));
    }
    const q = query(collection(db, "stockMovements"), ...constraints);
    const unsub = onSnapshot(
      q,
      (snap) => {
        setLossMovements(
          snap.docs.map((d) => ({ id: d.id, ...d.data() } as Movement))
        );
        setLoading(false);
      },
      (err) => {
        console.error("Error fetching loss movements:", err);
        setLoading(false);
      }
    );
    return unsub;
  }, [selectedBranchId]);

  // Computed: date range
  const { start: rangeStart, end: rangeEnd } = useMemo(
    () => getDateRange(period, customStart, customEnd),
    [period, customStart, customEnd]
  );

  const prevRange = useMemo(
    () => getPreviousRange(rangeStart, rangeEnd),
    [rangeStart, rangeEnd]
  );

  // Filtered movements for current period
  const filteredMovements = useMemo(() => {
    return lossMovements.filter((m) => {
      const ts = toDate(m.timestamp);
      if (ts < rangeStart || ts > rangeEnd) return false;

      if (categoryFilter !== "all") {
        const prod = productMap.get(m.productId);
        if (!prod || prod.category !== categoryFilter) return false;
      }

      if (motiveFilter !== "all") {
        if ((m.reason || "Sin especificar") !== motiveFilter) return false;
      }

      if (userFilter !== "all") {
        if (m.userName !== userFilter) return false;
      }

      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        if (
          !(m.productName || "").toLowerCase().includes(term) &&
          !(m.reason || "").toLowerCase().includes(term)
        )
          return false;
      }

      return true;
    });
  }, [lossMovements, rangeStart, rangeEnd, categoryFilter, motiveFilter, userFilter, searchTerm, productMap]);

  // Previous period movements (for trend comparison)
  const prevMovements = useMemo(() => {
    return lossMovements.filter((m) => {
      const ts = toDate(m.timestamp);
      return ts >= prevRange.start && ts <= prevRange.end;
    });
  }, [lossMovements, prevRange]);

  // Reset page on filter change
  useEffect(() => setCurrentPage(1), [period, customStart, customEnd, categoryFilter, motiveFilter, userFilter, searchTerm]);

  // ====== KPIs ======
  const totalUnits = useMemo(() => filteredMovements.reduce((acc, m) => acc + (Number(m.quantity) || 0), 0), [filteredMovements]);
  const prevTotalUnits = useMemo(() => prevMovements.reduce((acc, m) => acc + (Number(m.quantity) || 0), 0), [prevMovements]);

  const totalValue = useMemo(() => {
    return filteredMovements.reduce((acc, m) => {
      const prod = productMap.get(m.productId);
      const unitCost = prod ? (prod.costPrice || prod.price || 0) : 0;
      return acc + unitCost * (Number(m.quantity) || 0);
    }, 0);
  }, [filteredMovements, productMap]);

  const prevTotalValue = useMemo(() => {
    return prevMovements.reduce((acc, m) => {
      const prod = productMap.get(m.productId);
      const unitCost = prod ? (prod.costPrice || prod.price || 0) : 0;
      return acc + unitCost * (Number(m.quantity) || 0);
    }, 0);
  }, [prevMovements, productMap]);

  const topProduct = useMemo(() => {
    const counts: Record<string, { name: string; qty: number }> = {};
    filteredMovements.forEach((m) => {
      if (!counts[m.productId]) counts[m.productId] = { name: m.productName || "Desconocido", qty: 0 };
      counts[m.productId].qty += Number(m.quantity) || 0;
    });
    const sorted = Object.values(counts).sort((a, b) => b.qty - a.qty);
    return sorted[0] || { name: "—", qty: 0 };
  }, [filteredMovements]);

  const trendPct = useMemo(() => {
    if (prevTotalUnits === 0) return totalUnits > 0 ? 100 : 0;
    return ((totalUnits - prevTotalUnits) / prevTotalUnits) * 100;
  }, [totalUnits, prevTotalUnits]);

  // ====== Chart Data ======
  // Daily trend (AreaChart)
  const dailyTrend = useMemo(() => {
    const dayMap: Record<string, number> = {};
    const daysCount = Math.ceil((rangeEnd.getTime() - rangeStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    for (let i = 0; i < daysCount && i < 120; i++) {
      const d = new Date(rangeStart);
      d.setDate(d.getDate() + i);
      const key = `${d.getDate()}/${d.getMonth() + 1}`;
      dayMap[key] = 0;
    }
    filteredMovements.forEach((m) => {
      const d = toDate(m.timestamp);
      const key = `${d.getDate()}/${d.getMonth() + 1}`;
      if (dayMap[key] !== undefined) dayMap[key] += Number(m.quantity) || 0;
    });
    return Object.entries(dayMap).map(([name, unidades]) => ({ name, unidades }));
  }, [filteredMovements, rangeStart, rangeEnd]);

  // Top 10 products (BarChart)
  const topProducts = useMemo(() => {
    const counts: Record<string, { name: string; qty: number; value: number }> = {};
    filteredMovements.forEach((m) => {
      if (!counts[m.productId]) counts[m.productId] = { name: (m.productName || "").substring(0, 22), qty: 0, value: 0 };
      const prod = productMap.get(m.productId);
      const unitCost = prod ? (prod.costPrice || prod.price || 0) : 0;
      counts[m.productId].qty += Number(m.quantity) || 0;
      counts[m.productId].value += unitCost * (Number(m.quantity) || 0);
    });
    return Object.values(counts)
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 10)
      .map((p) => ({ name: p.name, unidades: p.qty, valor: p.value }));
  }, [filteredMovements, productMap]);

  // Motive distribution (PieChart)
  const motiveDistribution = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredMovements.forEach((m) => {
      const motive = m.reason || "Sin especificar";
      counts[motive] = (counts[motive] || 0) + (Number(m.quantity) || 0);
    });
    return Object.entries(counts)
      .map(([name, value]) => ({ name: name.substring(0, 28), value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [filteredMovements]);

  // ====== Filter Options ======
  const categoryOptions = useMemo(() => {
    const cats = new Set<string>();
    products.forEach((p) => cats.add(p.category));
    return Array.from(cats).sort();
  }, [products]);

  const motiveOptions = useMemo(() => {
    const motives = new Set<string>();
    lossMovements.forEach((m) => motives.add(m.reason || "Sin especificar"));
    return Array.from(motives).sort();
  }, [lossMovements]);

  const userOptions = useMemo(() => {
    const users = new Set<string>();
    lossMovements.forEach((m) => { if (m.userName) users.add(m.userName); });
    return Array.from(users).sort();
  }, [lossMovements]);

  // ====== Pagination ======
  const paginatedMovements = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredMovements.slice(start, start + PAGE_SIZE);
  }, [filteredMovements, currentPage]);

  const totalPages = Math.ceil(filteredMovements.length / PAGE_SIZE);

  // ====== Export CSV ======
  const handleExportCSV = () => {
    const headers = ["Fecha", "Producto", "Cantidad", "Stock Anterior", "Stock Nuevo", "Responsable", "Motivo", "Origen"];
    const rows = filteredMovements.map((m) => {
      const ts = toDate(m.timestamp);
      return [
        ts.toLocaleDateString("es-CL"),
        `"${(m.productName || "").replace(/"/g, '""')}"`,
        m.quantity,
        m.previousStock,
        m.newStock,
        `"${(m.userName || "").replace(/"/g, '""')}"`,
        `"${(m.reason || "").replace(/"/g, '""')}"`,
        m.source || "web",
      ].join(",");
    });
    const csv = "\uFEFF" + [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `reporte_mermas_${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  // ====== Export PDF ======
  const handleExportPDF = async () => {
    try {
      const payload = {
        title: "Reporte Consolidado de Mermas y Pérdidas",
        items: filteredMovements.map((m) => ({
          name: m.productName || "Producto Desconocido",
          stockActual: Number(m.previousStock),
          stockFisico: Number(m.newStock),
          motive: m.reason || "Sin especificar",
        })),
        responsible: profile?.name || "Administrador",
        comments: `Periodo: ${rangeStart.toLocaleDateString("es-CL")} — ${rangeEnd.toLocaleDateString("es-CL")}. Total de eventos: ${filteredMovements.length}. Total de unidades perdidas: ${totalUnits}. Valor estimado: ${formatCurrency(totalValue)}.`,
        lang: "es",
      };

      const token = await user?.getIdToken();
      const resp = await fetch("/api/shrinkage/pdf", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token || "sys-operator"}`,
        },
        body: JSON.stringify(payload),
      });

      if (!resp.ok) throw new Error("Error al generar PDF");

      const blob = await resp.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `reporte_mermas_${Date.now()}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error("PDF export error:", err);
      alert(`No se pudo generar el reporte PDF: ${err.message}`);
    }
  };

  // ====== Periods config ======
  const periods: { key: PeriodKey; label: string }[] = [
    { key: "today", label: "Hoy" },
    { key: "7d", label: "7 Días" },
    { key: "30d", label: "30 Días" },
    { key: "90d", label: "90 Días" },
    { key: "custom", label: "Personalizado" },
  ];

  return (
    <div className="space-y-6 md:space-y-8 max-w-[1600px] mx-auto p-4 md:p-8">
      {/* ═══════ HEADER ═══════ */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-800 tracking-tight flex items-center gap-3">
            <div className="size-10 bg-rose-100 rounded-2xl flex items-center justify-center">
              <TrendingDown size={22} className="text-rose-600" />
            </div>
            Reportería de Mermas
          </h1>
          <p className="text-slate-500 font-medium mt-1">
            Análisis visual de pérdidas de inventario, mermas y ajustes negativos.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button type="button"
            onClick={handleExportCSV}
            disabled={filteredMovements.length === 0}
            className="bg-white border border-slate-200 text-slate-700 font-bold px-5 py-2.5 rounded-2xl shadow-sm hover:bg-slate-50 hover:-translate-y-0.5 transition-all flex items-center gap-x-2 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Download size={16} className="text-emerald-600" />
            <span>CSV</span>
          </button>
          <button type="button"
            onClick={handleExportPDF}
            disabled={filteredMovements.length === 0}
            className="bg-rose-600 text-white font-bold px-5 py-2.5 rounded-2xl shadow-xl shadow-rose-200 hover:bg-rose-500 hover:-translate-y-0.5 transition-all flex items-center gap-x-2 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <FileText size={16} />
            <span>PDF Auditoría</span>
          </button>
        </div>
      </header>

      {/* ═══════ PERIOD SELECTOR ═══════ */}
      <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-sm flex flex-col lg:flex-row gap-4 items-center">
        <div className="flex bg-slate-100 p-1 rounded-2xl overflow-x-auto scrollbar-none whitespace-nowrap gap-1">
          {periods.map((p) => (
            <button type="button"
              key={p.key}
              onClick={() => setPeriod(p.key)}
              className={cn(
                "px-4 py-2.5 text-[10px] font-black uppercase tracking-wider rounded-xl transition-all cursor-pointer whitespace-nowrap",
                period === p.key
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              )}
            >
              {p.label}
            </button>
          ))}
        </div>

        {period === "custom" && (
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-x-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
              <Calendar size={14} className="text-slate-400" />
              <input
                type="date"
                aria-label="Fecha de inicio del período personalizado"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="bg-transparent border-none text-xs font-bold text-slate-700 focus:outline-none focus:ring-0 p-0"
              />
            </div>
            <span className="text-slate-400 text-xs font-bold">→</span>
            <div className="flex items-center gap-x-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
              <Calendar size={14} className="text-slate-400" />
              <input
                type="date"
                aria-label="Fecha de término del período personalizado"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="bg-transparent border-none text-xs font-bold text-slate-700 focus:outline-none focus:ring-0 p-0"
              />
            </div>
          </div>
        )}

        {/* Dropdowns */}
        <div className="flex flex-wrap items-center gap-3 flex-1">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 focus:ring-2 focus:ring-indigo-200 transition-all"
          >
            <option value="all">Todas las categorías</option>
            {categoryOptions.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>

          <select
            value={motiveFilter}
            onChange={(e) => setMotiveFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 focus:ring-2 focus:ring-indigo-200 transition-all"
          >
            <option value="all">Todos los motivos</option>
            {motiveOptions.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>

          <select
            value={userFilter}
            onChange={(e) => setUserFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 focus:ring-2 focus:ring-indigo-200 transition-all"
          >
            <option value="all">Todos los responsables</option>
            {userOptions.map((u) => (
              <option key={u} value={u}>{u}</option>
            ))}
          </select>

          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
            <input
              type="text"
              placeholder="Buscar producto o motivo…"
              aria-label="Buscar merma por producto o motivo"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 pl-9 pr-8 text-xs font-medium focus:ring-2 focus:ring-indigo-200 transition-all placeholder:text-slate-400 text-slate-700"
            />
            {searchTerm && (
              <button type="button"
                aria-label="Limpiar búsqueda"
                onClick={() => setSearchTerm("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ═══════ KPI CARDS ═══════ */}
      {loading ? (
        <div className="flex justify-center py-20">
          <div className="size-10 animate-spin rounded-full border-4 border-rose-200 border-t-rose-600 shadow-md" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Card 1: Total Units Lost */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0 }}
              className="bg-gradient-to-br from-rose-600 to-rose-700 rounded-[2.5rem] p-7 text-white relative overflow-hidden group shadow-xl shadow-rose-200"
            >
              <div className="relative z-10">
                <p className="text-[10px] font-black text-white/50 uppercase tracking-[0.2em] mb-1">Unidades Perdidas</p>
                <h3 className="text-4xl font-black">{totalUnits.toLocaleString("es-CL")}</h3>
                <p className="text-[10px] font-bold text-white/60 mt-1 uppercase">
                  {filteredMovements.length} eventos registrados
                </p>
              </div>
              <div className="absolute -right-3 -bottom-3 size-20 bg-white/5 rounded-[1.5rem] flex items-center justify-center rotate-12 group-hover:rotate-0 transition-transform">
                <Package size={40} className="text-white/10" />
              </div>
            </motion.div>

            {/* Card 2: Estimated Value */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              className="bg-slate-900 rounded-[2.5rem] p-7 text-white relative overflow-hidden group shadow-xl"
            >
              <div className="relative z-10">
                <p className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em] mb-1">Pérdida Estimada</p>
                <h3 className="text-3xl font-black">{formatCurrency(totalValue)}</h3>
                <p className="text-[10px] font-bold text-white/40 mt-1 uppercase">
                  Valorizado a costo unitario
                </p>
              </div>
              <div className="absolute -right-3 -bottom-3 size-20 bg-white/5 rounded-[1.5rem] flex items-center justify-center -rotate-12 group-hover:rotate-0 transition-transform">
                <DollarSign size={40} className="text-white/10" />
              </div>
            </motion.div>

            {/* Card 3: Top Product */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-white rounded-[2.5rem] p-7 border border-slate-200 relative overflow-hidden group shadow-sm"
            >
              <div className="relative z-10">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">SKU Más Afectado</p>
                <h3 className="text-lg font-black text-slate-800 truncate max-w-[200px]">{topProduct.name}</h3>
                <p className="text-[10px] font-bold text-rose-500 mt-1 uppercase">
                  {topProduct.qty > 0 ? `${topProduct.qty} unidades perdidas` : "Sin mermas"}
                </p>
              </div>
              <div className="absolute -right-3 -bottom-3 size-20 bg-rose-50 rounded-[1.5rem] flex items-center justify-center rotate-12 group-hover:rotate-0 transition-transform">
                <AlertTriangle size={32} className="text-rose-200" />
              </div>
            </motion.div>

            {/* Card 4: Trend */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="bg-white rounded-[2.5rem] p-7 border border-slate-200 relative overflow-hidden group shadow-sm"
            >
              <div className="relative z-10">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Tendencia vs Periodo Anterior</p>
                <h3 className={cn(
                  "text-3xl font-black",
                  trendPct > 0 ? "text-rose-600" : trendPct < 0 ? "text-emerald-600" : "text-slate-400"
                )}>
                  {trendPct > 0 ? "+" : ""}{trendPct.toFixed(1)}%
                </h3>
                <div className="flex items-center gap-1 mt-1">
                  {trendPct > 0 ? (
                    <ArrowUpRight size={14} className="text-rose-500" />
                  ) : trendPct < 0 ? (
                    <ArrowDownRight size={14} className="text-emerald-500" />
                  ) : null}
                  <p className="text-[10px] font-bold text-slate-400 uppercase">
                    {trendPct > 0 ? "Aumento en mermas" : trendPct < 0 ? "Reducción en mermas" : "Sin cambio"}
                  </p>
                </div>
              </div>
              <div className="absolute -right-3 -bottom-3 size-20 bg-indigo-50 rounded-[1.5rem] flex items-center justify-center -rotate-12 group-hover:rotate-0 transition-transform">
                <Activity size={32} className="text-indigo-200" />
              </div>
            </motion.div>
          </div>

          {/* ═══════ CHARTS ═══════ */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Daily Trend AreaChart */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-white rounded-[2.5rem] p-6 border border-slate-200 shadow-sm"
            >
              <div className="flex items-center justify-between mb-6">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Activity size={16} className="text-rose-500" />
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.15em]">
                      Tendencia Diaria de Mermas
                    </h3>
                  </div>
                  <p className="text-[10px] text-slate-400 font-medium">Unidades perdidas por día</p>
                </div>
              </div>
              {isMounted && dailyTrend.length > 0 ? (
                <ResponsiveContainer width="100%" height={260} minWidth={0}>
                  <AreaChart data={dailyTrend} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorLoss" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis
                      dataKey="name"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "#94a3b8", fontSize: 9, fontWeight: 700 }}
                      dy={10}
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "#94a3b8", fontSize: 9, fontWeight: 700 }}
                      allowDecimals={false}
                    />
                    <RechartsTooltip
                      contentStyle={{
                        borderRadius: "16px",
                        border: "none",
                        boxShadow: "0 20px 25px -5px rgb(0 0 0 / 0.1)",
                        padding: "12px 16px",
                      }}
                      formatter={(value: any) => [`${value} unidades`, "Merma"]}
                    />
                    <Area
                      type="monotone"
                      dataKey="unidades"
                      stroke="#f43f5e"
                      strokeWidth={3}
                      fillOpacity={1}
                      fill="url(#colorLoss)"
                      animationDuration={1200}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[260px] flex items-center justify-center text-slate-400 text-sm">
                  {dailyTrend.length === 0 ? "Sin datos en este periodo" : "Generando gráfico…"}
                </div>
              )}
            </motion.div>

            {/* Top 10 Products BarChart */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
              className="bg-white rounded-[2.5rem] p-6 border border-slate-200 shadow-sm"
            >
              <div className="flex items-center justify-between mb-6">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <BarChart3 size={16} className="text-indigo-500" />
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.15em]">
                      Top 10 Productos con Merma
                    </h3>
                  </div>
                  <p className="text-[10px] text-slate-400 font-medium">Productos con mayor pérdida de unidades</p>
                </div>
              </div>
              {isMounted && topProducts.length > 0 ? (
                <ResponsiveContainer width="100%" height={260} minWidth={0}>
                  <BarChart data={topProducts} margin={{ top: 10, right: 10, left: -25, bottom: 0 }} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                    <XAxis
                      type="number"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "#94a3b8", fontSize: 9, fontWeight: 700 }}
                      allowDecimals={false}
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "#475569", fontSize: 9, fontWeight: 700 }}
                      width={130}
                    />
                    <RechartsTooltip
                      contentStyle={{
                        borderRadius: "16px",
                        border: "none",
                        boxShadow: "0 20px 25px -5px rgb(0 0 0 / 0.1)",
                        padding: "12px 16px",
                      }}
                      formatter={(value: any, name: any) => [
                        name === "unidades" ? `${value} unidades` : formatCurrency(value),
                        name === "unidades" ? "Merma" : "Valor Perdido",
                      ]}
                    />
                    <Bar dataKey="unidades" fill="#6366f1" radius={[0, 8, 8, 0]} barSize={16} animationDuration={1200} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[260px] flex items-center justify-center text-slate-400 text-sm">
                  Sin datos en este periodo
                </div>
              )}
            </motion.div>
          </div>

          {/* PieChart — Motive Distribution */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-white rounded-[2.5rem] p-6 border border-slate-200 shadow-sm"
          >
            <div className="flex items-center gap-2 mb-6">
              <PieChartIcon size={16} className="text-amber-500" />
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.15em]">
                Distribución por Motivo de Merma
              </h3>
            </div>
            {isMounted && motiveDistribution.length > 0 ? (
              <div className="flex flex-col lg:flex-row items-center gap-8">
                <div className="w-full max-w-[320px]">
                  <ResponsiveContainer width="100%" height={280}>
                    <PieChart>
                      <Pie
                        data={motiveDistribution}
                        cx="50%"
                        cy="50%"
                        innerRadius={65}
                        outerRadius={100}
                        paddingAngle={4}
                        dataKey="value"
                        animationDuration={1200}
                      >
                        {motiveDistribution.map((entry, index) => (
                          <Cell key={`cell-${entry.name}`} fill={PIE_COLORS[index % PIE_COLORS.length]} cornerRadius={6} />
                        ))}
                      </Pie>
                      <RechartsTooltip
                        contentStyle={{
                          borderRadius: "16px",
                          border: "none",
                          boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)",
                        }}
                        formatter={(value: any) => [`${value} unidades`, ""]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
                  {motiveDistribution.map((item, index) => (
                    <div key={item.name || index} className="flex items-center gap-3 bg-slate-50 rounded-2xl px-4 py-3">
                      <div
                        className="size-3 rounded-full shrink-0"
                        style={{ backgroundColor: PIE_COLORS[index % PIE_COLORS.length] }}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-slate-700 truncate">{item.name}</p>
                        <p className="text-[10px] font-bold text-slate-400">
                          {item.value} unidades ({totalUnits > 0 ? ((item.value / totalUnits) * 100).toFixed(1) : 0}%)
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-slate-400 text-sm">
                Sin datos de motivos en este periodo
              </div>
            )}
          </motion.div>

          {/* ═══════ DETAIL TABLE ═══════ */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
            className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden"
          >
            <div className="px-8 py-5 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.15em]">
                Detalle de Movimientos de Merma
              </h3>
              <span className="text-[10px] font-bold text-slate-400 bg-slate-50 px-3 py-1 rounded-full">
                {filteredMovements.length} registros
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/50">
                    <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.15em]">Fecha</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.15em]">Producto</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.15em]">Cantidad</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.15em]">Stock</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.15em]">Valor Perdido</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.15em]">Responsable</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.15em]">Motivo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  <AnimatePresence>
                    {paginatedMovements.map((m) => {
                      const ts = toDate(m.timestamp);
                      const prod = productMap.get(m.productId);
                      const unitCost = prod ? (prod.costPrice || prod.price || 0) : 0;
                      const lostValue = unitCost * (Number(m.quantity) || 0);
                      return (
                        <motion.tr
                          key={m.id}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="hover:bg-rose-50/30 transition-colors"
                        >
                          <td className="px-8 py-4 whitespace-nowrap">
                            <p className="text-sm font-bold text-slate-700">{ts.toLocaleDateString("es-CL")}</p>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                              {ts.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })}
                            </p>
                          </td>
                          <td className="px-6 py-4">
                            <p className="font-bold text-slate-800 text-sm truncate max-w-[180px]">
                              {m.productName || "Producto Desconocido"}
                            </p>
                            {prod && (
                              <p className="text-[10px] text-slate-400 font-bold uppercase">{prod.category}</p>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            <span className="font-black text-rose-600 text-sm">-{m.quantity}</span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs text-slate-400 font-bold">{m.previousStock}</span>
                              <ArrowDownRight size={12} className="text-rose-400" />
                              <span className="text-sm font-black text-slate-800">{m.newStock}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className="font-bold text-rose-600 text-xs">{formatCurrency(lostValue)}</span>
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-xs font-bold text-slate-600">{m.userName || "—"}</span>
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-xs font-medium text-slate-500 bg-slate-50 px-2.5 py-1 rounded-lg inline-block max-w-[150px] truncate">
                              {m.reason || "Sin especificar"}
                            </span>
                          </td>
                        </motion.tr>
                      );
                    })}
                  </AnimatePresence>
                </tbody>
              </table>

              {filteredMovements.length === 0 && (
                <div className="p-16 text-center">
                  <div className="size-16 bg-slate-50 rounded-full flex items-center justify-center text-slate-200 mx-auto mb-4">
                    <TrendingDown size={32} />
                  </div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    No hay mermas registradas en este periodo
                  </p>
                  <p className="text-xs text-slate-400 mt-2">
                    Ajusta los filtros o cambia el rango de fechas
                  </p>
                </div>
              )}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="px-8 py-4 border-t border-slate-100 flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500">
                  Página <span className="font-bold text-slate-700">{currentPage}</span> de{" "}
                  <span className="font-bold text-slate-700">{totalPages}</span>
                </span>
                <div className="flex items-center gap-x-2">
                  <button type="button"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="p-2 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition-all flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed shadow-xs"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <button type="button"
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="p-2 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition-all flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed shadow-xs"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        </>
      )}
    </div>
  );
}
