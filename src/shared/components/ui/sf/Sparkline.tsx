import React from "react";
import { cn } from "../../../../lib/utils";

export interface SparklineProps {
  data: { v: number }[];
  height?: number;
  gap?: number;
  color?: string;
  muted?: boolean;
  className?: string;
}

export function Sparkline({
  data,
  height = 32,
  gap = 3,
  color = "var(--sf-indigo-600)",
  muted = false,
  className,
}: SparklineProps) {
  const max = Math.max(...data.map((d) => d.v), 1);

  return (
    <div
      className={cn("flex items-end w-full", className)}
      style={{ gap, height }}
    >
      {data.map((d, i) => {
        const h = Math.max(2, (d.v / max) * height);
        // Ajustar gradiente según color
        const backgroundStyle = muted
          ? "rgba(255, 255, 255, 0.40)"
          : color === "white"
            ? "linear-gradient(180deg, rgba(255, 255, 255, 0.95), rgba(255, 255, 255, 0.55))"
            : `linear-gradient(180deg, var(--sf-indigo-400, #818cf8), ${color})`;

        return (
          <div
            key={i}
            className="flex-1 flex flex-col items-center"
          >
            <div
              className="w-full rounded-t-[2px] transition-all"
              style={{
                height: h,
                background: backgroundStyle,
                animationDelay: `${i * 35}ms`,
                opacity: muted ? 0.7 : 1,
                transitionDuration: "350ms",
                transitionTimingFunction: "var(--sf-ease-spring)",
              }}
            />
          </div>
        );
      })}
    </div>
  );
}
