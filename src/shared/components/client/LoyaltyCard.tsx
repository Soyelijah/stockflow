import React from "react";
import { Crown, QrCode } from "lucide-react";
import { cn, formatRUT } from "../../../lib/utils";
import { MoneyTicker } from "../ui/sf/MoneyTicker";

export interface LoyaltyCardProps {
  points: number;
  tierName: "Bronze" | "Silver" | "Gold" | "Platinum";
  pointsToNext: number;
  nextTier: string;
  rut: string;
  memberSince: string;
  onShowQR: () => void;
  lang?: "es" | "en";
}

const TIER_BADGE_STYLE = {
  Platinum: {
    label: "Platinum",
    grad: "linear-gradient(140deg, #94a3b8, #475569)",
    shadow: "0 8px 18px -6px rgba(71, 85, 105, 0.90)",
  },
  Gold: {
    label: "Gold",
    grad: "linear-gradient(140deg, #f59e0b, #d97706)",
    shadow: "0 8px 18px -6px rgba(217, 119, 6, 0.90)",
  },
  Silver: {
    label: "Silver",
    grad: "linear-gradient(140deg, #cbd5e1, #64748b)",
    shadow: "0 8px 18px -6px rgba(100, 116, 139, 0.90)",
  },
  Bronze: {
    label: "Bronze",
    grad: "linear-gradient(140deg, #d97706, #b45309)",
    shadow: "0 8px 18px -6px rgba(180, 83, 9, 0.90)",
  },
};

export function LoyaltyCard({
  points,
  tierName,
  pointsToNext,
  nextTier,
  rut,
  memberSince,
  onShowQR,
  lang = "es",
}: LoyaltyCardProps) {
  const tier = TIER_BADGE_STYLE[tierName] || TIER_BADGE_STYLE.Bronze;
  
  // Progress to next tier calculation. If pointsToNext is 0 or it's Platinum (max tier), progress is 100%
  const isMaxTier = tierName === "Platinum" || pointsToNext <= 0;
  const progress = isMaxTier ? 1 : points / (points + pointsToNext);
  const progressPercent = Math.round(progress * 100);

  // Masked RUT: •••• last 5 characters including check digit
  const cleanRUT = formatRUT(rut);
  const maskedRUT = cleanRUT.length > 5 
    ? `•••• ${cleanRUT.slice(-5)}` 
    : rut;

  return (
    <div
      className="relative overflow-hidden p-6 text-white select-none"
      style={{
        borderRadius: 28,
        background:
          "radial-gradient(120% 80% at 0% 0%, var(--sf-indigo-500) 0%, transparent 50%), " +
          "radial-gradient(120% 80% at 100% 0%, var(--sf-indigo-700) 0%, transparent 55%), " +
          "radial-gradient(120% 100% at 100% 100%, var(--sf-warning) 0%, transparent 55%), " +
          "linear-gradient(180deg, var(--sf-indigo-950) 0%, #1e1b4b 100%)",
        boxShadow:
          "0 26px 56px -22px rgba(67, 56, 202, 0.6), 0 8px 20px -8px rgba(15, 23, 42, 0.20), inset 0 1px 0 rgba(255, 255, 255, 0.10)",
        isolation: "isolate",
      }}
    >
      {/* Dots overlay grid */}
      <div
        className="absolute inset-0 pointer-events-none mix-blend-overlay opacity-60"
        style={{
          zIndex: -1,
          backgroundImage: "radial-gradient(rgba(255, 255, 255, 0.05) 1px, transparent 1px)",
          backgroundSize: "14px 14px",
        }}
      />

      <div className="flex justify-between items-start">
        <div className="text-left">
          <span className="text-[9px] font-black uppercase tracking-[0.18em] text-white/60 leading-none">
            {lang === "es" ? "Mis puntos StockFlow" : "My StockFlow Points"}
          </span>
          <div className="flex items-baseline gap-x-2 mt-3">
            <MoneyTicker
              value={points}
              prefix=""
              animate
              className="text-5xl font-black tracking-tight leading-none text-white select-all"
            />
            <span className="text-sm font-black text-amber-300 leading-none">pts</span>
          </div>
        </div>

        {/* Tier badge with shadow and gradient */}
        <div
          className="flex items-center gap-x-1.5 px-3 py-1.5 rounded-full select-none shrink-0"
          style={{
            background: tier.grad,
            boxShadow: `${tier.shadow}, inset 0 1px 0 rgba(255, 255, 255, 0.25)`,
          }}
        >
          <Crown size={13} fill="white" strokeWidth={0} className="text-white" />
          <span className="text-[10px] font-black uppercase tracking-[0.14em] text-white leading-none">
            {tier.label}
          </span>
        </div>
      </div>

      {/* Progress to next tier */}
      <div className="mt-[18px] text-left">
        <div className="flex justify-between items-center mb-2">
          <span className="text-[10px] font-extrabold text-white/70">
            {isMaxTier ? (
              lang === "es" ? (
                <span>🎉 Has alcanzado el nivel máximo</span>
              ) : (
                <span>🎉 You reached the maximum level</span>
              )
            ) : lang === "es" ? (
              <span>
                Faltan <strong className="text-white font-black">{pointsToNext} pts</strong> para {nextTier}
              </span>
            ) : (
              <span>
                <strong className="text-white font-black">{pointsToNext} pts</strong> left for {nextTier}
              </span>
            )}
          </span>
          <span className="text-[9px] font-black uppercase tracking-[0.12em] text-amber-300 leading-none">
            {progressPercent}%
          </span>
        </div>
        <div className="h-[9px] bg-white/12 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-1000"
            style={{
              width: `${progressPercent}%`,
              background: "linear-gradient(to right, #fbbf24, #f59e0b)",
              boxShadow: "0 0 12px rgba(245, 158, 11, 0.7)",
              transitionTimingFunction: "cubic-bezier(0.32, 0.72, 0, 1)",
            }}
          />
        </div>
      </div>

      {/* Card footer: member ID + QR button */}
      <div className="flex justify-between items-center mt-[18px]">
        <div className="text-left">
          <span className="text-[8px] font-black uppercase tracking-[0.16em] text-white/50 leading-none">
            {lang === "es" ? `Socio desde ${memberSince}` : `Member since ${memberSince}`}
          </span>
          <div className="text-xs font-mono font-black text-white/80 mt-1.5 tracking-[0.08em] leading-none">
            {maskedRUT}
          </div>
        </div>
        <button
          type="button"
          onClick={onShowQR}
          className="sf-tap flex items-center gap-x-2 px-3.5 py-2.5 rounded-[14px] bg-white text-indigo-700 border-none cursor-pointer text-[10px] font-black uppercase tracking-[0.12em] shadow-[0_8_18_-6_rgba(0,0,0,0.4),_inset_0_1_0_rgba(255,255,255,0.8)] active:scale-[0.96] transition-transform"
        >
          <QrCode size={15} strokeWidth={2.2} />
          <span>{lang === "es" ? "Mi código" : "My Code"}</span>
        </button>
      </div>
    </div>
  );
}
