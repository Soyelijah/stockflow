import React from "react";
import { cn } from "../../../../lib/utils";

export interface DividerProps {
  dark?: boolean;
  className?: string;
}

export function Divider({ dark = false, className }: DividerProps) {
  return (
    <div
      className={cn("h-[1px] my-1 w-full", className)}
      style={{
        background: dark ? "rgba(255, 255, 255, 0.08)" : "var(--sf-stroke-1, #f1f5f9)",
      }}
    />
  );
}
