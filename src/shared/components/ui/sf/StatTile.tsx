import React from "react";
import { TrendingUp, LucideIcon } from "lucide-react";
import { cn } from "../../../../lib/utils";
import { IconChip, IconChipProps, SfIconName } from "./IconChip";
import { Sparkline } from "./Sparkline";

export interface StatTileProps {
  label: string;
  value: string | number;
  delta?: string | number;
  deltaPositive?: boolean;
  sparkData?: { v: number }[];
  icon?: SfIconName;
  palette?: IconChipProps["palette"];
  className?: string;
  onClick?: () => void;
}

export function StatTile({
  label,
  value,
  delta,
  deltaPositive,
  sparkData,
  icon,
  palette = "indigo",
  className,
  onClick,
}: StatTileProps) {
  const deltaColor = deltaPositive ? "var(--sf-success)" : "var(--sf-danger)";

  return (
    <div
      onClick={onClick}
      className={cn(
        "bg-white border border-slate-100 rounded-[22px] shadow-sm sf-press p-3.5 flex flex-col gap-2 relative overflow-hidden select-none",
        className
      )}
    >
      <div className="flex justify-between items-start">
        <div>
          <div className="sf-microlabel text-[8px] tracking-[0.14em] text-slate-400">
            {label}
          </div>
          <div className="text-[18px] font-black text-slate-900 mt-1.5 tracking-tight sf-tabular-nums leading-none">
            {value}
          </div>
        </div>
        {icon && (
          <IconChip
            name={icon}
            palette={palette}
            size={30}
            icSize={14}
          />
        )}
      </div>

      {delta != null && (
        <div
          className="flex items-center gap-1 text-[9px] font-black leading-none"
          style={{ color: deltaColor }}
        >
          <TrendingUp
            size={11}
            strokeWidth={2.5}
            style={{
              transform: deltaPositive ? "none" : "rotate(180deg)",
              transition: "transform 0.3s",
            }}
          />
          <span>{delta}</span>
        </div>
      )}

      {sparkData && (
        <div className="mt-0.5">
          <Sparkline data={sparkData} height={22} gap={2} />
        </div>
      )}
    </div>
  );
}
