import React from "react";
import { cn } from "../../../../lib/utils";

export interface AvatarProps {
  initial?: string;
  size?: number; // default 36
  palette?: "indigoSolid" | "glass" | "slate" | "purpleSolid";
  ring?: boolean;
  className?: string;
}

export function Avatar({
  initial = "?",
  size = 36,
  palette = "indigoSolid",
  ring = false,
  className,
}: AvatarProps) {
  const p = {
    indigoSolid: {
      bg: "linear-gradient(140deg, #4f46e5, #6366f1)",
      fg: "#ffffff",
      glow: "rgba(79, 70, 229, 0.45)",
      border: "none",
    },
    glass: {
      bg: "rgba(255, 255, 255, 0.10)",
      fg: "#ffffff",
      glow: "none",
      border: "1px solid rgba(255, 255, 255, 0.18)",
    },
    slate: {
      bg: "var(--sf-slate-100)",
      fg: "var(--sf-fg-2)",
      glow: "none",
      border: "none",
    },
    purpleSolid: {
      bg: "linear-gradient(140deg, #9333ea, #a855f7)",
      fg: "#ffffff",
      glow: "rgba(168, 85, 247, 0.40)",
      border: "none",
    },
  }[palette] || {
    bg: "var(--sf-slate-100)",
    fg: "var(--sf-fg-2)",
    glow: "none",
    border: "none",
  };

  const hasGlow = p.glow !== "none";
  const borderStyle = p.border !== "none" 
    ? p.border 
    : ring 
      ? "2px solid rgba(255, 255, 255, 0.85)" 
      : "none";

  return (
    <div
      className={cn(
        "flex items-center justify-center font-black tracking-tight shrink-0 select-none",
        className
      )}
      style={{
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.34),
        background: p.bg,
        color: p.fg,
        border: borderStyle,
        fontSize: `${Math.round(size * 0.42)}px`,
        lineHeight: 1,
        boxShadow: hasGlow
          ? `0 6px 16px -4px ${p.glow}, inset 0 1px 0 rgba(255, 255, 255, 0.20)`
          : "none",
      }}
    >
      {initial}
    </div>
  );
}
