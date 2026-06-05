import { motion } from "framer-motion";
import type React from "react";
import { cn } from "@/lib/utils";

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  subValue: string;
  trend?: "up" | "down" | "stable";
}

/**
 * StatCard component for displaying dashboard metrics with trend indicators.
 * Follows atomic design (Atom).
 */
export function StatCard({ icon, label, value, subValue, trend }: Readonly<StatCardProps>) {
  let trendColor = "text-text-muted opacity-40";
  if (trend === "up") {
    trendColor = "text-error";
  } else if (trend === "down") {
    trendColor = "text-primary";
  }

  let trendSymbol = "•";
  if (trend === "up") {
    trendSymbol = "↑";
  } else if (trend === "down") {
    trendSymbol = "↓";
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-bg-surface/40 border border-white/5 rounded-xl p-4 relative overflow-hidden group hover:border-primary/20 transition-[border-color,background-color] duration-200 hover:bg-bg-surface/60"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <p className="text-[10px] font-bold uppercase tracking-wider text-text-muted mb-1">
            {label}
          </p>
          <div className="flex items-baseline gap-2">
            <h3 className="text-xl font-mono font-bold text-text-primary tracking-tight">
              {value}
            </h3>
            {trend && (
              <span className={cn("text-[10px] font-bold", trendColor)}>{trendSymbol}</span>
            )}
          </div>
          <p className="text-[9px] text-text-muted mt-1 font-medium opacity-60 group-hover:opacity-100 transition-opacity uppercase tracking-tighter">
            {subValue}
          </p>
        </div>
        <div className="p-2 rounded-lg bg-bg-base/50 border border-white/5 group-hover:border-primary/10 transition-colors duration-200">
          {icon}
        </div>
      </div>

      {/* Subtle accent line - optimized to use GPU-accelerated transform scaling */}
      <div className="absolute bottom-0 left-0 h-0.5 w-full bg-primary origin-left scale-x-0 group-hover:scale-x-100 transition-transform duration-300 ease-out opacity-30" />
    </motion.div>
  );
}
