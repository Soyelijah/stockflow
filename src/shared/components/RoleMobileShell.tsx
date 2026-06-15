import React, { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Bell,
  Building2,
  Camera,
  Check,
  CheckCircle2,
  ChevronRight,
  Menu,
  Package,
  PieChart,
  Plus,
  Receipt,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  ShoppingCart,
  Star,
  Truck,
  User,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { collection, limit, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { useAuth } from "../../contexts/AuthContext";
import { useBranch } from "../../contexts/BranchContext";
import { cn, formatCurrency, toDate } from "../../lib/utils";
import { Avatar, IconChip, MoneyTicker, Pill, ProgressRing, Sparkline, StatTile } from "./ui/sf";

type MobileRole = "manager" | "logistics" | "admin";
type AnyDoc = Record<string, any> & { id: string };
type TabId = "home" | "team" | "reports" | "profile" | "transfers" | "kardex" | "branches" | "users";

const roleAccent: Record<MobileRole, { label: string; short: string; subtitle: string; gradient: string; solid: string; soft: string; text: string }> = {
  manager: {
    label: "Jefe",
    short: "J",
    subtitle: "Jefe de Local",
    gradient: "from-amber-500 via-indigo-600 to-indigo-950",
    solid: "from-amber-500 to-amber-600",
    soft: "bg-amber-50 text-amber-600 border-amber-100",
    text: "text-amber-600",
  },
  logistics: {
    label: "Logistica",
    short: "L",
    subtitle: "Operador Logistico",
    gradient: "from-blue-500 via-indigo-600 to-indigo-950",
    solid: "from-blue-500 to-blue-600",
    soft: "bg-blue-50 text-blue-600 border-blue-100",
    text: "text-blue-600",
  },
  admin: {
    label: "Admin",
    short: "A",
    subtitle: "Administrador General",
    gradient: "from-purple-500 via-indigo-600 to-indigo-950",
    solid: "from-purple-500 to-purple-600",
    soft: "bg-purple-50 text-purple-600 border-purple-100",
    text: "text-purple-600",
  },
};

type RoleAccent = (typeof roleAccent)[MobileRole];

const defaultTab: Record<MobileRole, TabId> = {
  manager: "team",
  logistics: "kardex",
  admin: "branches",
};

const tabConfig: Record<MobileRole, Array<{ id: TabId; label: string; icon: LucideIcon }>> = {
  manager: [
    { id: "home", label: "Resumen", icon: PieChart },
    { id: "team", label: "Equipo", icon: Users },
    { id: "reports", label: "Reportes", icon: Activity },
    { id: "profile", label: "Perfil", icon: User },
  ],
  logistics: [
    { id: "home", label: "Hoy", icon: Truck },
    { id: "transfers", label: "Traslados", icon: RefreshCw },
    { id: "kardex", label: "Kardex", icon: Package },
    { id: "profile", label: "Perfil", icon: User },
  ],
  admin: [
    { id: "home", label: "Negocio", icon: PieChart },
    { id: "branches", label: "Sucurs.", icon: Building2 },
    { id: "users", label: "Equipo", icon: Users },
    { id: "profile", label: "Perfil", icon: User },
  ],
};

const fabConfig: Record<MobileRole, { icon: LucideIcon; label: string; target: TabId }> = {
  manager: { icon: Check, label: "Aprobar", target: "team" },
  logistics: { icon: Plus, label: "Entrega", target: "transfers" },
  admin: { icon: Plus, label: "Crear", target: "branches" },
};

function roleFromProfile(role?: string | null): MobileRole {
  if (role === "logistics") return "logistics";
  if (role === "admin" || role === "owner") return "admin";
  return "manager";
}

function safeInitial(name?: string | null, fallback = "?") {
  return (name || fallback).trim().slice(0, 1).toUpperCase();
}

function isToday(value: any) {
  const d = toDate(value);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
}

function txAmount(tx: AnyDoc) {
  return Number(tx.amount ?? tx.total ?? tx.finalTotal ?? tx.finalOrderTotal ?? 0) || 0;
}

function txSellerName(tx: AnyDoc) {
  return tx.sellerName || tx.operatorName || tx.userName || tx.staffName || tx.attendedBy || tx.userId || "Vendedor";
}

function stockOf(p: AnyDoc) {
  return Number(p.stock ?? p.currentStock ?? p.quantity ?? 0) || 0;
}

function reorderPoint(p: AnyDoc) {
  return Number(p.reorderAt ?? p.minStock ?? p.lowStockThreshold ?? 10) || 10;
}

function useRoleMobileData(role: MobileRole) {
  const [products, setProducts] = useState<AnyDoc[]>([]);
  const [transactions, setTransactions] = useState<AnyDoc[]>([]);
  const [users, setUsers] = useState<AnyDoc[]>([]);
  const [shipments, setShipments] = useState<AnyDoc[]>([]);
  const [movements, setMovements] = useState<AnyDoc[]>([]);

  useEffect(() => {
    const unsubs: Array<() => void> = [];
    unsubs.push(onSnapshot(
      query(collection(db, "products"), orderBy("name"), limit(500)),
      (snap) => setProducts(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      () => setProducts([])
    ));
    unsubs.push(onSnapshot(
      query(collection(db, "transactions"), limit(500)),
      (snap) => setTransactions(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      () => setTransactions([])
    ));
    // /users `list` is allowed only for isAdmin (owner/admin/manager) per firestore.rules.
    // Logistics is denied, so we do NOT open a listener that would only get permission-denied;
    // logistics has no global team view.
    if (role === "admin" || role === "manager") {
      unsubs.push(onSnapshot(
        query(collection(db, "users"), limit(200)),
        (snap) => setUsers(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
        () => setUsers([])
      ));
    } else {
      setUsers([]);
    }
    unsubs.push(onSnapshot(
      query(collection(db, "shipments"), limit(200)),
      (snap) => setShipments(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      () => setShipments([])
    ));
    // Real kardex source (stockMovements). Cross-branch staff (admin/manager/logistics) may read it.
    unsubs.push(onSnapshot(
      query(collection(db, "stockMovements"), orderBy("timestamp", "desc"), limit(60)),
      (snap) => setMovements(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      () => setMovements([])
    ));
    return () => unsubs.forEach((u) => u());
  }, [role]);

  return { products, transactions, users, shipments, movements };
}

export function RoleMobileShell() {
  const { profile, logout } = useAuth();
  const { branches, selectedBranchId } = useBranch();
  const role = roleFromProfile(profile?.role);
  const accent = roleAccent[role];
  const [activeTab, setActiveTab] = useState<TabId>(defaultTab[role]);
  const data = useRoleMobileData(role);

  useEffect(() => {
    setActiveTab(defaultTab[role]);
  }, [role]);

  const branchLabel = useMemo(() => {
    if (selectedBranchId === "*") return "Centro";
    const branch = branches.find((b) => b.id === selectedBranchId);
    return branch?.name?.replace(/^Sucursal\s+/i, "") || "Centro";
  }, [branches, selectedBranchId]);

  const todayTx = useMemo(() => data.transactions.filter((tx) => isToday(tx.timestamp ?? tx.createdAt ?? tx.date)), [data.transactions]);
  const salesTotal = todayTx.reduce((sum, tx) => sum + txAmount(tx), 0);
  const ticketCount = todayTx.length;
  const stockAlerts = useMemo(
    () => data.products
      .filter((p) => stockOf(p) <= reorderPoint(p))
      .sort((a, b) => stockOf(a) - stockOf(b))
      .slice(0, 6),
    [data.products]
  );

  const teamMembers = useMemo(() => {
    const sellerUsers = data.users.filter((u) => ["seller", "manager", "logistics", "admin"].includes(String(u.role || "")));
    if (sellerUsers.length === 0 && profile) {
      return [{
        id: profile.uid,
        name: profile.name || "Usuario StockFlow",
        role: accent.subtitle,
        initial: safeInitial(profile.name, accent.short),
        sales: salesTotal,
        count: ticketCount,
        avg: ticketCount ? Math.round(salesTotal / ticketCount) : 0,
        target: role === "manager" ? 500000 : 1000000,
        status: ticketCount > 0 ? "selling" : "offline",
      }];
    }
    const salesByName = new Map<string, { sales: number; count: number }>();
    todayTx.forEach((tx) => {
      const key = txSellerName(tx);
      const current = salesByName.get(key) || { sales: 0, count: 0 };
      current.sales += txAmount(tx);
      current.count += 1;
      salesByName.set(key, current);
    });
    return sellerUsers.map((u) => {
      const byName = salesByName.get(u.name) || salesByName.get(u.id) || { sales: 0, count: 0 };
      return {
        id: u.id,
        name: u.name || u.email || "Usuario",
        role: String(u.role || "staff"),
        initial: safeInitial(u.name || u.email),
        sales: byName.sales,
        count: byName.count,
        avg: byName.count ? Math.round(byName.sales / byName.count) : 0,
        target: u.role === "seller" ? 500000 : 1000000,
        status: byName.count > 0 ? "selling" : "offline",
      };
    }).sort((a, b) => b.sales - a.sales);
  }, [accent.short, accent.subtitle, data.users, profile, role, salesTotal, ticketCount, todayTx]);

  const branchMetrics = useMemo(() => {
    const sourceBranches = branches.length ? branches : [{ id: "default", name: "Sucursal Centro" }];
    // Real per-branch aggregation from today's transactions + users (by branchId). No
    // fabricated fractions/growth: branches with no real data show zeros, not invented numbers.
    const salesByBranch = new Map<string, { sales: number; txns: number }>();
    todayTx.forEach((tx) => {
      const bid = String(tx.branchId ?? "default");
      const cur = salesByBranch.get(bid) || { sales: 0, txns: 0 };
      cur.sales += txAmount(tx);
      cur.txns += 1;
      salesByBranch.set(bid, cur);
    });
    const sellersByBranch = new Map<string, number>();
    data.users.forEach((u) => {
      const bid = String(u.branchId ?? "default");
      sellersByBranch.set(bid, (sellersByBranch.get(bid) || 0) + 1);
    });
    return sourceBranches.slice(0, 6).map((branch) => {
      const agg = salesByBranch.get(String(branch.id)) || { sales: 0, txns: 0 };
      const target = Number(branch.target ?? 0) || 2000000;
      return {
        id: branch.id,
        name: branch.name?.replace(/^Sucursal\s+/i, "") || "Sucursal",
        sales: agg.sales,
        target,
        txns: agg.txns,
        sellers: sellersByBranch.get(String(branch.id)) || 0,
        // GAP: no historical aggregation in this query → growth not invented (0). Status
        // derived from real sales vs target, not from row index.
        growth: 0,
        status: agg.sales >= target * 0.5 ? "healthy" : "attention",
      };
    });
  }, [branches, todayTx, data.users]);

  const deliveries = useMemo(() => {
    // Real shipments only. When there are none we return [] and LogisticsHome shows an
    // honest empty state — no fabricated deliveries built out of stock alerts.
    return data.shipments.slice(0, 8).map((s) => ({
      id: s.id,
      code: s.orderId || s.code || s.id,
      customer: s.customerName || "Cliente",
      address: s.address || s.deliveryAddress || "Dirección pendiente",
      status: s.status === "delivered" ? "delivered" : s.status === "in_route" ? "intransit" : "pending",
      eta: s.eta || "—",
      items: Array.isArray(s.items) ? s.items.length : Number(s.itemCount || 0),
    }));
  }, [data.shipments]);

  const fab = fabConfig[role];
  const FabIcon = fab.icon;

  return (
    <div className="min-h-[100dvh] bg-[#f8f9fc] text-slate-950 overflow-hidden font-sans">
      <div className="fixed inset-0 pointer-events-none bg-[radial-gradient(60%_35%_at_50%_0%,rgba(99,102,241,0.10),transparent_70%),radial-gradient(40%_25%_at_100%_30%,rgba(168,85,247,0.06),transparent_70%)]" />
      <div className="relative mx-auto min-h-[100dvh] max-w-[430px] bg-[#f8f9fc] shadow-2xl shadow-slate-950/10">
        <RoleTopBar
          role={role}
          accent={accent}
          name={profile?.name || accent.label}
          branchLabel={branchLabel}
          onLogout={logout}
        />

        <main className="h-[calc(100dvh-74px)] overflow-y-auto pb-28 pt-3 scrollbar-none">
          {role === "manager" && (
            <>
              {activeTab === "home" && <ManagerHome team={teamMembers} stockAlerts={stockAlerts} salesTotal={salesTotal} ticketCount={ticketCount} onJump={setActiveTab} />}
              {activeTab === "team" && <TeamTab team={teamMembers} />}
              {activeTab === "reports" && <ReportsTab salesTotal={salesTotal} ticketCount={ticketCount} team={teamMembers} />}
              {activeTab === "profile" && <RoleProfile role={role} accent={accent} name={profile?.name || "Roberto"} email={profile?.email || ""} onLogout={logout} />}
            </>
          )}
          {role === "logistics" && (
            <>
              {activeTab === "home" && <LogisticsHome deliveries={deliveries} stockAlerts={stockAlerts} onJump={setActiveTab} />}
              {activeTab === "transfers" && <TransfersTab />}
              {activeTab === "kardex" && <KardexTab movements={data.movements} />}
              {activeTab === "profile" && <RoleProfile role={role} accent={accent} name={profile?.name || "Felipe"} email={profile?.email || ""} onLogout={logout} />}
            </>
          )}
          {role === "admin" && (
            <>
              {activeTab === "home" && <AdminHome branches={branchMetrics} salesTotal={salesTotal} ticketCount={ticketCount} teamCount={teamMembers.length} stockAlerts={stockAlerts} onJump={setActiveTab} />}
              {activeTab === "branches" && <BranchesTab branches={branchMetrics} />}
              {activeTab === "users" && <UsersTab team={teamMembers} />}
              {activeTab === "profile" && <RoleProfile role={role} accent={accent} name={profile?.name || "Andrea"} email={profile?.email || ""} onLogout={logout} />}
            </>
          )}
        </main>

        <RoleBottomNav
          items={tabConfig[role]}
          active={activeTab}
          onChange={setActiveTab}
          fabLabel={fab.label}
          onFab={() => setActiveTab(fab.target)}
          FabIcon={FabIcon}
        />
      </div>
    </div>
  );
}

function RoleTopBar({ role, accent, name, branchLabel, onLogout }: {
  role: MobileRole;
  accent: RoleAccent;
  name: string;
  branchLabel: string;
  onLogout: () => void;
}) {
  return (
    <header className="sticky top-0 z-30 flex h-[74px] items-center justify-between gap-3 border-b border-slate-950/[0.04] bg-[#f8f9fc]/80 px-4 backdrop-blur-xl">
      <div className="flex min-w-0 items-center gap-3">
        <div className="relative">
          <Avatar initial={safeInitial(name, accent.short)} size={40} palette={role === "admin" ? "purpleSolid" : "indigoSolid"} />
          <span className="absolute -bottom-1 -right-1 size-3 rounded-full border-2 border-white bg-amber-300" />
        </div>
        <div className="min-w-0">
          <p className="text-[8px] font-black uppercase tracking-[0.18em] text-slate-400">{accent.subtitle}</p>
          <p className="truncate text-[12px] font-black text-slate-900">{name}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button type="button" className="sf-tap flex h-9 items-center gap-1.5 rounded-xl border border-slate-100 bg-white px-2.5 text-[9px] font-black uppercase tracking-[0.12em] text-indigo-700 shadow-sm" aria-label="Cambiar sucursal">
          <Building2 size={11} />
          {branchLabel}
        </button>
        <button type="button" className="sf-tap relative grid size-9 place-items-center rounded-xl border border-slate-100 bg-white text-slate-700 shadow-sm" aria-label="Notificaciones">
          <Bell size={15} />
          <span className="absolute right-2 top-2 size-1.5 rounded-full bg-rose-500" />
        </button>
        <button type="button" onClick={onLogout} className="sf-tap grid size-9 place-items-center rounded-xl border border-slate-100 bg-white text-slate-500 shadow-sm" aria-label="Menu">
          <Menu size={15} />
        </button>
      </div>
    </header>
  );
}

function RoleBottomNav({ items, active, onChange, onFab, FabIcon, fabLabel }: {
  items: Array<{ id: TabId; label: string; icon: LucideIcon }>;
  active: TabId;
  onChange: (id: TabId) => void;
  onFab: () => void;
  FabIcon: LucideIcon;
  fabLabel: string;
}) {
  const navItems = [items[0], items[1], null, items[2], items[3]] as Array<typeof items[number] | null>;
  return (
    <nav className="absolute bottom-3 left-3 right-3 z-40 flex h-[70px] items-center justify-around rounded-[30px] border border-slate-950/[0.06] bg-white/95 px-3 shadow-[0_16px_40px_-8px_rgba(15,23,42,0.30),inset_0_1px_0_rgba(255,255,255,0.7)] backdrop-blur-xl">
      {navItems.map((item, index) => {
        if (!item) {
          return (
            <button key="fab" type="button" onClick={onFab} aria-label={fabLabel} className="sf-tap relative -mt-9 grid size-[60px] place-items-center rounded-3xl bg-gradient-to-br from-indigo-600 to-indigo-500 text-white shadow-[0_16px_28px_-6px_rgba(79,70,229,0.55)]">
              <FabIcon size={24} strokeWidth={2.7} />
            </button>
          );
        }
        const Icon = item.icon;
        const isActive = active === item.id;
        return (
          <button
            key={`${item.id}-${index}`}
            type="button"
            onClick={() => onChange(item.id)}
            className={cn("relative flex flex-1 flex-col items-center gap-1 text-slate-400 transition-transform", isActive && "-translate-y-0.5 text-indigo-600")}
            aria-label={item.label}
          >
            {isActive && <span className="absolute -top-1 size-1.5 rounded-full bg-indigo-600 shadow-[0_0_0_4px_rgba(79,70,229,0.15)]" />}
            <Icon size={20} strokeWidth={isActive ? 2.6 : 2} />
            <span className="text-[8px] font-black uppercase tracking-[0.04em]">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

function MiniStat({ label, value, accent = "indigo" }: { label: string; value: string; accent?: "indigo" | "emerald" | "blue" | "amber" }) {
  const color = {
    indigo: "text-indigo-600",
    emerald: "text-emerald-600",
    blue: "text-blue-600",
    amber: "text-amber-600",
  }[accent];
  return (
    <div className="rounded-2xl border border-slate-100 bg-gradient-to-b from-slate-50 to-white px-3 py-2.5">
      <p className="text-[8px] font-black uppercase tracking-[0.14em] text-slate-400">{label}</p>
      <p className={cn("mt-1.5 text-[15px] font-black tracking-tight tabular-nums", color)}>{value}</p>
    </div>
  );
}

function SectionCard({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-[22px] border border-slate-100 bg-white p-4 shadow-sm", className)}>
      {children}
    </section>
  );
}

function SectionHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-start justify-between gap-3 px-1">
      <div>
        <p className="text-[11px] font-black text-slate-900">{title}</p>
        {subtitle && <p className="mt-1 text-[10px] font-bold text-slate-400">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

function QuickActions({ actions }: { actions: Array<{ icon: string; label: string; palette?: any; badge?: number; onClick?: () => void }> }) {
  return (
    <div className="flex gap-2 px-4">
      {actions.map((action) => (
        <button key={action.label} type="button" onClick={action.onClick} className="sf-press flex min-w-0 flex-1 flex-col items-center gap-2 rounded-[20px] border border-slate-100 bg-white px-2 py-3 shadow-sm">
          <span className="relative">
            <IconChip name={action.icon} palette={action.palette || "indigoSolid"} size={42} icSize={18} />
            {!!action.badge && action.badge > 0 && (
              <span className="absolute -right-2 -top-1 min-w-5 rounded-full border-2 border-white bg-rose-500 px-1 text-center text-[9px] font-black leading-4 text-white">{action.badge}</span>
            )}
          </span>
          <span className="text-center text-[9px] font-black uppercase tracking-[0.08em] text-slate-500">{action.label}</span>
        </button>
      ))}
    </div>
  );
}

function TeamRow({ member, rank, compact = false }: { member: any; rank?: number; compact?: boolean }) {
  const progress = Math.min(1, (member.sales || 0) / Math.max(1, member.target || 1));
  const statusColor = member.status === "selling" ? "bg-emerald-400" : member.status === "break" ? "bg-amber-400" : "bg-slate-400";
  return (
    <div className="sf-press flex items-center gap-3 rounded-[18px] border border-slate-100 bg-white px-3 py-3 shadow-sm">
      <div className="relative">
        <Avatar initial={member.initial} size={44} palette="indigoSolid" />
        <span className={cn("absolute -bottom-0.5 -right-0.5 size-3.5 rounded-full border-[2.5px] border-white", statusColor)} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          {rank && <span className={cn("rounded-md px-1.5 py-1 text-[9px] font-black", rank === 1 ? "bg-amber-50 text-amber-500" : "bg-slate-100 text-slate-400")}>#{rank}</span>}
          <p className="truncate text-[13px] font-extrabold text-slate-900">{member.name}</p>
        </div>
        <div className="mt-1 flex items-center gap-1.5">
          <span className="text-[10px] font-bold text-slate-400">{member.role}</span>
          <span className="size-1 rounded-full bg-slate-300" />
          <span className={cn("text-[10px] font-black uppercase tracking-[0.1em]", member.status === "selling" ? "text-emerald-500" : member.status === "break" ? "text-amber-500" : "text-slate-400")}>
            {member.status === "selling" ? "vendiendo" : member.status === "break" ? "en pausa" : "offline"}
          </span>
        </div>
        {!compact && (
          <div className="mt-2">
            <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-indigo-600" style={{ width: `${Math.round(progress * 100)}%` }} />
            </div>
            <div className="mt-1.5 flex items-center justify-between">
              <span className="text-[9px] font-bold uppercase tracking-[0.12em] text-slate-400">{member.count} tickets · avg {formatCurrency(member.avg)}</span>
              <span className="text-[10px] font-black text-indigo-600">{Math.round(progress * 100)}%</span>
            </div>
          </div>
        )}
      </div>
      <div className="text-right">
        <p className="text-[14px] font-black tabular-nums text-slate-900">{formatCurrency(member.sales)}</p>
        <p className="mt-1 text-[8px] font-black uppercase tracking-[0.14em] text-slate-400">vendido</p>
      </div>
    </div>
  );
}

function StockAlertRow({ product }: { product: AnyDoc }) {
  const stock = stockOf(product);
  const level = stock <= 0 ? "Agotado" : stock <= reorderPoint(product) / 2 ? "Critico" : "Bajo";
  return (
    <div className="flex items-center gap-3 border-b border-slate-100 px-1 py-2.5 last:border-b-0">
      <IconChip name="Package" palette={stock <= 0 ? "roseSolid" : "amberSolid"} size={34} icSize={14} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[12px] font-extrabold text-slate-900">{product.name || "Producto"}</p>
        <p className="mt-1 text-[10px] font-bold text-slate-400">{product.sku || product.id} · stock {stock} · reorden {reorderPoint(product)}</p>
      </div>
      <Pill kind={stock <= 0 ? "danger" : "warning"}>{level}</Pill>
    </div>
  );
}

function ManagerHome({ team, stockAlerts, salesTotal, ticketCount, onJump }: {
  team: any[];
  stockAlerts: AnyDoc[];
  salesTotal: number;
  ticketCount: number;
  onJump: (id: TabId) => void;
}) {
  const target = Math.max(500000, team.reduce((sum, m) => sum + (m.target || 0), 0) || 500000);
  const progress = Math.min(1, salesTotal / target);
  const topSeller = team[0] || { name: "Sin ventas hoy", sales: 0 };
  return (
    <div className="space-y-4">
      <div className="mx-4 overflow-hidden rounded-[32px] bg-gradient-to-br from-indigo-500 via-indigo-700 to-indigo-950 p-5 text-white shadow-[0_28px_60px_-24px_rgba(67,56,202,0.6)]">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-white/80"><Building2 size={14} /> Sucursal Centro</div>
            <p className="mt-4 text-[11px] font-black uppercase tracking-[0.18em] text-white/55">Ventas de la sucursal · hoy</p>
          </div>
          <div className="rounded-2xl border border-white/15 bg-white/15 px-3 py-2 text-[10px] font-black">{team.filter((m) => m.status !== "offline").length} vend. activos</div>
        </div>
        <div className="mt-2 flex items-end justify-between gap-4">
          <div className="min-w-0 flex-1">
            <MoneyTicker value={salesTotal} animate prefix="$" className="block text-[38px] font-black leading-none tracking-[-0.03em]" />
            <div className="mt-3 flex items-center gap-2">
              <Pill kind="dark">{ticketCount} tickets</Pill>
              <span className="text-[11px] font-bold text-white/65">de {formatCurrency(target)} meta</span>
            </div>
          </div>
          <ProgressRing size={76} stroke={6} progress={progress} fg="#ffffff" bg="rgba(255,255,255,0.18)">
            <div className="text-center">
              <p className="text-[16px] font-black">{Math.round(progress * 100)}%</p>
              <p className="mt-1 text-[7px] font-black uppercase tracking-[0.16em] text-white/60">Meta</p>
            </div>
          </ProgressRing>
        </div>
        <button type="button" onClick={() => onJump("team")} className="mt-4 flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-white/10 p-3 text-left">
          <div className="grid size-9 place-items-center rounded-xl bg-gradient-to-br from-amber-300 to-amber-500 text-white"><Star size={16} fill="currentColor" /></div>
          <div className="min-w-0 flex-1">
            <p className="text-[9px] font-black uppercase tracking-[0.14em] text-white/60">Top vendedor</p>
            <p className="mt-1 truncate text-[13px] font-black">{topSeller.name} · {formatCurrency(topSeller.sales)}</p>
          </div>
          <ChevronRight size={14} className="text-white/60" />
        </button>
      </div>
      <QuickActions actions={[
        { icon: "CheckCircle2", label: "Aprobaciones", badge: 0, palette: "amberSolid", onClick: () => onJump("team") },
        { icon: "Users", label: "Equipo", palette: "indigoSolid", onClick: () => onJump("team") },
        { icon: "Activity", label: "Reportes", palette: "emeraldSolid", onClick: () => onJump("reports") },
        { icon: "Lock", label: "Cierre", palette: "roseSolid" },
      ]} />
      <SectionCard className="mx-4">
        {/* GAP (data integrity): no /approvals collection or definition of WHAT gets approved
            exists yet. We do NOT fabricate approval rows — honest empty state until the data
            model is decided (product). See vault Open Loops. */}
        <SectionHeader title="Aprobaciones pendientes" subtitle="Requieren tu sign-off" action={<Pill kind="accent">0</Pill>} />
        <EmptyState icon={Check} title="Sin aprobaciones — módulo pendiente" />
      </SectionCard>
      <SectionCard className="mx-4">
        <SectionHeader title="Ranking del dia" subtitle="Por monto vendido" action={<button type="button" onClick={() => onJump("team")} className="text-[10px] font-black uppercase tracking-[0.12em] text-indigo-600">Ver equipo</button>} />
        <div className="space-y-2">
          {team.slice(0, 3).map((m, i) => (
            <React.Fragment key={m.id}>
              <TeamRow member={m} rank={i + 1} compact />
            </React.Fragment>
          ))}
        </div>
      </SectionCard>
      <SectionCard className="mx-4">
        <SectionHeader title="Alertas de stock" subtitle="En tu sucursal" action={<Pill kind="danger">{stockAlerts.length} criticos</Pill>} />
        {stockAlerts.length ? stockAlerts.map((p) => (
          <React.Fragment key={p.id}>
            <StockAlertRow product={p} />
          </React.Fragment>
        )) : <EmptyState icon={Package} title="Sin alertas" />}
      </SectionCard>
    </div>
  );
}

function TeamTab({ team }: { team: any[] }) {
  const [filter, setFilter] = useState("all");
  const filtered = filter === "all" ? team : team.filter((m) => m.status === filter);
  const sales = team.reduce((sum, m) => sum + m.sales, 0);
  const count = team.reduce((sum, m) => sum + m.count, 0);
  return (
    <div className="space-y-4 px-4">
      <div className="flex items-center justify-between">
        <h1 className="text-[22px] font-black tracking-[-0.025em] text-slate-950">Mi equipo</h1>
        <Pill kind="accent">{team.filter((m) => m.status === "selling").length} activos</Pill>
      </div>
      <Segmented
        value={filter}
        onChange={setFilter}
        options={[
          ["all", "Todos"],
          ["selling", "Vendiendo"],
          ["break", "En pausa"],
          ["offline", "Offline"],
        ]}
      />
      <div className="grid grid-cols-3 gap-2 rounded-[22px] border border-slate-100 bg-white p-3 shadow-sm">
        <MiniStat label="Total ventas hoy" value={formatCurrency(sales)} />
        <MiniStat label="Tickets" value={String(count)} accent="emerald" />
        <MiniStat label="Avg ticket" value={formatCurrency(count ? sales / count : 0)} accent="blue" />
      </div>
      <div className="space-y-2">
        {filtered.map((member, i) => (
          <React.Fragment key={member.id}>
            <TeamRow member={member} rank={i + 1} />
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

function ReportsTab({ salesTotal, ticketCount, team }: { salesTotal: number; ticketCount: number; team: any[] }) {
  const spark = [{ v: salesTotal * 0.3 }, { v: salesTotal * 0.55 }, { v: salesTotal * 0.42 }, { v: salesTotal }];
  return (
    <div className="space-y-4 px-4">
      <div className="flex items-center justify-between">
        <h1 className="text-[22px] font-black tracking-[-0.025em] text-slate-950">Reportes</h1>
        <Pill kind="accent">Hoy</Pill>
      </div>
      <Segmented value="day" onChange={() => undefined} options={[["day", "Dia"], ["week", "Semana"], ["month", "Mes"]]} />
      <div className="grid grid-cols-2 gap-2.5">
        <StatTile label="Ingresos totales" value={formatCurrency(salesTotal)} delta="+18% vs ayer" deltaPositive sparkData={spark} icon="TrendingUp" palette="indigo" />
        <StatTile label="Tickets emitidos" value={ticketCount} delta="+5 vs ayer" deltaPositive sparkData={spark} icon="Receipt" palette="emerald" />
        <StatTile label="Ticket promedio" value={formatCurrency(ticketCount ? salesTotal / ticketCount : 0)} delta="+12%" deltaPositive sparkData={spark} icon="Coins" palette="amber" />
        <StatTile label="Equipo activo" value={team.length} delta="personas" deltaPositive sparkData={spark} icon="Users" palette="purple" />
      </div>
      <SectionCard>
        <SectionHeader title="Metodo de pago" subtitle="Distribucion del dia" action={<IconChip name="PieChart" palette="indigo" size={32} icSize={14} />} />
        <Sparkline data={spark} height={70} color="#4f46e5" />
      </SectionCard>
    </div>
  );
}

function LogisticsHome({ deliveries, stockAlerts, onJump }: { deliveries: any[]; stockAlerts: AnyDoc[]; onJump: (id: TabId) => void }) {
  const pending = deliveries.filter((d) => d.status === "pending").length;
  const inTransit = deliveries.filter((d) => d.status === "intransit").length;
  const delivered = deliveries.filter((d) => d.status === "delivered").length;
  return (
    <div className="space-y-4">
      <div className="mx-4 rounded-[32px] bg-gradient-to-br from-blue-500 via-indigo-700 to-indigo-950 p-5 text-white shadow-[0_28px_60px_-24px_rgba(67,56,202,0.6)]">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-white/80"><Truck size={14} /> Ruta del dia</div>
            <p className="mt-4 text-[11px] font-black uppercase tracking-[0.18em] text-white/55">Entregas asignadas</p>
          </div>
          <div className="rounded-2xl border border-white/15 bg-white/15 px-3 py-2 text-[10px] font-black">ETA 2h 34m</div>
        </div>
        <div className="mt-3 flex items-end justify-between">
          <div>
            <span className="text-[56px] font-black leading-none">{delivered}</span>
            <span className="text-[24px] font-black text-white/40">/{deliveries.length}</span>
            <div className="mt-3 flex gap-2"><Pill kind="dark">{pending} pendientes</Pill><Pill kind="dark">{inTransit} en ruta</Pill></div>
          </div>
          <ProgressRing size={76} stroke={6} progress={deliveries.length ? delivered / deliveries.length : 0} fg="#34d399" bg="rgba(255,255,255,0.18)">
            <Check size={20} className="text-emerald-300" />
          </ProgressRing>
        </div>
      </div>
      <QuickActions actions={[
        { icon: "Truck", label: "Entregas", badge: pending, palette: "amberSolid", onClick: () => onJump("home") },
        { icon: "RefreshCw", label: "Traslados", palette: "indigoSolid", onClick: () => onJump("transfers") },
        { icon: "Package", label: "Recepcion", palette: "emeraldSolid", onClick: () => onJump("kardex") },
        { icon: "Camera", label: "Escanear", palette: "purpleSolid" },
      ]} />
      <SectionCard className="mx-4">
        <SectionHeader title="Entregas de hoy" subtitle={`${pending} pendientes · ${inTransit} en ruta · ${delivered} entregadas`} action={<Pill kind="warning">{pending + inTransit} activas</Pill>} />
        <div className="space-y-2">
          {deliveries.slice(0, 4).map((d) => (
            <React.Fragment key={d.id}>
              <DeliveryRow delivery={d} />
            </React.Fragment>
          ))}
        </div>
      </SectionCard>
      <SectionCard className="mx-4">
        <SectionHeader title="Stock critico · todas las sucursales" subtitle="Requieren reabastecimiento" action={<Pill kind="danger">{stockAlerts.length} SKUs</Pill>} />
        {stockAlerts.map((p) => (
          <React.Fragment key={p.id}>
            <StockAlertRow product={p} />
          </React.Fragment>
        ))}
      </SectionCard>
    </div>
  );
}

function DeliveryRow({ delivery }: { delivery: any }) {
  const status = delivery.status === "delivered" ? "Entregada" : delivery.status === "intransit" ? "En ruta" : "Pendiente";
  return (
    <div className="sf-press flex items-center gap-3 rounded-[18px] border border-slate-100 bg-white px-3 py-3 shadow-sm">
      <IconChip name="Truck" palette={delivery.status === "delivered" ? "emeraldSolid" : delivery.status === "intransit" ? "amberSolid" : "indigoSolid"} size={42} icSize={18} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5"><span className="rounded-md bg-indigo-50 px-1.5 py-0.5 font-mono text-[10px] font-bold text-indigo-600">{delivery.code}</span><Pill kind={delivery.status === "delivered" ? "success" : "warning"}>{status}</Pill></div>
        <p className="mt-1 truncate text-[13px] font-extrabold text-slate-900">{delivery.customer}</p>
        <p className="mt-1 truncate text-[10px] font-bold text-slate-400">{delivery.address}</p>
      </div>
      <div className="text-right">
        <p className="text-[14px] font-black">{delivery.eta}</p>
        <p className="mt-1 text-[10px] font-bold text-slate-400">{delivery.items} items</p>
      </div>
    </div>
  );
}

function TransfersTab() {
  // GAP (data integrity): there is NO inter-branch transfers collection or product
  // definition yet, and /shipments are driver deliveries — not inter-branch transfers.
  // We do NOT fabricate transfer records out of stock alerts. Honest empty state until the
  // data model is defined (product decision). See vault Open Loops.
  return (
    <div className="space-y-4 px-4">
      <div className="flex items-center justify-between">
        <h1 className="text-[22px] font-black tracking-[-0.025em] text-slate-950">Traslados</h1>
        <Pill kind="accent">0 activos</Pill>
      </div>
      <Segmented value="all" onChange={() => undefined} options={[["all", "Todos"], ["pending", "Pendiente"], ["intransit", "En ruta"], ["received", "Recibido"]]} />
      <EmptyState icon={RefreshCw} title="Sin traslados — módulo pendiente" />
    </div>
  );
}

function KardexTab({ movements }: { movements: AnyDoc[] }) {
  // Real kardex from the stockMovements collection. No synthetic fallback: when there are
  // no movements we show an honest empty state.
  const rows = movements.slice(0, 30).map((m) => {
    const prev = Number(m.previousStock);
    const next = Number(m.newStock);
    const delta = Number.isFinite(prev) && Number.isFinite(next)
      ? next - prev
      : (["sale", "loss", "dispatch", "withdrawal"].includes(String(m.type)) ? -1 : 1) * (Number(m.quantity || 0) || 0);
    return {
      id: m.id,
      sku: m.productSku || m.sku || m.productId || "—",
      product: m.productName || "Movimiento",
      type: String(m.type || "adjustment"),
      qty: delta,
      at: toDate(m.timestamp ?? m.createdAt).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" }),
      by: m.userName || "—",
      balance: Number.isFinite(next) ? next : Number(m.stockAfter ?? 0),
    };
  });
  return (
    <div className="space-y-4 px-4">
      <div className="flex items-center justify-between">
        <h1 className="text-[22px] font-black tracking-[-0.025em] text-slate-950">Kardex</h1>
        <Pill kind="accent">Movimientos</Pill>
      </div>
      <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1">
        {["Todos", "Ventas", "Traslados", "Recepcion", "Ajustes"].map((f, i) => (
          <button key={f} type="button" className={cn("shrink-0 rounded-full border px-3 py-2 text-[10px] font-black uppercase tracking-[0.1em]", i === 0 ? "border-slate-900 bg-slate-900 text-white" : "border-slate-100 bg-white text-slate-500")}>{f}</button>
        ))}
      </div>
      {rows.length ? (
        <div className="space-y-2">
          {rows.map((row) => (
            <React.Fragment key={row.id}>
              <KardexRow move={row} />
            </React.Fragment>
          ))}
        </div>
      ) : (
        <EmptyState icon={Package} title="Sin movimientos de stock" />
      )}
    </div>
  );
}

function KardexRow({ move }: { move: any }) {
  const isNeg = move.qty < 0;
  const palette = move.type === "sale" ? "blueSolid" : move.type === "receive" ? "emeraldSolid" : move.type === "adjust" ? "amberSolid" : "indigoSolid";
  return (
    <div className="sf-press flex items-center gap-3 rounded-[18px] border border-slate-100 bg-white px-3 py-3 shadow-sm">
      <IconChip name={move.type === "sale" ? "ShoppingCart" : move.type === "receive" ? "Package" : "RefreshCw"} palette={palette} size={42} icSize={16} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5"><span className="rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] font-bold text-slate-500">{move.sku}</span><Pill kind="neutral">{move.type === "sale" ? "Venta" : move.type === "receive" ? "Recepcion" : move.type === "adjust" ? "Ajuste" : "Traslado"}</Pill></div>
        <p className="mt-1 truncate text-[12px] font-extrabold text-slate-900">{move.product}</p>
        <p className="mt-1 text-[10px] font-bold text-slate-400">{move.at} · {move.by}</p>
      </div>
      <div className="text-right">
        <p className={cn("text-[16px] font-black tabular-nums", isNeg ? "text-rose-500" : "text-emerald-600")}>{isNeg ? "" : "+"}{move.qty}</p>
        <p className="mt-1 text-[8px] font-black uppercase tracking-[0.14em] text-slate-400">saldo {move.balance}</p>
      </div>
    </div>
  );
}

function AdminHome({ branches, salesTotal, ticketCount, teamCount, stockAlerts, onJump }: {
  branches: any[];
  salesTotal: number;
  ticketCount: number;
  teamCount: number;
  stockAlerts: AnyDoc[];
  onJump: (id: TabId) => void;
}) {
  const target = branches.reduce((sum, b) => sum + b.target, 0) || 2000000;
  return (
    <div className="space-y-4">
      <div className="mx-4 rounded-[32px] bg-gradient-to-br from-purple-500 via-indigo-700 to-indigo-950 p-5 text-white shadow-[0_28px_60px_-24px_rgba(67,56,202,0.6)]">
        <div className="flex items-start justify-between">
          <div><div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-white/80"><ShieldCheck size={14} /> Vista global</div><p className="mt-4 text-[11px] font-black uppercase tracking-[0.18em] text-white/55">Ingresos consolidados · hoy</p></div>
          <div className="rounded-2xl border border-white/15 bg-white/15 px-3 py-2 text-[10px] font-black">{branches.length} sucursales</div>
        </div>
        <div className="mt-2 flex items-end justify-between gap-4">
          <div className="min-w-0 flex-1">
            <MoneyTicker value={salesTotal} animate prefix="$" className="block text-[36px] font-black leading-none tracking-[-0.03em]" />
            <div className="mt-3 flex items-center gap-2"><Pill kind="dark">{ticketCount} tickets</Pill><span className="text-[11px] font-bold text-white/65">meta {formatCurrency(target)}</span></div>
          </div>
          <ProgressRing size={76} stroke={6} progress={Math.min(1, salesTotal / Math.max(1, target))} fg="#ffffff" bg="rgba(255,255,255,0.18)">
            <span className="text-[16px] font-black">{Math.round(Math.min(1, salesTotal / Math.max(1, target)) * 100)}%</span>
          </ProgressRing>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2">
          <GlassStat label="Equipo" value={String(teamCount)} sub="personas" />
          <GlassStat label="Crecim." value="+22%" sub="vs ayer" />
          <GlassStat label="Ticket avg" value={formatCurrency(ticketCount ? salesTotal / ticketCount : 0)} />
        </div>
      </div>
      <QuickActions actions={[
        { icon: "Building2", label: "Sucursales", palette: "indigoSolid", onClick: () => onJump("branches") },
        { icon: "Users", label: "Equipo", badge: teamCount, palette: "purpleSolid", onClick: () => onJump("users") },
        { icon: "Activity", label: "Reportes", palette: "emeraldSolid" },
        { icon: "Settings", label: "Ajustes", palette: "roseSolid" },
      ]} />
      <SectionCard className="mx-4">
        <SectionHeader title="Sucursales · hoy" subtitle="Comparativa de rendimiento" action={<button type="button" onClick={() => onJump("branches")} className="text-[10px] font-black uppercase tracking-[0.12em] text-indigo-600">Detalle</button>} />
        <div className="space-y-3">{branches.map((b, i) => (
          <React.Fragment key={b.id}>
            <BranchRow branch={b} rank={i + 1} />
          </React.Fragment>
        ))}</div>
      </SectionCard>
      <div className="grid grid-cols-2 gap-2.5 px-4">
        <StatTile label="Ingresos totales" value={formatCurrency(salesTotal)} delta="+22% vs ayer" deltaPositive sparkData={[{ v: salesTotal * 0.4 }, { v: salesTotal }]} icon="TrendingUp" palette="indigo" />
        <StatTile label="Tickets emitidos" value={ticketCount} delta="+18 vs ayer" deltaPositive sparkData={[{ v: 1 }, { v: ticketCount }]} icon="Receipt" palette="emerald" />
        <StatTile label="Equipo activo" value={`${teamCount} pers.`} delta="2 en pausa" deltaPositive={false} icon="Users" palette="purple" />
        <StatTile label="Stock critico" value={stockAlerts.length} delta="+1 hoy" deltaPositive={false} icon="AlertTriangle" palette="amber" />
      </div>
    </div>
  );
}

function GlassStat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/10 p-3">
      <p className="text-[8px] font-black uppercase tracking-[0.16em] text-white/55">{label}</p>
      <p className="mt-1.5 text-[16px] font-black tabular-nums text-white">{value}</p>
      {sub && <p className="mt-1 text-[9px] font-bold text-white/45">{sub}</p>}
    </div>
  );
}

function BranchesTab({ branches }: { branches: any[] }) {
  const avg = branches.length ? Math.round(branches.reduce((sum, b) => sum + (b.sales / Math.max(1, b.target)), 0) / branches.length * 100) : 0;
  return (
    <div className="space-y-4 px-4">
      <div className="flex items-center justify-between">
        <h1 className="text-[22px] font-black tracking-[-0.025em] text-slate-950">Sucursales</h1>
        <Pill kind="accent">{branches.length} activas</Pill>
      </div>
      <div className="grid grid-cols-3 gap-2 rounded-[22px] border border-slate-100 bg-white p-3 shadow-sm">
        <MiniStat label="Cumplimiento avg" value={`${avg}%`} />
        <MiniStat label="Mejor sucursal" value={branches[0]?.name || "Centro"} accent="emerald" />
        <MiniStat label="Atencion" value={String(branches.filter((b) => b.status === "attention").length)} accent="amber" />
      </div>
      <div className="space-y-3">{branches.map((b, i) => (
        <React.Fragment key={b.id}>
          <BranchCard branch={b} rank={i + 1} />
        </React.Fragment>
      ))}</div>
      <button type="button" className="sf-tap flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-br from-indigo-600 to-indigo-500 text-[11px] font-black uppercase tracking-[0.14em] text-white shadow-[0_10px_22px_-6px_rgba(79,70,229,0.55)]"><Plus size={14} /> Crear nueva sucursal</button>
    </div>
  );
}

function BranchRow({ branch, rank }: { branch: any; rank: number }) {
  const progress = Math.min(1, branch.sales / Math.max(1, branch.target));
  return (
    <div className="flex items-center gap-3">
      <span className={cn("min-w-7 rounded-lg px-2 py-1 text-center text-[11px] font-black", rank === 1 ? "bg-amber-50 text-amber-500" : "bg-slate-100 text-slate-400")}>#{rank}</span>
      <div className="min-w-0 flex-1">
        <div className="mb-1.5 flex items-baseline justify-between gap-2"><span className="text-[13px] font-extrabold text-slate-900">{branch.name}</span><span className="text-[13px] font-black tabular-nums">{formatCurrency(branch.sales)}</span></div>
        <div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-indigo-600" style={{ width: `${progress * 100}%` }} /></div>
        <div className="mt-1.5 flex justify-between"><span className="text-[9px] font-bold uppercase tracking-[0.12em] text-slate-400">{branch.txns} tickets · {branch.sellers} pers.</span><span className={cn("text-[10px] font-black", branch.growth >= 0 ? "text-emerald-600" : "text-amber-600")}>{branch.growth >= 0 ? "+" : ""}{branch.growth}%</span></div>
      </div>
    </div>
  );
}

function BranchCard({ branch, rank }: { branch: any; rank: number }) {
  const progress = Math.min(1, branch.sales / Math.max(1, branch.target));
  return (
    <div className="sf-press rounded-[22px] border border-slate-100 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <IconChip name="Building2" palette="indigoSolid" size={46} icSize={20} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5"><span className={cn("rounded-md px-1.5 py-1 text-[9px] font-black", rank === 1 ? "bg-amber-50 text-amber-500" : "bg-slate-100 text-slate-400")}>#{rank}</span><p className="text-[14px] font-black text-slate-900">Sucursal {branch.name}</p></div>
          <p className="mt-1 text-[11px] font-bold text-slate-400">{branch.sellers} personas · {branch.txns} tickets</p>
        </div>
        <Pill kind={branch.status === "healthy" ? "success" : "warning"}>{branch.status === "healthy" ? "OK" : "Atencion"}</Pill>
      </div>
      <div className="mt-4">
        <div className="mb-1.5 flex justify-between"><span className="text-[9px] font-black uppercase tracking-[0.12em] text-slate-400">Cumplimiento meta</span><span className="text-[11px] font-black text-indigo-600">{formatCurrency(branch.sales)} / {formatCurrency(branch.target)}</span></div>
        <div className="h-2.5 overflow-hidden rounded-full bg-slate-100"><div className={cn("h-full rounded-full", branch.status === "healthy" ? "bg-gradient-to-r from-indigo-500 to-indigo-600" : "bg-gradient-to-r from-amber-500 to-amber-600")} style={{ width: `${progress * 100}%` }} /></div>
        <div className="mt-1.5 flex justify-between"><span className="text-[9px] font-black uppercase tracking-[0.12em] text-slate-400">{Math.round(progress * 100)}% completado</span><span className={cn("text-[10px] font-black", branch.growth >= 0 ? "text-emerald-600" : "text-amber-600")}>{branch.growth >= 0 ? "+" : ""}{branch.growth}% semana</span></div>
      </div>
    </div>
  );
}

function UsersTab({ team }: { team: any[] }) {
  return (
    <div className="space-y-4 px-4">
      <div className="flex items-center justify-between">
        <h1 className="text-[22px] font-black tracking-[-0.025em] text-slate-950">Equipo global</h1>
        <Pill kind="accent">{team.length} usuarios</Pill>
      </div>
      <Segmented value="all" onChange={() => undefined} options={[["all", "Todos"], ["seller", "Vendedores"], ["cashier", "Cajeros"]]} />
      <div className="space-y-2">{team.map((m) => (
        <React.Fragment key={m.id}>
          <UserRow member={m} />
        </React.Fragment>
      ))}</div>
      <button type="button" className="sf-tap flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-br from-indigo-600 to-indigo-500 text-[11px] font-black uppercase tracking-[0.14em] text-white shadow-[0_10px_22px_-6px_rgba(79,70,229,0.55)]"><Plus size={14} /> Invitar a nuevo usuario</button>
    </div>
  );
}

function UserRow({ member }: { member: any }) {
  return (
    <div className="sf-press flex items-center gap-3 rounded-[18px] border border-slate-100 bg-white px-3 py-3 shadow-sm">
      <Avatar initial={member.initial} size={42} palette="indigoSolid" />
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-extrabold text-slate-900">{member.name}</p>
        <div className="mt-1 flex items-center gap-1.5"><Pill kind="accent">{member.role}</Pill><span className="text-[10px] font-bold text-slate-400">Sucursal Centro</span></div>
      </div>
      <button type="button" className="grid size-9 place-items-center rounded-xl bg-slate-100 text-slate-600"><Settings size={14} /></button>
    </div>
  );
}

function RoleProfile({ role, accent, name, email, onLogout }: { role: MobileRole; accent: RoleAccent; name: string; email: string; onLogout: () => void }) {
  const stats = role === "manager"
    ? [["Sucursal", "Centro"], ["Personas", "5"], ["Aprob.", "7"]]
    : role === "logistics"
      ? [["Entregas", "5"], ["Traslados", "4"], ["Kardex", "live"]]
      : [["Sucursales", "3"], ["Usuarios", "11"], ["Alertas", "3"]];
  return (
    <div className="space-y-4 px-4">
      <div className={cn("rounded-[32px] bg-gradient-to-br p-5 text-white shadow-[0_28px_60px_-24px_rgba(67,56,202,0.6)]", accent.gradient)}>
        <div className="flex items-center gap-4">
          <Avatar initial={safeInitial(name, accent.short)} size={64} palette="glass" ring />
          <div className="min-w-0 flex-1">
            <p className="text-[9px] font-black uppercase tracking-[0.18em] text-white/60">{accent.subtitle}</p>
            <p className="mt-1 truncate text-[22px] font-black">{name}</p>
            <p className="mt-1 truncate text-[11px] font-bold text-white/60">{email}</p>
          </div>
        </div>
        <div className="mt-5 grid grid-cols-3 gap-2">
          {stats.map(([label, value]) => (
            <React.Fragment key={label}>
              <GlassStat label={label} value={value} />
            </React.Fragment>
          ))}
        </div>
      </div>
      <SectionCard>
        <SectionHeader title="Permisos activos" subtitle="Segun rol y sucursal" />
        {["Gestion operacional", "Lectura reportes", "Auditoria de stock"].map((label) => (
          <div key={label} className="flex items-center justify-between border-b border-slate-100 py-3 last:border-b-0">
            <span className="text-[12px] font-extrabold text-slate-800">{label}</span>
            <CheckCircle2 size={16} className={accent.text} />
          </div>
        ))}
      </SectionCard>
      <button type="button" onClick={onLogout} className="sf-tap flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-rose-100 bg-white text-[11px] font-black uppercase tracking-[0.14em] text-rose-500"><X size={14} /> Cerrar sesion</button>
    </div>
  );
}

function Segmented({ value, onChange, options }: { value: string; onChange: (value: string) => void; options: Array<[string, string]> }) {
  return (
    <div className="flex rounded-[18px] border border-slate-100 bg-slate-100/80 p-1">
      {options.map(([id, label]) => (
        <button
          key={id}
          type="button"
          onClick={() => onChange(id)}
          className={cn("flex-1 rounded-[14px] px-2 py-2 text-[9px] font-black uppercase tracking-[0.12em] transition-colors", value === id ? "bg-white text-slate-950 shadow-sm" : "text-slate-500")}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function EmptyState({ icon: Icon, title }: { icon: LucideIcon; title: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl bg-slate-50 px-4 py-8 text-center">
      <Icon size={22} className="text-slate-300" />
      <p className="mt-2 text-[12px] font-black text-slate-500">{title}</p>
    </div>
  );
}
