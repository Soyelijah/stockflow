import React, { useState, useEffect, useRef } from "react";
import { formatNumber } from "../../../../lib/utils";

export interface MoneyTickerProps {
  value: number;
  duration?: number;
  prefix?: string;
  animate?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

export function MoneyTicker({
  value,
  duration = 800,
  prefix = "$",
  animate = false,
  className,
  style,
}: MoneyTickerProps) {
  const [n, setN] = useState(animate ? 0 : value);
  const lastValueRef = useRef(animate ? 0 : value);

  useEffect(() => {
    if (!animate) {
      setN(value);
      lastValueRef.current = value;
      return;
    }
    if (value < 5000) {
      setN(value);
      lastValueRef.current = value;
      return;
    }
    const from = lastValueRef.current;
    if (from === value) return;
    lastValueRef.current = value;
    
    const steps = 30;
    const stepMs = duration / steps;
    let i = 0;
    const id = setInterval(() => {
      i++;
      const t = Math.min(1, i / steps);
      const eased = 1 - Math.pow(1 - t, 4); // quartic ease out
      setN(Math.round(from + (value - from) * eased));
      if (i >= steps) {
        clearInterval(id);
      }
    }, stepMs);

    return () => clearInterval(id);
  }, [value, duration, animate]);

  return (
    <span className={className} style={{ fontVariantNumeric: "tabular-nums", ...style }}>
      {prefix}
      {formatNumber(n)}
    </span>
  );
}
