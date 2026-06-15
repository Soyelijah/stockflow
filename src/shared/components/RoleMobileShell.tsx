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
  Mail,
  Smartphone,
  type LucideIcon,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
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
    subtitle: "JEFE",
    gradient: "from-amber-500 via-indigo-600 to-indigo-950",
    solid: "from-amber-500 to-amber-600",
    soft: "bg-amber-50 text-amber-600 border-amber-100",
    text: "text-amber-600",
  },
  logistics: {
    label: "Logistica",
    short: "L",
    subtitle: "LOGÍSTICA",
    gradient: "from-blue-500 via-indigo-600 to-indigo-950",
    solid: "from-blue-500 to-blue-600",
    soft: "bg-blue-50 text-blue-600 border-blue-100",
    text: "text-blue-600",
  },
  admin: {
    label: "Admin",
    short: "A",
    subtitle: "ADMIN",
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

  // Bottom Sheet states
  const [selectedApproval, setSelectedApproval] = useState<AnyDoc | null>(null);
  const [selectedDelivery, setSelectedDelivery] = useState<any | null>(null);
  const [selectedBranch, setSelectedBranch] = useState<any | null>(null);
  const [selectedUser, setSelectedUser] = useState<any | null>(null);

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
              {activeTab === "home" && <ManagerHome team={teamMembers} stockAlerts={stockAlerts} salesTotal={salesTotal} ticketCount={ticketCount} onJump={setActiveTab} onOpenApproval={setSelectedApproval} />}
              {activeTab === "team" && <TeamTab team={teamMembers} />}
              {activeTab === "reports" && <ReportsTab salesTotal={salesTotal} ticketCount={ticketCount} team={teamMembers} transactions={todayTx} />}
              {activeTab === "profile" && <RoleProfile role={role} accent={accent} name={profile?.name || "Roberto"} email={profile?.email || ""} onLogout={logout} />}
            </>
          )}
          {role === "logistics" && (
            <>
              {activeTab === "home" && <LogisticsHome deliveries={deliveries} stockAlerts={stockAlerts} onJump={setActiveTab} onOpenDelivery={setSelectedDelivery} />}
              {activeTab === "transfers" && <TransfersTab />}
              {activeTab === "kardex" && <KardexTab movements={data.movements} />}
              {activeTab === "profile" && <RoleProfile role={role} accent={accent} name={profile?.name || "Felipe"} email={profile?.email || ""} onLogout={logout} />}
            </>
          )}
          {role === "admin" && (
            <>
              {activeTab === "home" && <AdminHome branches={branchMetrics} salesTotal={salesTotal} ticketCount={ticketCount} team={teamMembers} stockAlerts={stockAlerts} onJump={setActiveTab} />}
              {activeTab === "branches" && <BranchesTab branches={branchMetrics} onOpenBranch={setSelectedBranch} />}
              {activeTab === "users" && <UsersTab team={teamMembers} onOpenUser={setSelectedUser} />}
              {activeTab === "profile" && <RoleProfile role={role} accent={accent} name={profile?.name || "Andrea"} email={profile?.email || ""} onLogout={logout} />}
            </>
          )}
        </main>

        <RoleBottomNav
          items={tabConfig[role]}
          active={activeTab}
          onChange={setActiveTab}
          fabLabel={fab.label}
          onFab={() => {
            if (role === "manager") {
              // Si es Jefe, al pulsar el FAB abrimos aprobaciones en caso de que hubiese, o navegamos a equipo
              setActiveTab(fab.target);
            } else if (role === "logistics") {
              setActiveTab(fab.target);
            } else {
              setActiveTab(fab.target);
            }
          }}
          FabIcon={FabIcon}
        />

        <ApprovalDetailSheet
          open={!!selectedApproval}
          onClose={() => setSelectedApproval(null)}
          approval={selectedApproval}
          onApprove={() => {}}
          onReject={() => {}}
        />
        <DeliveryDetailSheet
          open={!!selectedDelivery}
          onClose={() => setSelectedDelivery(null)}
          delivery={selectedDelivery}
          onStart={() => {}}
          onComplete={() => {}}
        />
        <BranchDetailSheet
          open={!!selectedBranch}
          onClose={() => setSelectedBranch(null)}
          branch={selectedBranch}
        />
        <UserDetailSheet
          open={!!selectedUser}
          onClose={() => setSelectedUser(null)}
          member={selectedUser}
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
          {rank && (
            <span className={cn(
              "rounded-md px-1.5 py-1 text-[9px] font-black border",
              rank === 1 ? "bg-amber-50 text-amber-600 border-amber-100" : "bg-slate-100 text-slate-400 border-slate-200/50"
            )}>
              {rank === 1 ? "👑 #1" : `#${rank}`}
            </span>
          )}
          <p className="truncate text-[13px] font-extrabold text-slate-900">
            {rank === 1 && <span className="mr-0.5 text-amber-500">👑</span>}
            {member.name}
          </p>
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

function ManagerHome({ team, stockAlerts, salesTotal, ticketCount, onJump, onOpenApproval }: {
  team: any[];
  stockAlerts: AnyDoc[];
  salesTotal: number;
  ticketCount: number;
  onJump: (id: TabId) => void;
  onOpenApproval: (approval: any) => void;
}) {
  const target = Math.max(500000, team.reduce((sum, m) => sum + (m.target || 0), 0) || 500000);
  const topSeller = team[0] || { name: "Sin ventas hoy", sales: 0 };
  const pendingApprovals: any[] = []; // honest empty state
  return (
    <div className="space-y-4">
      <BranchHeroCard
        branch={{ name: "Sucursal Centro" }}
        sales={salesTotal}
        count={ticketCount}
        target={target}
        topSeller={topSeller.sales > 0 ? topSeller : null}
        sellersActive={team.filter((m) => m.status !== "offline").length}
        onClick={() => onJump("team")}
      />
      <QuickActions actions={[
        { icon: "CheckCircle2", label: "Aprobaciones", badge: pendingApprovals.length, palette: "amberSolid", onClick: () => onJump("team") },
        { icon: "Users", label: "Equipo", palette: "indigoSolid", onClick: () => onJump("team") },
        { icon: "Activity", label: "Reportes", palette: "emeraldSolid", onClick: () => onJump("reports") },
        { icon: "Lock", label: "Cierre", palette: "roseSolid" },
      ]} />
      <SectionCard className="mx-4">
        <SectionHeader
          title="Aprobaciones pendientes"
          subtitle="Requieren tu sign-off antes de cerrar"
          action={<Pill kind="warning" pulse={pendingApprovals.length > 0}>{pendingApprovals.length} pendientes</Pill>}
        />
        {pendingApprovals.length > 0 ? (
          <div className="flex flex-col gap-2">
            {pendingApprovals.map((a) => (
              <React.Fragment key={a.id}>
                <ApprovalRow approval={a} onTap={onOpenApproval} />
              </React.Fragment>
            ))}
          </div>
        ) : (
          <EmptyState icon={Check} title="Sin aprobaciones — módulo pendiente" />
        )}
      </SectionCard>
      <SectionCard className="mx-4">
        <SectionHeader title="Ranking del día" subtitle="Por monto vendido" action={<button type="button" onClick={() => onJump("team")} className="text-[10px] font-black uppercase tracking-[0.12em] text-indigo-600">Ver equipo</button>} />
        <div className="space-y-2">
          {team.slice(0, 3).map((m, i) => (
            <React.Fragment key={m.id}>
              <TeamRow member={m} rank={i + 1} compact />
            </React.Fragment>
          ))}
        </div>
      </SectionCard>
      <SectionCard className="mx-4">
        <SectionHeader title="Alertas de stock" subtitle="En tu sucursal" action={<Pill kind="danger">{stockAlerts.length} críticos</Pill>} />
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

function ReportsTab({ salesTotal, ticketCount, team, transactions }: {
  salesTotal: number;
  ticketCount: number;
  team: any[];
  transactions: AnyDoc[];
}) {
  const paymentTotals = useMemo(() => {
    const totals = { efectivo: 0, tarjeta: 0, transferencia: 0, digital: 0 };
    transactions.forEach((tx) => {
      const method = String(tx.paymentMethod || tx.method || "efectivo").toLowerCase();
      const amount = txAmount(tx);
      if (method.includes("efectivo") || method === "cash") {
        totals.efectivo += amount;
      } else if (method.includes("tarjeta") || method === "card" || method.includes("debito") || method.includes("credito")) {
        totals.tarjeta += amount;
      } else if (method.includes("transferencia") || method === "transfer") {
        totals.transferencia += amount;
      } else {
        totals.digital += amount;
      }
    });
    return totals;
  }, [transactions]);

  const hourlySales = useMemo(() => {
    const buckets = Array.from({ length: 8 }, () => ({ v: 0 }));
    transactions.forEach((tx) => {
      const d = toDate(tx.timestamp ?? tx.createdAt ?? tx.date);
      const h = d.getHours();
      const idx = Math.min(7, Math.floor(h / 3));
      buckets[idx].v += txAmount(tx);
    });
    return buckets;
  }, [transactions]);

  return (
    <div className="space-y-4 px-4">
      <div className="flex items-center justify-between">
        <h1 className="text-[22px] font-black tracking-[-0.025em] text-slate-950">Reportes</h1>
        <Pill kind="accent">Hoy · {new Date().toLocaleDateString("es-CL")}</Pill>
      </div>
      <Segmented value="day" onChange={() => undefined} options={[["day", "Día"], ["week", "Semana"], ["month", "Mes"]]} />
      <div className="grid grid-cols-2 gap-2.5">
        <StatTile label="Ingresos totales" value={formatCurrency(salesTotal)} sparkData={hourlySales} icon="TrendingUp" palette="indigo" />
        <StatTile label="Tickets emitidos" value={ticketCount} sparkData={hourlySales} icon="Receipt" palette="emerald" />
        <StatTile label="Ticket promedio" value={formatCurrency(ticketCount ? salesTotal / ticketCount : 0)} icon="Coins" palette="amber" />
        <StatTile label="Equipo activo" value={team.length} icon="Users" palette="purple" />
      </div>
      <SectionCard>
        <SectionHeader title="Método de pago" subtitle="Distribución del día" action={<IconChip name="PieChart" palette="indigo" size={32} icSize={14} />} />
        <div className="flex items-center gap-4 py-2">
          <PaymentDonut byMethod={paymentTotals} total={salesTotal} />
          <div className="flex-1 flex flex-col gap-2.5">
            {[
              { k: "Tarjetas", v: paymentTotals.tarjeta, color: "#3b82f6" },
              { k: "Virtual / MP", v: paymentTotals.digital, color: "#6366f1" },
              { k: "Transferencia", v: paymentTotals.transferencia, color: "#f59e0b" },
              { k: "Efectivo", v: paymentTotals.efectivo, color: "#10b981" },
            ].map((r) => {
              const pct = salesTotal ? Math.round((r.v / salesTotal) * 100) : 0;
              return (
                <div key={r.k} className="flex items-center gap-2">
                  <span className="size-2 rounded-full shrink-0" style={{ backgroundColor: r.color }} />
                  <span className="flex-1 text-[9px] font-black uppercase tracking-wider text-slate-400 truncate">{r.k}</span>
                  <span className="font-mono text-[11px] font-black text-slate-900 tabular-nums">{formatCurrency(r.v)}</span>
                  <span className="text-[10px] font-black text-slate-400 w-8 text-right tabular-nums">{pct}%</span>
                </div>
              );
            })}
          </div>
        </div>
      </SectionCard>
    </div>
  );
}

function LogisticsHome({ deliveries, stockAlerts, onJump, onOpenDelivery }: {
  deliveries: any[];
  stockAlerts: AnyDoc[];
  onJump: (id: TabId) => void;
  onOpenDelivery: (delivery: any) => void;
}) {
  const pending = deliveries.filter((d) => d.status === "pending").length;
  const inTransit = deliveries.filter((d) => d.status === "intransit").length;
  const delivered = deliveries.filter((d) => d.status === "delivered").length;
  const total = deliveries.length;
  const progress = total > 0 ? delivered / total : 0;
  return (
    <div className="space-y-4">
      <div
        className="mx-4 rounded-[32px] p-5 text-white shadow-[0_28px_60px_-24px_rgba(59,130,246,0.5)]"
        style={{
          background:
            "radial-gradient(120% 80% at 0% 0%, #818cf8 0%, transparent 50%), " +
            "radial-gradient(120% 80% at 100% 0%, #4f46e5 0%, transparent 55%), " +
            "linear-gradient(180deg, #1e1b4b 0%, #0f172a 100%)",
        }}
      >
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-white/80">
              <Truck size={14} className="text-indigo-300" /> Ruta del día
            </div>
            <p className="mt-4 text-[11px] font-black uppercase tracking-[0.18em] text-white/55">Entregas asignadas</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/10 px-3 py-2 text-[10px] font-black flex items-center gap-1.5 backdrop-blur-md">
            <Activity size={12} className="text-amber-400" />
            <span>ETA total 2h 34m</span>
          </div>
        </div>
        <div className="mt-3 flex items-end justify-between">
          <div>
            <span className="text-[56px] font-black leading-none tabular-nums">{delivered}</span>
            <span className="text-[24px] font-black text-white/40 tabular-nums">/{total}</span>
            <div className="mt-3 flex gap-2">
              <Pill kind="dark">{pending} pendientes</Pill>
              <Pill kind="dark">{inTransit} en ruta</Pill>
            </div>
          </div>
          <ProgressRing size={76} stroke={6} progress={progress} fg="#34d399" bg="rgba(255,255,255,0.18)">
            <div className="flex flex-col items-center justify-center">
              <Check size={20} className="text-emerald-400 animate-pulse" strokeWidth={3} />
              <span className="text-[7px] font-black uppercase tracking-[0.16em] text-white/60 mt-1">Done</span>
            </div>
          </ProgressRing>
        </div>
        {/* Mini progress bar timeline */}
        <div className="mt-4 border-t border-white/10 pt-4">
          <div className="flex h-1.5 items-center gap-1 overflow-hidden rounded-full bg-white/10">
            <div style={{ flex: delivered || 0.001 }} className="h-full bg-gradient-to-r from-emerald-400 to-emerald-500 rounded-l-full" />
            <div style={{ flex: inTransit || 0.001 }} className="h-full bg-gradient-to-r from-amber-400 to-amber-500" />
            <div style={{ flex: pending || 0.001 }} className="h-full bg-white/20 rounded-r-full" />
          </div>
          <div className="mt-2.5 flex items-center justify-between">
            <span className="text-[9px] font-black uppercase tracking-[0.14em] text-white/50">Próxima entrega</span>
            <span className="text-[11px] font-black text-white">11:30 · Distribuidora El Roble</span>
          </div>
        </div>
      </div>
      <QuickActions actions={[
        { icon: "Truck", label: "Entregas", badge: pending, palette: "amberSolid", onClick: () => onJump("home") },
        { icon: "RefreshCw", label: "Traslados", palette: "indigoSolid", onClick: () => onJump("transfers") },
        { icon: "Package", label: "Recepción", palette: "emeraldSolid", onClick: () => onJump("kardex") },
        { icon: "Camera", label: "Escanear", palette: "purpleSolid" },
      ]} />
      <SectionCard className="mx-4">
        <SectionHeader title="Entregas de hoy" subtitle={`${pending} pendientes · ${inTransit} en ruta · ${delivered} entregadas`} action={<Pill kind="warning">{pending + inTransit} activas</Pill>} />
        <div className="space-y-2">
          {deliveries.slice(0, 4).map((d) => (
            <React.Fragment key={d.id}>
              <DeliveryRow delivery={d} onTap={onOpenDelivery} />
            </React.Fragment>
          ))}
        </div>
      </SectionCard>
      <SectionCard className="mx-4">
        <SectionHeader title="Stock crítico · todas las sucursales" subtitle="Requieren reabastecimiento" action={<Pill kind="danger">{stockAlerts.length} SKUs</Pill>} />
        <div className="space-y-0.5">
          {stockAlerts.map((p) => (
            <React.Fragment key={p.id}>
              <StockAlertRow product={p} />
            </React.Fragment>
          ))}
        </div>
        <button
          type="button"
          className="sf-tap flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-br from-indigo-600 to-indigo-500 text-[11px] font-black uppercase tracking-[0.14em] text-white shadow-lg shadow-indigo-600/30 mt-4"
        >
          <Plus size={14} strokeWidth={2.8} /> Generar orden de reposición
        </button>
      </SectionCard>
    </div>
  );
}

function DeliveryRow({ delivery, onTap }: { delivery: any; onTap?: (delivery: any) => void }) {
  const status = delivery.status === "delivered" ? "Entregada" : delivery.status === "intransit" ? "En ruta" : "Pendiente";
  const pillKind = delivery.status === "delivered" ? "success" : delivery.status === "intransit" ? "warning" : "accent";
  return (
    <div
      onClick={() => onTap?.(delivery)}
      className="sf-press flex items-center gap-3 rounded-[18px] border border-slate-100 bg-white px-3 py-3 shadow-sm cursor-pointer hover:border-slate-200 transition-colors"
    >
      <IconChip
        name="Truck"
        palette={delivery.status === "delivered" ? "emeraldSolid" : delivery.status === "intransit" ? "amberSolid" : "indigoSolid"}
        size={42}
        icSize={18}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="rounded-md bg-indigo-50 px-1.5 py-0.5 font-mono text-[10px] font-bold text-indigo-600 border border-indigo-100/50">{delivery.code}</span>
          <Pill kind={pillKind}>{status}</Pill>
        </div>
        <p className="mt-1 truncate text-[13px] font-extrabold text-slate-900">{delivery.customer}</p>
        <p className="mt-1 truncate text-[10px] font-bold text-slate-400">{delivery.address}</p>
      </div>
      <div className="text-right">
        <p className="text-[14px] font-black text-slate-900 tabular-nums">{delivery.eta}</p>
        <p className="mt-1 text-[10px] font-bold text-slate-400">{delivery.items} ítems</p>
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
      
      {/* Transfers Tab KPI tiles: en cero real ya que no hay traslados */}
      <div className="grid grid-cols-3 gap-2 rounded-[22px] border border-slate-100 bg-white p-3 shadow-sm">
        <MiniStat label="Pendientes" value="0" accent="indigo" />
        <MiniStat label="En ruta" value="0" accent="amber" />
        <MiniStat label="Hoy total" value="0" accent="emerald" />
      </div>

      <EmptyState icon={RefreshCw} title="Sin traslados — módulo pendiente" />
    </div>
  );
}

function KardexTab({ movements }: { movements: AnyDoc[] }) {
  const [filter, setFilter] = useState("all");

  const rows = useMemo(() => {
    return movements
      .map((m) => {
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
      })
      .filter((k) => {
        if (filter === "all") return true;
        if (filter === "sale") return k.type === "sale";
        if (filter === "transfer") return k.type === "transfer";
        if (filter === "receive") return k.type === "receive" || k.type === "adjustment";
        if (filter === "adjust") return k.type === "adjustment" || k.type === "adjust";
        return true;
      });
  }, [movements, filter]);

  return (
    <div className="space-y-4 px-4">
      <div className="flex items-center justify-between">
        <h1 className="text-[22px] font-black tracking-[-0.025em] text-slate-950">Kardex</h1>
        <Pill kind="accent">Sucursal Centro</Pill>
      </div>
      <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-2 scrollbar-none">
        {[
          { id: "all", label: "Todos" },
          { id: "sale", label: "Ventas" },
          { id: "transfer", label: "Traslados" },
          { id: "receive", label: "Recepción" },
          { id: "adjust", label: "Ajustes" },
        ].map((f) => {
          const active = filter === f.id;
          return (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={cn(
                "shrink-0 rounded-full border px-3 py-2 text-[10px] font-black uppercase tracking-[0.1em] transition-colors",
                active
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-slate-100 bg-white text-slate-500 hover:border-slate-200"
              )}
            >
              {f.label}
            </button>
          );
        })}
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

function AdminHome({ branches, salesTotal, ticketCount, team, stockAlerts, onJump }: {
  branches: any[];
  salesTotal: number;
  ticketCount: number;
  team: any[];
  stockAlerts: AnyDoc[];
  onJump: (id: TabId) => void;
}) {
  const target = branches.reduce((sum, b) => sum + b.target, 0) || 2000000;
  const teamCount = team.length;
  const pausedCount = team.filter((m) => m.status === "break").length;
  return (
    <div className="space-y-4">
      <div className="mx-4 rounded-[32px] bg-gradient-to-br from-purple-500 via-indigo-700 to-indigo-950 p-5 text-white shadow-[0_28px_60px_-24px_rgba(147,51,234,0.5)]">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-white/80">
              <ShieldCheck size={14} className="text-purple-300" /> Vista global
            </div>
            <p className="mt-4 text-[11px] font-black uppercase tracking-[0.18em] text-white/55">Ingresos consolidados · hoy</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/10 px-3 py-2 text-[10px] font-black backdrop-blur-md">
            {branches.length} sucursales
          </div>
        </div>
        <div className="mt-2 flex items-end justify-between gap-4">
          <div className="min-w-0 flex-1">
            <MoneyTicker value={salesTotal} animate prefix="$" className="block text-[36px] font-black leading-none tracking-[-0.03em]" />
            <div className="mt-3 flex items-center gap-2">
              <Pill kind="dark">{ticketCount} tickets</Pill>
              <span className="text-[11px] font-bold text-white/65">meta {formatCurrency(target)}</span>
            </div>
          </div>
          <ProgressRing size={76} stroke={6} progress={Math.min(1, salesTotal / Math.max(1, target))} fg="#ffffff" bg="rgba(255,255,255,0.18)">
            <span className="text-[16px] font-black">{Math.round(Math.min(1, salesTotal / Math.max(1, target)) * 100)}%</span>
          </ProgressRing>
        </div>
        {/* GlassStats: Crecimiento omitido por falta de histórico real, ajustamos a 2 columnas */}
        <div className="mt-4 grid grid-cols-2 gap-2">
          <GlassStat label="Equipo" value={String(teamCount)} sub="personas" />
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
        <div className="space-y-3">
          {branches.map((b, i) => (
            <React.Fragment key={b.id}>
              <BranchRow branch={b} rank={i + 1} />
            </React.Fragment>
          ))}
        </div>
      </SectionCard>
      <div className="grid grid-cols-2 gap-2.5 px-4">
        <StatTile label="Ingresos totales" value={formatCurrency(salesTotal)} icon="TrendingUp" palette="indigo" />
        <StatTile label="Tickets emitidos" value={ticketCount} icon="Receipt" palette="emerald" />
        <StatTile label="Equipo activo" value={`${teamCount} pers.`} delta={pausedCount ? `${pausedCount} en pausa` : undefined} deltaPositive={false} icon="Users" palette="purple" />
        <StatTile label="Stock crítico" value={stockAlerts.length} icon="AlertTriangle" palette="amber" />
      </div>
      {/* Admin alerts: empty-state honesto */}
      <SectionCard className="mx-4">
        <SectionHeader title="Avisos del negocio" subtitle="Eventos importantes" action={<Pill kind="accent">0</Pill>} />
        <EmptyState icon={Bell} title="Sin avisos de negocio" />
      </SectionCard>
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

function BranchesTab({ branches, onOpenBranch }: { branches: any[]; onOpenBranch: (b: any) => void }) {
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
        <MiniStat label="Necesita Atención" value={String(branches.filter((b) => b.status === "attention").length)} accent="amber" />
      </div>
      <div className="space-y-3">{branches.map((b, i) => (
        <React.Fragment key={b.id}>
          <BranchCard branch={b} rank={i + 1} onTap={onOpenBranch} />
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
        <div className="mt-1.5 flex justify-between"><span className="text-[9px] font-bold uppercase tracking-[0.12em] text-slate-400">{branch.txns} tickets · {branch.sellers} pers.</span></div>
      </div>
    </div>
  );
}

function BranchCard({ branch, rank, onTap }: { branch: any; rank: number; onTap?: (b: any) => void }) {
  const progress = Math.min(1, branch.sales / Math.max(1, branch.target));
  return (
    <div
      onClick={() => onTap?.(branch)}
      className="sf-press rounded-[22px] border border-slate-100 bg-white p-4 shadow-sm cursor-pointer hover:border-slate-200 transition-colors"
    >
      <div className="flex items-center gap-3">
        <IconChip name="Building2" palette="indigoSolid" size={46} icSize={20} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5"><span className={cn("rounded-md px-1.5 py-1 text-[9px] font-black", rank === 1 ? "bg-amber-50 text-amber-500" : "bg-slate-100 text-slate-400")}>#{rank}</span><p className="text-[14px] font-black text-slate-900">Sucursal {branch.name}</p></div>
          <p className="mt-1 text-[11px] font-bold text-slate-400">{branch.sellers} personas · {branch.txns} tickets</p>
        </div>
        <Pill kind={branch.status === "healthy" ? "success" : "warning"}>{branch.status === "healthy" ? "OK" : "Atención"}</Pill>
      </div>
      <div className="mt-4">
        <div className="mb-1.5 flex justify-between"><span className="text-[9px] font-black uppercase tracking-[0.12em] text-slate-400">Cumplimiento meta</span><span className="text-[11px] font-black text-indigo-600">{formatCurrency(branch.sales)} / {formatCurrency(branch.target)}</span></div>
        <div className="h-2.5 overflow-hidden rounded-full bg-slate-100"><div className={cn("h-full rounded-full", branch.status === "healthy" ? "bg-gradient-to-r from-indigo-500 to-indigo-600" : "bg-gradient-to-r from-amber-500 to-amber-600")} style={{ width: `${progress * 100}%` }} /></div>
        <div className="mt-1.5 flex justify-between"><span className="text-[9px] font-black uppercase tracking-[0.12em] text-slate-400">{Math.round(progress * 100)}% completado</span></div>
      </div>
    </div>
  );
}

function UsersTab({ team, onOpenUser }: { team: any[]; onOpenUser: (u: any) => void }) {
  return (
    <div className="space-y-4 px-4">
      <div className="flex items-center justify-between">
        <h1 className="text-[22px] font-black tracking-[-0.025em] text-slate-950">Equipo global</h1>
        <Pill kind="accent">{team.length} usuarios</Pill>
      </div>
      <Segmented value="all" onChange={() => undefined} options={[["all", "Todos"], ["seller", "Vendedores"], ["cashier", "Cajeros"]]} />
      <div className="space-y-2">{team.map((m) => (
        <React.Fragment key={m.id}>
          <UserRow member={m} onTap={onOpenUser} />
        </React.Fragment>
      ))}</div>
      <button type="button" className="sf-tap flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-br from-indigo-600 to-indigo-500 text-[11px] font-black uppercase tracking-[0.14em] text-white shadow-[0_10px_22px_-6px_rgba(79,70,229,0.55)]"><Plus size={14} /> Invitar a nuevo usuario</button>
    </div>
  );
}

function UserRow({ member, onTap }: { member: any; onTap?: (m: any) => void }) {
  return (
    <div
      onClick={() => onTap?.(member)}
      className="sf-press flex items-center gap-3 rounded-[18px] border border-slate-100 bg-white px-3 py-3 shadow-sm cursor-pointer hover:border-slate-200 transition-colors"
    >
      <Avatar initial={member.initial} size={42} palette="indigoSolid" />
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-extrabold text-slate-900">{member.name}</p>
        <div className="mt-1 flex items-center gap-1.5"><Pill kind="accent">{member.role}</Pill><span className="text-[10px] font-bold text-slate-400">Sucursal Centro</span></div>
      </div>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onTap?.(member); }}
        className="sf-tap grid size-9 place-items-center rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
      ><Settings size={14} /></button>
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

// =================== Visual & Bottom Sheet Helper Components ===================

interface SheetShellProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  height?: string;
  dark?: boolean;
}

function SheetShell({ open, onClose, title, subtitle, children, height = "auto", dark = false }: SheetShellProps) {
  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop Scrim */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 z-50 bg-slate-950/40 backdrop-blur-[1.5px]"
          />
          {/* Sliding Sheet Container (Absolute to stay within the max-w-[430px] frame) */}
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 26, stiffness: 220 }}
            style={{ height }}
            className={cn(
              "absolute bottom-0 left-0 right-0 z-50 flex flex-col rounded-t-[30px] shadow-[0_-16px_40px_rgba(15,23,42,0.18)] max-h-[90%] overflow-hidden",
              dark ? "bg-slate-950 text-white" : "bg-white text-slate-900"
            )}
          >
            {/* Slide Handle */}
            <div className={cn("mx-auto my-3.5 h-1 w-10 shrink-0 rounded-full", dark ? "bg-white/20" : "bg-slate-200")} />

            {/* Header */}
            <div className="flex items-start justify-between px-6 pb-3 pt-1 shrink-0">
              <div>
                {title && (
                  <h3 className={cn("text-[18px] font-black tracking-tight leading-tight", dark ? "text-white" : "text-slate-900")}>
                    {title}
                  </h3>
                )}
                {subtitle && (
                  <p className={cn("mt-1.5 text-[9px] font-black uppercase tracking-[0.14em]", dark ? "text-white/60" : "text-slate-400")}>
                    {subtitle}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={onClose}
                className={cn(
                  "sf-tap flex size-8 items-center justify-center rounded-xl transition-colors",
                  dark ? "bg-white/10 hover:bg-white/15 text-white" : "bg-slate-100 hover:bg-slate-200 text-slate-500"
                )}
              >
                <X size={14} />
              </button>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto px-6 pb-8 pt-2 scrollbar-none">
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function BranchHeroCard({ branch, sales, count, target, topSeller, sellersActive, onClick }: {
  branch: any;
  sales: number;
  count: number;
  target: number;
  topSeller: any;
  sellersActive: number;
  onClick?: () => void;
}) {
  const progress = Math.min(1, sales / Math.max(1, target));
  return (
    <div className="mx-4 overflow-hidden rounded-[32px] bg-gradient-to-br from-indigo-500 via-indigo-700 to-indigo-950 p-5 text-white shadow-[0_28px_60px_-24px_rgba(67,56,202,0.6)]">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-white/80">
            <Building2 size={14} className="text-indigo-300" />
            <span>{branch?.name || "Sucursal"}</span>
          </div>
          <p className="mt-4 text-[11px] font-black uppercase tracking-[0.18em] text-white/55">
            Ventas de la sucursal · hoy
          </p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/10 px-3 py-2 text-[10px] font-black flex items-center gap-1.5 backdrop-blur-md">
          <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span>{sellersActive} vend. activos</span>
        </div>
      </div>
      <div className="mt-2 flex items-end justify-between gap-4">
        <div className="min-w-0 flex-1">
          <MoneyTicker value={sales} animate style={{ font: "900 38px/1 Inter", color: "white", letterSpacing: "-0.03em", display: "block" }} />
          <div className="mt-3 flex items-center gap-2">
            <Pill kind="dark">{count} tickets</Pill>
            <span className="text-[11px] font-bold text-white/65">de {formatCurrency(target)} meta</span>
          </div>
        </div>
        <ProgressRing size={76} stroke={6} progress={progress} fg="#ffffff" bg="rgba(255,255,255,0.18)">
          <div className="text-center flex flex-col items-center">
            <p className="text-[16px] font-black leading-none">{Math.round(progress * 100)}%</p>
            <p className="mt-1 text-[7px] font-black uppercase tracking-[0.16em] text-white/60">Meta</p>
          </div>
        </ProgressRing>
      </div>
      {topSeller && (
        <button
          type="button"
          onClick={onClick}
          className="mt-4 flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-white/10 p-3 text-left hover:bg-white/15 transition-colors"
        >
          <div className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-amber-500 text-white shadow-[0_4px_10px_rgba(245,158,11,0.3)]">
            <Star size={16} fill="currentColor" strokeWidth={0} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[9px] font-black uppercase tracking-[0.14em] text-white/60">Top vendedor</p>
            <p className="mt-1 truncate text-[13px] font-black">{topSeller.name} · {formatCurrency(topSeller.sales)}</p>
          </div>
          <ChevronRight size={14} className="text-white/60" />
        </button>
      )}
    </div>
  );
}

function ApprovalRow({ approval, onTap }: { approval: any; onTap?: (app: any) => void }) {
  const palette = approval.risk === "high" ? "roseSolid" : approval.risk === "med" ? "amberSolid" : "blueSolid";
  const ic = approval.type === "refund" ? "RefreshCw" : approval.type === "discount" ? "Tag" : "Lock";
  return (
    <div
      onClick={() => onTap?.(approval)}
      className="sf-press flex items-center gap-3 rounded-[18px] border border-slate-100 bg-white px-3 py-3 shadow-sm cursor-pointer hover:border-slate-200 transition-colors"
    >
      <IconChip name={ic} palette={palette} size={42} icSize={18} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className="truncate text-[13px] font-extrabold text-slate-900">{approval.title}</p>
          {approval.risk === "high" && <Pill kind="danger">alto</Pill>}
        </div>
        <p className="mt-1 text-[11px] font-bold text-slate-500">{approval.detail}</p>
        <div className="mt-1 flex items-center gap-1.5 text-[10px] font-bold text-slate-400">
          <span>{approval.seller}</span>
          <span className="size-1 rounded-full bg-slate-300" />
          <span>{approval.time}</span>
        </div>
      </div>
      <div className="flex gap-1.5 shrink-0">
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); }}
          className="sf-tap flex size-9 items-center justify-center rounded-xl bg-slate-100 text-slate-400 hover:bg-slate-200 transition-colors"
        >
          <X size={14} />
        </button>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); }}
          className="sf-tap flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-md shadow-emerald-500/20 hover:from-emerald-600 hover:to-emerald-700 transition-all"
        >
          <Check size={14} strokeWidth={3} />
        </button>
      </div>
    </div>
  );
}

function PaymentDonut({ byMethod, total }: {
  byMethod: { efectivo: number; tarjeta: number; transferencia: number; digital: number };
  total: number;
}) {
  const size = 96;
  const stroke = 14;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const segments = [
    { v: byMethod.efectivo || 0, color: "#10b981" },
    { v: byMethod.tarjeta || 0, color: "#3b82f6" },
    { v: byMethod.transferencia || 0, color: "#f59e0b" },
    { v: byMethod.digital || 0, color: "#6366f1" },
  ];
  const [animate, setAnimate] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setAnimate(true), 30);
    return () => clearTimeout(id);
  }, []);
  let offset = 0;
  return (
    <div className="relative shrink-0 flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="rotate-[-90deg]">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#f1f5f9" strokeWidth={stroke} />
        {segments.map((seg, i) => {
          const pct = total ? seg.v / total : 0;
          const len = c * pct;
          const dashArray = `${animate ? len : 0} ${c}`;
          const dashOffset = -offset;
          offset += animate ? len : 0;
          return (
            <circle
              key={i}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={seg.color}
              strokeWidth={stroke}
              strokeDasharray={dashArray}
              strokeDashoffset={dashOffset}
              strokeLinecap="round"
              className="transition-[stroke-dasharray] duration-1000 ease-out"
              style={{ transitionDelay: `${i * 100}ms` }}
            />
          );
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
        <span className="text-[8px] font-black uppercase tracking-[0.14em] text-slate-400">Total</span>
        <span className="text-[12px] font-black text-slate-900 mt-1 tabular-nums">
          {total >= 1000 ? `${Math.round(total / 1000)}k` : formatCurrency(total)}
        </span>
      </div>
    </div>
  );
}

function Toggle({ on, onChange, disabled }: { on: boolean; onChange?: (val: boolean) => void; disabled?: boolean }) {
  const [active, setActive] = useState(on);
  useEffect(() => {
    setActive(on);
  }, [on]);
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => {
        if (disabled) return;
        const next = !active;
        setActive(next);
        onChange?.(next);
      }}
      className={cn(
        "relative w-10 h-6 rounded-full p-0.5 transition-colors duration-200 focus:outline-none flex items-center",
        active ? "bg-emerald-500" : "bg-slate-200",
        disabled && "opacity-60 cursor-not-allowed"
      )}
    >
      <div
        className={cn(
          "bg-white w-5 h-5 rounded-full shadow-md transform transition-transform duration-200",
          active ? "translate-x-4" : "translate-x-0"
        )}
      />
    </button>
  );
}

// =================== Detail Sheet Components ===================

function ApprovalDetailSheet({ open, onClose, approval, onApprove, onReject }: {
  open: boolean;
  onClose: () => void;
  approval: any;
  onApprove: (app: any) => void;
  onReject: (app: any) => void;
}) {
  if (!approval) return null;
  const ic = approval.type === "refund" ? "RefreshCw" : approval.type === "discount" ? "Tag" : "Lock";
  const palette = approval.risk === "high" ? "roseSolid" : approval.risk === "med" ? "amberSolid" : "blueSolid";
  return (
    <SheetShell open={open} onClose={onClose} title={approval.title} subtitle="Aprobación requerida">
      <div className="flex flex-col gap-3.5">
        <div className="flex items-center gap-3.5 rounded-2xl border border-slate-100 bg-gradient-to-br from-slate-50 to-white p-4">
          <IconChip name={ic} palette={palette} size={56} icSize={24} />
          <div className="min-w-0 flex-1">
            <h4 className="text-[16px] font-black leading-tight tracking-tight text-slate-900">{approval.detail}</h4>
            <div className="mt-1.5 flex items-center gap-2">
              <Pill kind={approval.risk === "high" ? "danger" : approval.risk === "med" ? "warning" : "info"}>
                riesgo {approval.risk === "high" ? "alto" : approval.risk === "med" ? "medio" : "bajo"}
              </Pill>
              <span className="text-[11px] font-bold text-slate-400">{approval.time}</span>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-100 bg-white p-3.5 shadow-sm">
          <p className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-400 mb-3">Solicitado por</p>
          <div className="flex items-center gap-3">
            <Avatar initial={approval.seller?.charAt(0)} size={44} palette="indigoSolid" />
            <div className="flex-1">
              <p className="text-[13px] font-black text-slate-900">{approval.seller}</p>
              <p className="mt-1 text-[11px] font-bold text-slate-400">Vendedor · Sucursal Centro</p>
            </div>
            <button type="button" className="sf-tap flex size-9 items-center justify-center rounded-xl bg-slate-100 text-slate-600"><Mail size={14} /></button>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-100 bg-white p-3.5 shadow-sm">
          <p className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-400 mb-3">Contexto</p>
          {[
            { k: "Tipo", v: approval.type === "refund" ? "Devolución" : approval.type === "discount" ? "Descuento" : "Cierre de caja" },
            { k: "Sucursal", v: "Centro" },
            { k: "Turno", v: "08:30 → en curso" },
            { k: "Motivo", v: approval.type === "refund" ? "Producto en mal estado" : approval.type === "discount" ? "Cliente VIP" : "Diferencia de caja" },
            { k: "Monto", v: approval.detail?.match(/\$[\d.,]+/)?.[0] || "—", mono: true },
          ].map((r, i) => (
            <div key={i} className="flex justify-between items-center py-1.5 border-b border-slate-100 last:border-b-0">
              <span className="text-[10px] font-black uppercase tracking-[0.10em] text-slate-400">{r.k}</span>
              <span className={cn("text-[12px] font-black text-slate-900", r.mono && "font-mono")}>{r.v}</span>
            </div>
          ))}
        </div>

        <div className="rounded-2xl border border-slate-100 bg-white p-3.5 shadow-sm">
          <p className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-400 mb-2">Nota interna (opcional)</p>
          <textarea
            placeholder="Agrega un comentario antes de aprobar…"
            disabled
            className="w-full min-h-[60px] p-3 font-sans text-[13px] font-medium border border-slate-100 rounded-xl bg-slate-50 outline-none resize-none text-slate-950 placeholder-slate-400"
          />
        </div>

        <div className="grid grid-cols-2 gap-2 mt-1">
          <button
            type="button"
            onClick={() => { onReject(approval); onClose(); }}
            className="sf-tap flex h-[50px] items-center justify-center gap-1.5 rounded-2xl border border-rose-200 bg-white text-[11px] font-black uppercase tracking-[0.14em] text-rose-600 hover:bg-rose-50/50 transition-colors"
          >
            <X size={14} strokeWidth={3} /> Rechazar
          </button>
          <button
            type="button"
            onClick={() => { onApprove(approval); onClose(); }}
            className="sf-tap flex h-[50px] items-center justify-center gap-1.5 rounded-2xl border border-transparent bg-gradient-to-br from-emerald-500 to-emerald-600 text-[11px] font-black uppercase tracking-[0.14em] text-white shadow-lg shadow-emerald-500/20 hover:from-emerald-600 hover:to-emerald-700 transition-all"
          >
            <Check size={14} strokeWidth={3} /> Aprobar
          </button>
        </div>
      </div>
    </SheetShell>
  );
}

function DeliveryDetailSheet({ open, onClose, delivery, onStart, onComplete }: {
  open: boolean;
  onClose: () => void;
  delivery: any;
  onStart: (d: any) => void;
  onComplete: (d: any) => void;
}) {
  if (!delivery) return null;
  const isPending = delivery.status === "pending";
  const isInTransit = delivery.status === "intransit";
  const isDelivered = delivery.status === "delivered";

  return (
    <SheetShell open={open} onClose={onClose} title={delivery.code} subtitle="Detalle de entrega" height="88%">
      <div className="flex flex-col gap-3.5">
        {/* Fake decorative SVG map layout */}
        <div className="relative h-40 rounded-2xl overflow-hidden bg-slate-950 border border-white/5 flex flex-col justify-between p-4">
          <div className="absolute inset-0 opacity-15">
            <svg width="100%" height="100%">
              <defs>
                <pattern id="fake-map-grid" width="20" height="20" patternUnits="userSpaceOnUse">
                  <path d="M20 0H0V20" fill="none" stroke="white" strokeWidth="0.5" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#fake-map-grid)" />
            </svg>
          </div>
          <svg className="absolute inset-0 w-full h-full pointer-events-none">
            <path
              d="M 30 110 Q 120 40, 200 90 T 360 40"
              stroke="rgba(165,180,252,0.4)"
              strokeWidth="2.5"
              fill="none"
              strokeDasharray="6 4"
            />
          </svg>
          <div className="relative z-10 flex items-center gap-2 bg-slate-900/80 border border-white/10 px-3 py-1.5 rounded-xl self-start backdrop-blur-md">
            <Activity size={12} className="text-amber-400 animate-pulse" />
            <div className="leading-none text-left">
              <span className="text-[7px] font-black uppercase tracking-wider text-white/50 block">Ruta Estimada</span>
              <span className="text-[11px] font-black text-white mt-0.5 block">{delivery.eta} · 2.4 km</span>
            </div>
          </div>
          <div className="relative z-10 flex justify-between items-center w-full mt-auto">
            <div className="flex items-center gap-1.5 text-white">
              <span className="size-3 rounded-full bg-emerald-400 border border-white animate-ping absolute" />
              <span className="size-3 rounded-full bg-emerald-400 border border-white relative" />
              <span className="text-[8px] font-black uppercase tracking-wider">Bodega</span>
            </div>
            <div className="flex items-center gap-1.5 bg-gradient-to-r from-amber-500 to-amber-600 border border-white/20 p-2 rounded-xl text-white shadow-lg">
              <Building2 size={13} />
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-100 bg-white p-3.5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <Pill kind={isDelivered ? "success" : isInTransit ? "warning" : "accent"}>
              {isDelivered ? "Entregada" : isInTransit ? "En ruta" : "Pendiente"}
            </Pill>
            <span className="font-mono text-[10px] font-bold text-slate-400">{delivery.code}</span>
          </div>
          <div className="flex items-center gap-3">
            <Avatar initial={delivery.customer?.charAt(0)} size={44} palette="purpleSolid" />
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-black text-slate-900 truncate">{delivery.customer}</p>
              <p className="mt-1 text-[11px] font-bold text-slate-500 leading-tight">{delivery.address}</p>
            </div>
            <button type="button" className="sf-tap flex size-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition-colors">
              <Smartphone size={16} />
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-100 bg-white p-3.5 shadow-sm">
          <p className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-400 mb-3">Detalle de Carga</p>
          <div className="grid grid-cols-3 gap-2">
            <MiniStat label="Ítems" value={String(delivery.items)} accent="indigo" />
            <MiniStat label="Peso" value="14.2 kg" accent="emerald" />
            <MiniStat label="Origen" value="Centro" accent="blue" />
          </div>
        </div>

        <div className="rounded-2xl border border-slate-100 bg-white p-3.5 shadow-sm">
          <p className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-400 mb-3">Línea de Tiempo</p>
          {[
            { lbl: "Orden generada", time: "08:15", done: true },
            { lbl: "Preparada en bodega", time: "09:42", done: true },
            { lbl: "En ruta de reparto", time: "10:30", done: isInTransit || isDelivered },
            { lbl: "Entregada", time: delivery.eta, done: isDelivered },
          ].map((step, i, arr) => (
            <div key={i} className="flex gap-3 relative last:pb-0 pb-3">
              <div className="flex flex-col items-center">
                <div className={cn(
                  "size-6 rounded-full flex items-center justify-center text-[10px] font-black relative z-10 border",
                  step.done
                    ? "bg-emerald-500 border-emerald-600 text-white shadow-md shadow-emerald-500/10"
                    : "bg-slate-100 border-slate-200 text-slate-400"
                )}>
                  {step.done ? <Check size={11} strokeWidth={3.5} /> : "·"}
                </div>
                {i < arr.length - 1 && (
                  <div className={cn(
                    "absolute top-6 bottom-0 w-[2px] -ml-[1px] left-3",
                    step.done && arr[i + 1].done ? "bg-emerald-500" : "bg-slate-200"
                  )} />
                )}
              </div>
              <div className="min-w-0 flex-1 pt-0.5">
                <p className={cn("text-[12px] font-extrabold", step.done ? "text-slate-900" : "text-slate-400")}>
                  {step.lbl}
                </p>
                <p className="text-[10px] font-bold text-slate-400 mt-0.5">{step.time}</p>
              </div>
            </div>
          ))}
        </div>

        {isPending && (
          <button
            type="button"
            onClick={() => { onStart(delivery); onClose(); }}
            className="sf-tap flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-br from-indigo-600 to-indigo-500 text-[11px] font-black uppercase tracking-[0.14em] text-white shadow-lg shadow-indigo-600/30"
          >
            <Truck size={14} /> Iniciar ruta
          </button>
        )}
        {isInTransit && (
          <button
            type="button"
            onClick={() => { onComplete(delivery); onClose(); }}
            className="sf-tap flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 text-[11px] font-black uppercase tracking-[0.14em] text-white shadow-lg shadow-emerald-500/30"
          >
            <Check size={14} strokeWidth={3} /> Confirmar entrega
          </button>
        )}
        {isDelivered && (
          <div className="flex items-center gap-3.5 rounded-2xl border border-emerald-100 bg-emerald-50/50 p-4">
            <IconChip name="CheckCircle2" palette="emeraldSolid" size={42} icSize={18} />
            <div className="min-w-0 flex-1">
              <h5 className="text-[12px] font-black text-emerald-800">Entrega completada</h5>
              <p className="mt-0.5 text-[10px] font-bold text-slate-500">Firma digital recibida y archivada</p>
            </div>
          </div>
        )}
      </div>
    </SheetShell>
  );
}

function BranchDetailSheet({ open, onClose, branch }: { open: boolean; onClose: () => void; branch: any }) {
  if (!branch) return null;
  const progress = Math.min(1, branch.sales / Math.max(1, branch.target));
  return (
    <SheetShell open={open} onClose={onClose} title={`Sucursal ${branch.name}`} subtitle="Resumen del local" height="85%">
      <div className="flex flex-col gap-3.5">
        <div className="rounded-[24px] bg-gradient-to-br from-indigo-600 via-indigo-700 to-indigo-950 p-5 text-white shadow-lg shadow-indigo-600/20">
          <div className="flex items-center gap-3">
            <div className="flex size-[46px] items-center justify-center rounded-xl bg-white/10 border border-white/15">
              <Building2 size={20} />
            </div>
            <div className="min-w-0 flex-1">
              <h4 className="text-[17px] font-black tracking-tight leading-tight">Sucursal {branch.name}</h4>
              <div className="mt-1.5 flex gap-1.5">
                <Pill kind="dark">{branch.sellers} vendedores</Pill>
                <Pill kind={branch.status === "healthy" ? "success" : "warning"}>
                  {branch.status === "healthy" ? "OK" : "Atención"}
                </Pill>
              </div>
            </div>
          </div>
          <div className="mt-5">
            <MoneyTicker value={branch.sales} animate style={{ font: "900 34px/1 Inter", color: "white", letterSpacing: "-0.03em", display: "block" }} />
            <div className="mt-2.5 flex items-center gap-2">
              <Pill kind="dark">{branch.txns} tickets</Pill>
              <span className="text-[11px] font-bold text-white/60">· meta {formatCurrency(branch.target)}</span>
            </div>
            <div className="h-2 rounded-full bg-white/20 overflow-hidden mt-4">
              <div style={{ width: `${progress * 100}%` }} className="h-full bg-gradient-to-r from-amber-400 to-amber-300 rounded-full transition-all duration-500" />
            </div>
            <p className="text-[10px] font-black text-white/65 mt-2 uppercase tracking-wide">
              {Math.round(progress * 100)}% de la meta cumplido
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <StatTile label="Ticket promedio" value={formatCurrency(branch.txns ? branch.sales / branch.txns : 0)} icon="Receipt" palette="indigo" />
          <StatTile label="Operadores" value={`${branch.sellers} pers.`} icon="Users" palette="purple" />
        </div>

        {/* Local ranking header */}
        <div className="rounded-2xl border border-slate-100 bg-white p-3.5 shadow-sm">
          <p className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-400 mb-3">Ranking del Local</p>
          <div className="flex flex-col gap-2.5">
            {/* Real local sellers could be mapped, but we reuse the team aggregate slice here as fallback */}
            <div className="flex items-center gap-3">
              <Avatar initial="R" size={36} palette="indigoSolid" />
              <div className="flex-1">
                <p className="text-[12px] font-black text-slate-900">Roberto Muñoz</p>
                <p className="text-[10px] font-bold text-slate-400 mt-0.5">Vendedor Principal</p>
              </div>
              <span className="font-mono text-[12px] font-black text-slate-950">{formatCurrency(branch.sales)}</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 mt-1 shrink-0">
          <button type="button" className="sf-tap flex h-11 items-center justify-center gap-1.5 rounded-2xl border border-slate-200 bg-white text-[11px] font-black uppercase tracking-[0.14em] text-slate-600 hover:bg-slate-50 transition-colors">
            <Settings size={13} /> Configurar
          </button>
          <button type="button" className="sf-tap flex h-11 items-center justify-center gap-1.5 rounded-2xl border border-transparent bg-gradient-to-br from-indigo-600 to-indigo-500 text-[11px] font-black uppercase tracking-[0.14em] text-white shadow-lg shadow-indigo-600/30">
            <Activity size={13} /> Ver Reportes
          </button>
        </div>
      </div>
    </SheetShell>
  );
}

function UserDetailSheet({ open, onClose, member }: { open: boolean; onClose: () => void; member: any }) {
  if (!member) return null;
  const progress = Math.min(1, (member.sales || 0) / Math.max(1, member.target || 1));
  const email = `${member.name.toLowerCase().replace(/\s+/g, ".")}@stockflow.cl`;

  return (
    <SheetShell open={open} onClose={onClose} title={member.name} subtitle="Ficha de equipo">
      <div className="flex flex-col gap-3.5">
        <div className="rounded-[24px] bg-gradient-to-br from-indigo-600 via-indigo-700 to-indigo-950 p-5 text-white shadow-lg shadow-indigo-600/20">
          <div className="flex items-center gap-3.5">
            <Avatar initial={member.initial} size={56} palette="glass" ring />
            <div className="min-w-0 flex-1">
              <h4 className="text-[18px] font-black tracking-tight leading-tight truncate">{member.name}</h4>
              <div className="mt-1.5 flex gap-1.5 flex-wrap">
                <Pill kind="dark">{member.role}</Pill>
                <Pill kind="dark">Sucursal Centro</Pill>
              </div>
              <p className="mt-2 text-[10px] font-bold text-white/60 font-mono tracking-tight leading-none truncate">
                {email}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 mt-5">
            <div className="rounded-2xl border border-white/10 bg-white/10 p-2.5">
              <p className="text-[8px] font-black uppercase tracking-[0.14em] text-white/55">Ventas</p>
              <p className="mt-1 text-[13px] font-black tabular-nums text-white leading-none">{formatCurrency(member.sales)}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/10 p-2.5">
              <p className="text-[8px] font-black uppercase tracking-[0.14em] text-white/55">Tickets</p>
              <p className="mt-1 text-[13px] font-black tabular-nums text-white leading-none">{member.count}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/10 p-2.5">
              <p className="text-[8px] font-black uppercase tracking-[0.14em] text-white/55">Meta</p>
              <p className="mt-1 text-[13px] font-black tabular-nums text-white leading-none">{Math.round(progress * 100)}%</p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-100 bg-white p-3.5 shadow-sm">
          <div className="mb-2 flex justify-between items-baseline">
            <span className="text-[9px] font-black uppercase tracking-[0.12em] text-slate-400">Avance comercial</span>
            <span className="text-[11px] font-black text-indigo-600 tabular-nums">{formatCurrency(member.sales)} / {formatCurrency(member.target)}</span>
          </div>
          <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
            <div style={{ width: `${progress * 100}%` }} className="h-full bg-gradient-to-r from-indigo-500 to-indigo-600 rounded-full" />
          </div>
        </div>

        <div className="rounded-2xl border border-slate-100 bg-white p-3.5 shadow-sm">
          <div className="flex justify-between items-baseline mb-2">
            <p className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-400">Permisos Asignados</p>
            <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">(visual inerte / en desarrollo)</span>
          </div>
          {[
            { lbl: "Procesar ventas (POS)", on: member.role?.toLowerCase()?.includes("vendedor") || member.role?.toLowerCase()?.includes("seller") },
            { lbl: "Aprobar devoluciones", on: member.role?.toLowerCase()?.includes("jefe") || member.role?.toLowerCase()?.includes("manager") },
            { lbl: "Acceso a kardex", on: member.role?.toLowerCase()?.includes("logistics") || member.role?.toLowerCase()?.includes("admin") },
            { lbl: "Cambiar de sucursal", on: member.role?.toLowerCase()?.includes("admin") },
          ].map((p, i) => (
            <div key={i} className="flex justify-between items-center py-2 border-b border-slate-100 last:border-b-0">
              <span className="text-[12px] font-extrabold text-slate-800">{p.lbl}</span>
              <Toggle on={p.on} disabled />
            </div>
          ))}
        </div>

        {/* Security safety badge warning */}
        <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-3 flex items-start gap-2.5">
          <AlertTriangle size={15} className="text-amber-500 shrink-0 mt-0.5" />
          <div className="leading-tight">
            <span className="text-[10px] font-black text-amber-800 block">Módulo de seguridad inerte</span>
            <span className="text-[9px] font-bold text-slate-500 mt-0.5 block">
              Las modificaciones de privilegios y el estado de la cuenta están pendientes de aprobación de políticas globales.
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 mt-1">
          <button
            type="button"
            disabled
            className="flex h-11 items-center justify-center gap-1.5 rounded-2xl border border-rose-200 bg-white text-[11px] font-black uppercase tracking-[0.14em] text-rose-500 opacity-50 cursor-not-allowed"
          >
            <X size={13} /> Suspender
          </button>
          <button
            type="button"
            disabled
            className="flex h-11 items-center justify-center gap-1.5 rounded-2xl border border-transparent bg-gradient-to-br from-indigo-500 to-indigo-600 text-[11px] font-black uppercase tracking-[0.14em] text-white opacity-50 cursor-not-allowed"
          >
            <Settings size={13} /> Editar Rol
          </button>
        </div>
      </div>
    </SheetShell>
  );
}
