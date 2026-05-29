import React from "react";
import { cn } from "../../../../lib/utils";

export interface PillProps {
  children: React.ReactNode;
  kind?: "success" | "danger" | "warning" | "info" | "accent" | "neutral" | "dark";
  pulse?: boolean;
  className?: string;
}

export function Pill({
  children,
  kind = "neutral",
  pulse = false,
  className,
}: PillProps) {
  const kindStyles = {
    success: "bg-sf-success-bg border-sf-success-border text-sf-success",
    danger: "bg-sf-danger-bg border-sf-danger-border text-sf-danger",
    warning: "bg-sf-warning-bg border-sf-warning-border text-sf-warning",
    info: "bg-sf-info-bg border-sf-info-border text-sf-info",
    accent: "bg-sf-indigo-50 border-sf-indigo-200 text-sf-indigo-600",
    neutral: "bg-slate-50 border-slate-100 text-slate-500",
    dark: "bg-slate-900 border-transparent text-white",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-[9px] font-black uppercase tracking-[0.12em] px-2.5 py-0.5 rounded-full border",
        kindStyles[kind],
        pulse && "animate-pulse",
        className
      )}
    >
      {children}
    </span>
  );
}
