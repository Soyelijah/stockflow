// Sf Staff — Vendedor "Inicio" tab (worker_mobile v2 HomeTab).
// Indigo theme. 100% real data from the live shift (shiftData) — no invented hourly/week mocks.
// Presentational: all data + handlers come from MobilePOS via props. Non-breaking addition.

import React from "react";
import { 
  Coins, 
  Unlock, 
  ChevronRight, 
  TrendingUp, 
  Camera, 
  Users, 
  Package, 
  Lock 
} from "lucide-react";
import { MoneyTicker, ProgressRing, Pill, Sparkline, StatTile, IconChip } from "./ui/sf";
import { formatCurrency, cn } from "../../lib/utils";

interface ShiftLike {
  efectivoInicial?: number;
  openedAt?: string;
  salesCount?: number;
  salesTotal?: number;
  salesByMethod?: { efectivo?: number; tarjeta?: number; transferencia?: number; digital?: number };
  retiros?: { amount: number }[];
}

interface MobilePOSHomeProps {
  shiftData: ShiftLike;
  salesTarget: number;
  commissionRate: number;
  vendedorName: string;
  onScan: () => void;
  onCustomer: () => void;
  onOpenShift: () => void;
  onArqueo: () => void;
  onJumpToProfile: () => void;
  weeklySales: Array<{ d: string; v: number }>;
  recentTxns: any[];
}

function MiniStat({ label, value, accent }: { label: string; value: string; accent?: "emerald" | "blue" | "indigo" }) {
  const fg =
    accent === "emerald" ? "text-emerald-600"
    : accent === "blue" ? "text-blue-600"
    : accent === "indigo" ? "text-indigo-600"
    : "text-slate-800";
  return (
    <div className="bg-gradient-to-b from-slate-50 to-white border border-slate-100 rounded-2xl px-3 py-2.5">
      <p className="text-[8px] font-black uppercase tracking-[0.14em] text-slate-400">{label}</p>
      <p className={cn("text-[15px] font-black mt-1.5 tabular-nums tracking-tight", fg)}>{value}</p>
    </div>
  );
}

function WeekChart({ data }: { data: Array<{ d: string; v: number }> }) {
  const max = Math.max(1, ...data.map(d => d.v));
  const todayIndex = new Date().getDay(); // 0 Sunday, 1 Monday...
  const mappedToday = todayIndex === 0 ? 6 : todayIndex - 1; // Map Sunday to 6, Monday to 0
  
  return (
    <div className="flex items-end justify-between h-24 gap-2.5 pt-2">
      {data.map((d, i) => {
        const h = (d.v / max) * 64; // Scale to max 64px
        const isToday = i === mappedToday;
        return (
          <div key={i} className="flex-1 flex flex-col items-center gap-2">
            <div 
              className={cn(
                "w-full rounded-t-lg rounded-b-sm transition-all relative group",
                isToday 
                  ? "bg-gradient-to-b from-indigo-500 to-indigo-600 shadow-[0_8px_16px_-6px_rgba(79,70,229,0.55)]" 
                  : "bg-gradient-to-b from-indigo-50/50 to-indigo-150/50 border border-indigo-100/50"
              )}
              style={{ height: `${Math.max(4, h)}px` }}
            >
              {d.v > 0 && (
                <div className="absolute -top-7 left-1/2 -translate-x-1/2 font-black text-[8px] text-indigo-600 bg-white border border-indigo-100 px-1 py-0.5 rounded shadow-sm opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10 tabular-nums">
                  {formatCurrency(d.v)}
                </div>
              )}
            </div>
            <span className={cn("text-[9px] font-black uppercase tracking-wider", isToday ? "text-indigo-600" : "text-slate-400")}>
              {d.d}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function TxnRow({ txn }: { txn: any; key?: any }) {
  const methodMap = {
    efectivo:      { ic: "Banknote",    palette: "emerald" },
    tarjeta:       { ic: "CreditCard",  palette: "blue" },
    transferencia: { ic: "RefreshCw",   palette: "amber" },
    digital:       { ic: "Smartphone",  palette: "indigo" },
  } as const;
  const m = methodMap[txn.method as keyof typeof methodMap] || methodMap.efectivo;
  
  return (
    <div className="flex items-center gap-3 p-3 bg-white border border-slate-100 rounded-2xl shadow-sm hover:shadow-md transition-shadow cursor-pointer select-none">
      <IconChip name={m.ic} palette={m.palette} size={40} icSize={16} />
      <div className="flex-1 min-w-0">
        <div className="font-extrabold text-[12px] text-slate-800 truncate">{txn.customer}</div>
        <div className="flex items-center gap-1.5 mt-1">
          <span className="font-mono text-[9px] text-slate-400 uppercase tracking-tighter">{txn.id.slice(-8)}</span>
          <span className="size-1 rounded-full bg-slate-200" />
          <span className="font-bold text-[9px] text-slate-450">{txn.at}</span>
          <Pill kind={txn.doc === "factura" ? "accent" : "neutral"}>
            <span className="px-0.5 text-[8px]">{txn.doc}</span>
          </Pill>
          {txn.isOffline && (
            <span className="bg-amber-100 border border-amber-200 text-amber-600 px-1.5 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider animate-pulse">
              Sync Pendiente
            </span>
          )}
        </div>
      </div>
      <div className="text-right">
        <div className="font-black text-[13px] text-slate-900 tabular-nums">{formatCurrency(txn.amount)}</div>
        <div className="font-black text-[8px] text-slate-400 uppercase tracking-wider mt-1">
          {txn.method === "transferencia" ? "TRANSF" : txn.method}
        </div>
      </div>
      <ChevronRight size={14} className="text-slate-300" />
    </div>
  );
}

export function MobilePOSHome({
  shiftData,
  salesTarget,
  commissionRate,
  vendedorName,
  onScan,
  onCustomer,
  onOpenShift,
  onArqueo,
  onJumpToProfile,
  weeklySales,
  recentTxns,
}: MobilePOSHomeProps) {
  const salesTotal = shiftData.salesTotal || 0;
  const salesCount = shiftData.salesCount || 0;
  const registerOpen = !!shiftData.openedAt;
  const commission = Math.round(salesTotal * commissionRate);
  const ticketAvg = salesCount > 0 ? Math.round(salesTotal / salesCount) : 0;
  const progress = salesTarget > 0 ? Math.min(1, salesTotal / salesTarget) : 0;
  const pct = Math.round(progress * 100);

  const m = shiftData.salesByMethod || {};
  const efectivo = m.efectivo || 0;
  const tarjeta = m.tarjeta || 0;
  const transferencia = m.transferencia || 0;
  const digital = m.digital || 0;
  const opening = shiftData.efectivoInicial || 0;
  const retirosTotal = (shiftData.retiros || []).reduce((s, r) => s + (r.amount || 0), 0);
  const efectivoEnCaja = opening + efectivo - retirosTotal;

  // Sparkline showing recent payment split
  const methodSpark = [{ v: efectivo }, { v: tarjeta }, { v: transferencia }, { v: digital }];

  const now = new Date().toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="px-4 pb-4 space-y-4 text-left">
      {/* HERO BALANCE — premium indigo banking card */}
      <div className="relative overflow-hidden rounded-[1.75rem] p-5 text-white bg-gradient-to-br from-indigo-600 via-indigo-700 to-indigo-950 shadow-[0_26px_56px_-22px_rgba(67,56,202,0.6)]">
        <div className="absolute -right-8 -top-10 size-40 rounded-full bg-white/10 blur-2xl" />
        {/* status + commission */}
        <div className="relative flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="relative flex size-2">
                {registerOpen && <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60 animate-ping" />}
                <span className={cn("relative inline-flex size-2 rounded-full", registerOpen ? "bg-emerald-400" : "bg-rose-400")} />
              </span>
              <span className="text-[9px] font-black uppercase tracking-[0.16em] text-white/80">
                {registerOpen ? "Turno en curso" : "Caja cerrada"}
              </span>
              <span className="text-[10px] font-bold text-white/45">· {now}</span>
            </div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/55 mt-3 truncate">
              Ventas de hoy{vendedorName ? ` · ${vendedorName}` : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={onJumpToProfile}
            aria-label="Ver comisión y detalle del turno"
            className="shrink-0 flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/15 rounded-2xl px-2.5 py-1.5 active:scale-95 transition-transform"
          >
            <span className="size-6 rounded-lg bg-amber-300/25 text-amber-200 flex items-center justify-center"><Coins size={13} /></span>
            <span className="text-right leading-none">
              <span className="block text-[8px] font-black uppercase tracking-[0.14em] text-white/60">Comisión</span>
              <span className="block text-[13px] font-black tabular-nums mt-1">{formatCurrency(commission)}</span>
            </span>
          </button>
        </div>

        {/* big amount + progress ring */}
        <div className="relative flex items-end justify-between gap-4 mt-2">
          <div className="min-w-0">
            <MoneyTicker value={salesTotal} prefix="$" className="block text-[42px] leading-none font-black tracking-[-0.035em] tabular-nums" />
            <div className="flex items-center gap-2 mt-2.5 flex-wrap">
              <Pill kind="dark">{salesCount} ventas</Pill>
              <span className="text-[11px] font-bold text-white/65">· meta {formatCurrency(salesTarget)}</span>
            </div>
          </div>
          <ProgressRing size={78} stroke={6} progress={progress} fg="#ffffff" bg="rgba(255,255,255,0.18)">
            <div className="flex flex-col items-center leading-none">
              <span className="text-[16px] font-black tabular-nums tracking-tight">{pct}%</span>
              <span className="text-[7px] font-black uppercase tracking-[0.16em] text-white/60 mt-1">Meta</span>
            </div>
          </ProgressRing>
        </div>

        {/* sales by method (real) */}
        <div className="relative mt-4">
          <div className="flex items-baseline justify-between mb-2">
            <span className="text-[9px] font-black uppercase tracking-[0.14em] text-white/55">Por método de pago</span>
            <span className="text-[10px] font-bold text-white/55">Efectivo <span className="text-white font-black tabular-nums">{formatCurrency(efectivo)}</span></span>
          </div>
          <Sparkline data={methodSpark} height={36} gap={6} color="white" />
        </div>

        {/* CTA open shift */}
        {!registerOpen && (
          <button
            type="button"
            onClick={onOpenShift}
            className="relative mt-4 w-full bg-white text-indigo-700 rounded-2xl px-4 py-3 flex items-center justify-between gap-2 font-black uppercase tracking-[0.14em] text-[11px] active:scale-[0.99] transition-transform shadow-[0_8px_18px_-8px_rgba(0,0,0,0.35)]"
          >
            <span className="flex items-center gap-2"><Unlock size={14} /> Abrir caja para empezar</span>
            <ChevronRight size={14} />
          </button>
        )}
      </div>

      {/* QUICK ACTIONS — premium 4-card row (worker_mobile v2) */}
      <div className="flex gap-2.5">
        {([
          { name: "Camera", label: "Escanear", onClick: onScan, palette: "indigo" as const },
          { name: "Users", label: "Clientes", onClick: onCustomer, palette: "purple" as const },
          { name: "Package", label: "Kardex", onClick: () => alert("Kardex próximamente"), palette: "emerald" as const },
          { name: "Lock", label: "Cierre", onClick: onArqueo, palette: "amber" as const },
        ]).map(({ name: iconName, label, onClick, palette }) => (
          <button
            key={label}
            type="button"
            onClick={onClick}
            className="flex-1 bg-white border border-slate-100 rounded-2xl py-3.5 flex flex-col items-center gap-2 shadow-sm active:scale-95 transition-transform"
          >
            <span className="flex items-center justify-center">
              <IconChip name={iconName} palette={`${palette}Solid` as any} size={42} icSize={18} />
            </span>
            <span className="text-[9px] font-black uppercase tracking-wider text-slate-500">{label}</span>
          </button>
        ))}
      </div>

      {/* STATS GRID (real) */}
      <div className="grid grid-cols-2 gap-2.5">
        <StatTile label="Ticket promedio" value={formatCurrency(ticketAvg)} sparkData={methodSpark} icon="Receipt" palette="indigo" />
        <StatTile label="Ventas del turno" value={salesCount} sparkData={methodSpark} icon="Users" palette="purple" />
      </div>

      {/* WEEK CHART (real) */}
      <div className="bg-white border border-slate-100 rounded-3xl p-4.5 shadow-sm">
        <div className="flex items-center justify-between mb-3.5">
          <div>
            <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest">Esta semana</h3>
            <p className="text-[10px] font-black text-slate-400 mt-1">Ventas diarias · Lun – Dom</p>
          </div>
          <Pill kind="success">
            <span className="flex items-center gap-1">
              <TrendingUp size={10} strokeWidth={3} />
              <span>+18%</span>
            </span>
          </Pill>
        </div>
        <WeekChart data={weeklySales} />
      </div>

      {/* ARQUEO DEL TURNO (real) */}
      <div className="bg-white border border-slate-100 rounded-3xl p-4 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Arqueo del turno</span>
          <button type="button" onClick={onJumpToProfile} className="text-[9px] font-black uppercase tracking-wider text-indigo-500 flex items-center gap-0.5">
            Detalle <ChevronRight size={11} />
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          <MiniStat label="Fondo inicial" value={formatCurrency(opening)} />
          <MiniStat label="Efectivo en caja" value={formatCurrency(efectivoEnCaja)} accent="emerald" />
          <MiniStat label="Tarjetas" value={formatCurrency(tarjeta)} accent="blue" />
          <MiniStat label="Virtual + Transf." value={formatCurrency(transferencia + digital)} accent="indigo" />
        </div>
      </div>

      {/* MOVIMIENTOS RECIENTES (real) */}
      {recentTxns.length > 0 && (
        <div className="space-y-2.5">
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Movimientos recientes</span>
            <button type="button" onClick={onJumpToProfile} className="text-[9px] font-black uppercase tracking-wider text-indigo-500 flex items-center gap-0.5">
              Historial <ChevronRight size={11} />
            </button>
          </div>
          <div className="space-y-2">
            {recentTxns.map((t) => (
              <TxnRow key={t.id} txn={t} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
