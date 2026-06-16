import React from "react";
import { Gift, Crown, Truck, Percent, Clock } from "lucide-react";
import { cn, LOYALTY_TIERS } from "../../../lib/utils";
import { Pill } from "../ui/sf/Pill";

export interface Coupon {
  id: string;
  code: string;
  title: string;
  desc: string;
  cost: number;
  expiry: string;
  color: string;
  icon: string;
  claimed?: boolean;
  minTier?: "BRONZE" | "SILVER" | "GOLD" | "PLATINUM";
}

export interface CouponCardProps {
  coupon: Coupon;
  customerPoints: number;
  onClaim?: () => void;
  onUse?: () => void;
  lang?: "es" | "en";
  lockedLabel?: string;
  tierLabel?: string;
  key?: React.Key;
}

// Icon helper function to map name strings to Lucide components
function getCouponIcon(iconName: string) {
  switch (iconName?.toLowerCase()) {
    case "gift":
      return <Gift size={26} />;
    case "crown":
      return <Crown size={26} />;
    case "truck":
      return <Truck size={26} />;
    case "percent":
    default:
      return <Percent size={26} />;
  }
}

export function CouponCard({
  coupon,
  customerPoints,
  onClaim,
  onUse,
  lang = "es",
  lockedLabel,
  tierLabel,
}: CouponCardProps) {
  const minPointsRequired = coupon.minTier ? ((LOYALTY_TIERS as any)[coupon.minTier]?.min || 0) : 0;
  const isTierEligible = customerPoints >= minPointsRequired;
  const isLocked = !isTierEligible && !coupon.claimed;
  const affordable = customerPoints >= coupon.cost;
  const isClaimed = coupon.claimed;
  
  // Custom styles for icons in expiry line
  const ExpiryIcon = Clock;

  return (
    <div
      className={cn(
        "relative flex bg-white rounded-3xl overflow-hidden border border-slate-100 shadow-[0_4px_14px_-8px_rgba(15,23,42,0.2)]",
        isLocked && "opacity-60 grayscale-[25%]"
      )}
      style={{ minHeight: 120 }}
    >
      {/* Left Perforated Ticket Block */}
      <div
        className="w-20 sm:w-24 shrink-0 flex flex-col items-center justify-center gap-1.5 text-white relative select-none"
        style={{
          background: `linear-gradient(140deg, ${coupon.color}, ${coupon.color}cc)`,
        }}
      >
        {getCouponIcon(coupon.icon)}
        <span className="font-black text-sm sm:text-base tracking-tight leading-none">
          {coupon.cost > 0 ? `${coupon.cost} pts` : "Gratis"}
        </span>

        {/* Perforations simulating ticket troquelado (exactly 7 circles matching the portal background) */}
        <div className="absolute right-[-6px] top-0 bottom-0 w-[12px] flex flex-col justify-between py-1.5 z-20 pointer-events-none">
          {Array.from({ length: 7 }).map((_, i) => (
            <div
              key={i}
              className="w-[12px] h-[12px] rounded-full bg-[#f8fafc]"
            />
          ))}
        </div>
      </div>

      {/* Right Ticket Info Block */}
      <div className="flex-1 p-4 flex flex-col justify-between text-left min-w-0">
        <div className="flex items-center gap-x-2">
          <span
            className="font-mono font-bold text-[10px] sm:text-xs px-2 py-0.5 rounded-lg tracking-wider"
            style={{
              color: coupon.color,
              backgroundColor: `${coupon.color}15`,
            }}
          >
            {coupon.code}
          </span>
          {coupon.minTier && (
            <span
              className={cn(
                "text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border",
                coupon.minTier === "PLATINUM" ? "bg-slate-900 text-white border-slate-950"
                : coupon.minTier === "GOLD" ? "bg-amber-50 text-amber-600 border-amber-100"
                : coupon.minTier === "SILVER" ? "bg-slate-100 text-slate-600 border-slate-200"
                : "bg-orange-50 text-orange-700 border-orange-100"
              )}
            >
              {tierLabel || (lang === "es" ? `Requiere ${coupon.minTier}` : `Requires ${coupon.minTier}`)}
            </span>
          )}
          {isClaimed && (
            <Pill kind="success" className="text-[8px] font-black uppercase tracking-wider px-2 py-0.5">
              {lang === "es" ? "Activo" : "Active"}
            </Pill>
          )}
        </div>

        <div className="font-black text-xs sm:text-sm text-slate-800 mt-2 leading-tight line-clamp-1">
          {coupon.title}
        </div>
        <p className="text-[10px] sm:text-xs font-semibold text-slate-450 mt-1 leading-snug line-clamp-2">
          {coupon.desc}
        </p>

        <div className="flex items-center justify-between mt-3 gap-2">
          <span className="text-[8px] sm:text-[9px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1">
            <ExpiryIcon size={10} className="shrink-0" />
            <span>
              {lang === "es" ? `Vence ${coupon.expiry}` : `Expires ${coupon.expiry}`}
            </span>
          </span>

          {isClaimed ? (
            <button
              type="button"
              onClick={onUse}
              className="sf-tap px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest border-none cursor-pointer transition-all active:scale-[0.96]"
              style={{
                color: coupon.color,
                backgroundColor: `${coupon.color}15`,
              }}
            >
              {lang === "es" ? "Usar" : "Use"}
            </button>
          ) : isLocked ? (
            <button
              type="button"
              disabled
              className="px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest border-none text-slate-400 bg-slate-100 cursor-not-allowed shadow-none"
            >
              {lockedLabel || (lang === "es" ? "Bloqueado" : "Locked")}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => affordable && onClaim?.()}
              disabled={!affordable}
              className={cn(
                "sf-tap px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest border-none transition-all active:scale-[0.96]",
                affordable 
                  ? "text-white cursor-pointer shadow-md" 
                  : "text-slate-400 bg-slate-100 cursor-not-allowed shadow-none"
              )}
              style={{
                background: affordable
                  ? `linear-gradient(140deg, ${coupon.color}, ${coupon.color}cc)`
                  : undefined,
                boxShadow: affordable
                  ? `0 6px 14px -4px ${coupon.color}80`
                  : undefined,
              }}
            >
              {coupon.cost > 0 ? `${coupon.cost} pts` : (lang === "es" ? "Reclamar" : "Claim")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
