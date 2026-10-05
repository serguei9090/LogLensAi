// Assume Role: Frontend Engineer (@frontend)
"use client";

import { cn } from "@/lib/utils";
import React, { useId } from "react";

interface GridPatternProps extends React.SVGProps<SVGSVGElement> {
  width?: number;
  height?: number;
  x?: number;
  y?: number;
  squares?: Array<[x: number, y: number]>;
  strokeDasharray?: string;
  className?: string;
  dotSize?: number;
}

/**
 * GridPattern - Lightweight tactical dot-matrix and coordinate grid background.
 * Adheres to DESIGN.md Engine Precision aesthetic without WebGL or canvas performance costs.
 */
export function GridPattern({
  width = 24,
  height = 24,
  x = -1,
  y = -1,
  strokeDasharray = "0",
  squares,
  className,
  dotSize = 1,
  ...props
}: Readonly<GridPatternProps>) {
  const id = useId();

  return (
    <svg
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute inset-0 h-full w-full fill-white/[0.03] stroke-white/[0.04]",
        className,
      )}
      {...props}
    >
      <defs>
        <pattern
          id={id}
          width={width}
          height={height}
          patternUnits="userSpaceOnUse"
          x={x}
          y={y}
        >
          <circle cx={width / 2} cy={height / 2} r={dotSize} fill="currentColor" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" strokeWidth={0} fill={`url(#${id})`} />
      {squares && (
        <svg x={x} y={y} className="overflow-visible">
          {squares.map(([sqX, sqY]) => (
            <rect
              strokeWidth="0"
              key={`${sqX}-${sqY}`}
              width={width - 1}
              height={height - 1}
              x={sqX * width + 1}
              y={sqY * height + 1}
              className="fill-primary/10"
            />
          ))}
        </svg>
      )}
    </svg>
  );
}
