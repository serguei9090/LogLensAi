/* Assume Role: Frontend Engineer (@frontend) */
/* File: src/components/atoms/ReactECharts.tsx */

import * as echarts from "echarts";
import { useEffect, useRef } from "react";

interface ReactEChartsProps {
  readonly option: echarts.EChartsOption;
  readonly style?: React.CSSProperties;
  readonly className?: string;
  readonly onEvents?: Record<string, (params: any) => void>;
  readonly loading?: boolean;
  readonly onChartInit?: (chart: echarts.EChartsType) => void;
}

export function ReactECharts({
  option,
  style,
  className,
  onEvents,
  loading,
  onChartInit,
}: ReactEChartsProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartInstanceRef = useRef<echarts.EChartsType | null>(null);
  
  // Track structural change history using reference flags to bypass duplicate redraw instructions
  const prevOptionJsonRef = useRef<string>("");

  // Initialize ECharts instance
  useEffect(() => {
    if (!containerRef.current) {
      return;
    }

    // Allocate core chart render context bounds
    const chart = echarts.init(containerRef.current);
    chartInstanceRef.current = chart;

    if (onChartInit) {
      onChartInit(chart);
    }

    // Process initial option config parameters immediately
    const optionStr = JSON.stringify(option);
    chart.setOption(option, { notMerge: true });
    prevOptionJsonRef.current = optionStr;

    // Use a lightweight ResizeObserver tied directly to single animation frames.
    // This allows the element box structure to mirror Tauri windows instantly 
    // without invoking expensive JavaScript vector re-draw calculations mid-flight.
    let animationFrameId: number | null = null;
    
    const resizeObserver = new ResizeObserver((_entries) => {
      if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId);
      }
      
      animationFrameId = requestAnimationFrame(() => {
        if (chartInstanceRef.current) {
          chartInstanceRef.current.resize();
        }
      });
    });

    resizeObserver.observe(containerRef.current);

    return () => {
      if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId);
      }
      resizeObserver.disconnect();
      chart.dispose();
      chartInstanceRef.current = null;
    };
  }, [onChartInit]);

  // Handle data metric option updates safely using an optimization check
  useEffect(() => {
    const chart = chartInstanceRef.current;
    if (!chart) {
      return;
    }

    const currentOptionJson = JSON.stringify(option);
    
    // Only invoke heavy engine updates if the chart data parameters have changed.
    // Window maximizing changes the wrapper box dimensions but leaves the data unchanged,
    // so this optimization completely blocks layout flashes.
    if (currentOptionJson !== prevOptionJsonRef.current) {
      chart.setOption(option, { notMerge: false, lazyUpdate: true });
      prevOptionJsonRef.current = currentOptionJson;
    }
  }, [option]);

  // Handle Loading state overlay
  useEffect(() => {
    if (!chartInstanceRef.current) {
      return;
    }

    if (loading) {
      chartInstanceRef.current.showLoading({
        text: "Synchronizing...",
        color: "#22c55e",
        textColor: "#e8f5ec",
        maskColor: "rgba(13, 15, 14, 0.8)",
      });
    } else {
      chartInstanceRef.current.hideLoading();
    }
  }, [loading]);

  // Dynamically bind/unbind events
  useEffect(() => {
    const chart = chartInstanceRef.current;
    if (!chart || !onEvents) {
      return;
    }

    const registeredEvents: [string, (params: any) => void][] = [];

    for (const [eventName, handler] of Object.entries(onEvents)) {
      chart.on(eventName, handler);
      registeredEvents.push([eventName, handler]);
    }

    return () => {
      for (const [eventName, handler] of registeredEvents) {
        chart.off(eventName, handler);
      }
    };
  }, [onEvents]);

  return (
    <div
      ref={containerRef}
      style={{ width: "100%", height: "100%", minWidth: 0, minHeight: 0, ...style }}
      className={className}
      data-testid="echarts-container"
    />
  );
}