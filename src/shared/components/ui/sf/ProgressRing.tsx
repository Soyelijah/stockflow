import React, { useState, useEffect } from "react";

export interface ProgressRingProps {
  size?: number;
  stroke?: number;
  progress?: number; // 0 to 1
  fg?: string;
  bg?: string;
  children?: React.ReactNode;
}

export function ProgressRing({
  size = 56,
  stroke = 5,
  progress = 0.5,
  fg = "#ffffff",
  bg = "rgba(255, 255, 255, 0.18)",
  children,
}: ProgressRingProps) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const [animOff, setAnimOff] = useState(c);

  useEffect(() => {
    const id = setTimeout(() => {
      setAnimOff(c * (1 - Math.min(1, Math.max(0, progress))));
    }, 20);
    return () => clearTimeout(id);
  }, [progress, c]);

  return (
    <div
      style={{
        position: "relative",
        width: size,
        height: size,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={bg}
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={fg}
          strokeWidth={stroke}
          strokeDasharray={c}
          strokeDashoffset={animOff}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 1.4s var(--sf-ease-spring, cubic-bezier(0.32, 0.72, 0, 1))" }}
        />
      </svg>
      {children && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {children}
        </div>
      )}
    </div>
  );
}
