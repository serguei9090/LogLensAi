// Assume Role: Frontend Engineer (@frontend)

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

  // Initialize ECharts instance
  useEffect(() => {
    if (!containerRef.current) {
      return;
    }

    const chart = echarts.init(containerRef.current);
    chartInstanceRef.current = chart;

    if (onChartInit) {
      onChartInit(chart);
    }

    // Handle Resize using ResizeObserver to avoid layout delays
    const resizeObserver = new ResizeObserver((_entries) => {
      window.requestAnimationFrame(() => {
        if (!containerRef.current) {
          return;
        }
        chart.resize();
      });
    });

    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      chart.dispose();
      chartInstanceRef.current = null;
    };
  }, [onChartInit]);

  // Update options when they change
  useEffect(() => {
    if (chartInstanceRef.current) {
      chartInstanceRef.current.setOption(option, { notMerge: true });
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
        color: "var(--color-primary)",
        textColor: "var(--color-text-primary)",
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
