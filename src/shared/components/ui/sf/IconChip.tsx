import React from "react";
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  History,
  LogOut,
  Menu,
  X,
  ChevronLeft,
  Bell,
  Search,
  Zap,
  Users,
  CreditCard,
  ArrowRightLeft,
  Smartphone,
  AlertTriangle,
  Info,
  CheckCircle2,
  Truck,
  Building2,
  MinusCircle,
  Receipt,
  UserCircle,
  Settings,
  TrendingDown,
  TrendingUp,
  Coins,
  Plus,
  Minus,
  Trash2,
  Tag,
  Banknote,
  Loader2,
  RefreshCw,
  Store,
  User,
  FileText,
  Ticket,
  Camera,
  Lock,
  Unlock,
  Wifi,
  WifiOff,
  UserPlus,
  LucideProps
} from "lucide-react";
import { cn } from "../../../../lib/utils";

// Whitelist de iconos para tree-shaking óptimo (Enmienda #1)
export const sfIconMap: Record<string, React.ComponentType<LucideProps>> = {
  LayoutDashboard,
  Package,
  ShoppingCart,
  History,
  LogOut,
  Menu,
  X,
  ChevronLeft,
  Bell,
  Search,
  Zap,
  Users,
  CreditCard,
  ArrowRightLeft,
  Smartphone,
  AlertTriangle,
  Info,
  CheckCircle2,
  Truck,
  Building2,
  MinusCircle,
  Receipt,
  UserCircle,
  Settings,
  TrendingDown,
  TrendingUp,
  Coins,
  Plus,
  Minus,
  Trash2,
  Tag,
  Banknote,
  Loader2,
  RefreshCw,
  Store,
  User,
  FileText,
  Ticket,
  Camera,
  Lock,
  Unlock,
  Wifi,
  WifiOff,
  UserPlus
};

export type SfIconName = keyof typeof sfIconMap;

export interface IconChipProps {
  name: SfIconName | string;
  palette?:
    | "indigo"
    | "indigoSolid"
    | "emerald"
    | "emeraldSolid"
    | "amber"
    | "amberSolid"
    | "rose"
    | "roseSolid"
    | "blue"
    | "blueSolid"
    | "purple"
    | "purpleSolid"
    | "slate"
    | "dark"
    | "glass";
  size?: number; // default 40
  icSize?: number;
  className?: string;
  style?: React.CSSProperties;
}

export function IconChip({
  name,
  palette = "indigo",
  size = 40,
  icSize,
  className,
  style,
}: IconChipProps) {
  // Enmienda #4 Safeguard: Captura de iconos inexistentes
  const IconComponent = sfIconMap[name];

  if (!IconComponent) {
    if (process.env.NODE_ENV === "development") {
      console.warn(
        `[IconChip] El icono "${name}" no se encuentra en la whitelist sfIconMap. Por favor, regístrelo en IconChip.tsx.`
      );
    }
    return null;
  }

  // Mappings de paletas según el prototipo
  const p = {
    indigo: { bg: "var(--sf-indigo-50)", fg: "var(--sf-indigo-600)", shadow: "none" },
    indigoSolid: {
      bg: "linear-gradient(140deg, #4f46e5, #6366f1)",
      fg: "#ffffff",
      shadow: "0 8px 18px -8px rgba(79, 70, 229, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.18)",
    },
    emerald: { bg: "var(--sf-success-bg)", fg: "var(--sf-success)", shadow: "none" },
    emeraldSolid: {
      bg: "linear-gradient(140deg, #059669, #10b981)",
      fg: "#ffffff",
      shadow: "0 8px 18px -8px rgba(16, 185, 129, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.18)",
    },
    amber: { bg: "var(--sf-warning-bg)", fg: "var(--sf-warning)", shadow: "none" },
    amberSolid: {
      bg: "linear-gradient(140deg, #d97706, #f59e0b)",
      fg: "#ffffff",
      shadow: "0 8px 18px -8px rgba(245, 158, 11, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.18)",
    },
    rose: { bg: "var(--sf-danger-bg)", fg: "var(--sf-danger)", shadow: "none" },
    roseSolid: {
      bg: "linear-gradient(140deg, #e11d48, #f43f5e)",
      fg: "#ffffff",
      shadow: "0 8px 18px -8px rgba(244, 63, 94, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.18)",
    },
    blue: { bg: "var(--sf-info-bg)", fg: "var(--sf-info)", shadow: "none" },
    blueSolid: {
      bg: "linear-gradient(140deg, #2563eb, #3b82f6)",
      fg: "#ffffff",
      shadow: "0 8px 18px -8px rgba(59, 130, 246, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.18)",
    },
    purple: { bg: "var(--sf-customer-bg)", fg: "var(--sf-customer)", shadow: "none" },
    purpleSolid: {
      bg: "linear-gradient(140deg, #9333ea, #a855f7)",
      fg: "#ffffff",
      shadow: "0 8px 18px -8px rgba(168, 85, 247, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.18)",
    },
    slate: { bg: "var(--sf-slate-50)", fg: "var(--sf-slate-500)", shadow: "none" },
    dark: {
      bg: "linear-gradient(140deg, #1e293b, #0f172a)",
      fg: "#ffffff",
      shadow: "0 8px 18px -8px rgba(15, 23, 42, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.18)",
    },
    glass: { bg: "rgba(255, 255, 255, 0.10)", fg: "#ffffff", shadow: "none" },
  }[palette] || { bg: "var(--sf-slate-50)", fg: "var(--sf-slate-500)", shadow: "none" };

  return (
    <div
      className={cn("flex items-center justify-center shrink-0", className)}
      style={{
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.32),
        background: p.bg,
        color: p.fg,
        boxShadow: p.shadow,
        ...style,
      }}
    >
      <IconComponent
        size={icSize || Math.round(size * 0.5)}
        strokeWidth={2.2}
      />
    </div>
  );
}
