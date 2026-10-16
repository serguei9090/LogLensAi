import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type React from "react";
import { A2UIChartArea } from "./components/A2UIChartArea";
import { A2UILogTable } from "./components/A2UILogTable";
import { A2UIMetricCard } from "./components/A2UIMetricCard";
import type { A2UIComponent, A2UIRendererProps } from "./types";
import { parseA2UIMarkup } from "./utils/markupParser";

/**
 * A2UIRenderer Organism
 * Maps A2UI v0.9 blueprint specifications and markup to interactive, live-queried UI components.
 */
export const A2UIRenderer: React.FC<A2UIRendererProps> = ({ payload, onAction }) => {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  // Handle the "markup" wrapper sent by the sidecar
  let resolvedPayload: A2UIComponent | null = null;
  const rawPayload = payload as Record<string, unknown>;

  if (rawPayload.type === "markup" && typeof rawPayload.raw === "string") {
    const parsed = parseA2UIMarkup(rawPayload.raw);
    if (!parsed) {
      return (
        <div className="text-xs text-text-muted italic opacity-80 p-3 border border-border/40 rounded-lg bg-bg-surface-bright/50">
          [Malformed A2UI Blueprint]
        </div>
      );
    }
    resolvedPayload = parsed;
  } else {
    resolvedPayload = payload as A2UIComponent;
  }

  const renderComponent = (comp: A2UIComponent, index: number): React.ReactNode => {
    switch (comp.type) {
      case "text":
        return (
          <p key={index} className="text-text-secondary text-sm leading-relaxed mb-2">
            {comp.text}
          </p>
        );

      case "button":
        return (
          <Button
            key={index}
            variant="outline"
            size="sm"
            aria-label={comp.label ? `Action: ${comp.label}` : "Interactive Action"}
            className="h-8 border-emerald-500/20 bg-emerald-500/5 text-emerald-400 hover:bg-emerald-500/10 hover:text-emerald-300 text-xs font-bold uppercase tracking-wider mb-2 mr-2"
            onClick={() => onAction?.(comp.action)}
          >
            {comp.label}
          </Button>
        );

      case "metric":
        return (
          <A2UIMetricCard
            key={index}
            label={comp.label || "Metric"}
            query={(comp.props?.query as string) || ""}
            sourceIds={comp.props?.source_ids as string[] | undefined}
            color={comp.props?.color as string | undefined}
          />
        );

      case "chart_area":
        return (
          <A2UIChartArea
            key={index}
            title={comp.label || "Traffic History"}
            query={(comp.props?.query as string) || ""}
            sourceIds={comp.props?.source_ids as string[] | undefined}
          />
        );

      case "data_table":
        return (
          <A2UILogTable
            key={index}
            title={comp.label || "Data Table"}
            query={(comp.props?.query as string) || ""}
            sourceIds={comp.props?.source_ids as string[] | undefined}
          />
        );

      case "card":
        return (
          <Card key={index} className="bg-bg-surface/50 border-border/60 mb-4 overflow-hidden">
            {comp.label && (
              <CardHeader className="py-3 px-4 border-b border-border/60">
                <CardTitle className="text-xs font-bold text-text-primary uppercase tracking-widest">
                  {comp.label}
                </CardTitle>
              </CardHeader>
            )}
            <CardContent className="p-4">
              {comp.children?.map((child, i) => renderComponent(child, i))}
            </CardContent>
          </Card>
        );

      case "stack_v":
        return (
          <div key={index} className="flex flex-col gap-2 mb-4">
            {comp.children?.map((child, i) => renderComponent(child, i))}
          </div>
        );

      case "stack_h":
        return (
          <div key={index} className="flex flex-row flex-wrap gap-2 mb-4">
            {comp.children?.map((child, i) => renderComponent(child, i))}
          </div>
        );

      case "surface":
      case "root":
        return (
          <div
            key={index}
            className="a2ui-surface w-full animate-in fade-in slide-in-from-bottom-2"
          >
            {comp.children?.map((child, i) => renderComponent(child, i))}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="a2ui-renderer w-full mt-2">
      {resolvedPayload && renderComponent(resolvedPayload, 0)}
    </div>
  );
};
