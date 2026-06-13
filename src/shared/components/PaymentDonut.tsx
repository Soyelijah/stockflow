// Sf Staff — payment-method breakdown donut (worker_mobile v2 PaymentDonut).
// Pure visualization of real shift `salesByMethod` data; no shift/cash logic.
// Animated stroke-dasharray segments (efectivo/tarjeta/transferencia/digital).

import { useEffect, useState } from "react";
import { formatCurrency } from "../../lib/utils";

interface PaymentDonutProps {
  byMethod: { efectivo?: number; tarjeta?: number; transferencia?: number; digital?: number };
  size?: number;
}

const SEGMENTS = [
  { k: "efectivo" as const, color: "#10b981" },
  { k: "tarjeta" as const, color: "#3b82f6" },
  { k: "transferencia" as const, color: "#f59e0b" },
  { k: "digital" as const, color: "#6366f1" },
];

export function PaymentDonut({ byMethod, size = 96 }: PaymentDonutProps) {
  const stroke = 14;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const total = SEGMENTS.reduce((s, seg) => s + (byMethod[seg.k] || 0), 0);

  const [animate, setAnimate] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setAnimate(true), 30);
    return () => clearTimeout(id);
  }, []);

  let offset = 0;
  return (
    <div className="relative shrink-0 flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#f1f5f9" strokeWidth={stroke} />
        {SEGMENTS.map((seg, i) => {
          const v = byMethod[seg.k] || 0;
          const pct = total ? v / total : 0;
          const len = c * pct;
          const dashArray = `${animate ? len : 0} ${c}`;
          const dashOffset = -offset;
          offset += animate ? len : 0;
          return (
            <circle
              key={seg.k}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={seg.color}
              strokeWidth={stroke}
              strokeDasharray={dashArray}
              strokeDashoffset={dashOffset}
              strokeLinecap="butt"
              style={{ transition: `stroke-dasharray 1.2s ${i * 150}ms cubic-bezier(0.32,0.72,0,1)` }}
            />
          );
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[8px] font-black uppercase tracking-[0.14em] text-slate-400">Total</span>
        <span className="text-[13px] font-black text-slate-900 mt-1 tracking-tight tabular-nums">{formatCurrency(total)}</span>
      </div>
    </div>
  );
}
