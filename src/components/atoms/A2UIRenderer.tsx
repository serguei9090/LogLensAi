import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { callSidecar } from "@/lib/hooks/useSidecarBridge";
import { useWorkspaceStore } from "@/store/workspaceStore";
import type React from "react";
import { useEffect, useState } from "react";

interface A2UIComponent {
  type: string;
  text?: string;
  label?: string;
  children?: A2UIComponent[];
  props?: Record<string, unknown>;
  action?: {
    type: string;
    [key: string]: unknown;
  };
}

interface A2UIRendererProps {
  payload: unknown;
  onAction?: (action: unknown) => void;
}

const LiveMetric = ({ label, query }: { label: string; query: string }) => {
  const [total, setTotal] = useState<number | null>(null);
  const activeWorkspaceId = useWorkspaceStore((state) => state.activeWorkspaceId);

  useEffect(() => {
    let active = true;
    const fetchIt = async () => {
      try {
        const res = await callSidecar<{ total: number }>({
          method: "get_logs",
          params: {
            workspace_id: activeWorkspaceId || "default",
            query,
            limit: 1,
          },
        });
        if (active) {
          setTotal(res.total);
        }
      } catch (e) {
        console.error(e);
      }
    };
    fetchIt();
    const interval = setInterval(fetchIt, 5000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [query, activeWorkspaceId]);

  return (
    <Card className="bg-bg-surface/50 border-border/60 mb-4 overflow-hidden p-4 flex flex-col items-center justify-center">
      <h3 className="text-xs font-bold text-text-muted uppercase tracking-widest">{label}</h3>
      <div className="text-4xl font-black text-primary mt-2">
        {total !== null ? total.toLocaleString() : "..."}
      </div>
    </Card>
  );
};

const LiveDataTable = ({ title, query }: { title: string; query: string }) => {
  const [logs, setLogs] = useState<any[]>([]);
  const activeWorkspaceId = useWorkspaceStore((state) => state.activeWorkspaceId);

  useEffect(() => {
    let active = true;
    const fetchIt = async () => {
      try {
        const res = await callSidecar<{ logs: any[] }>({
          method: "get_logs",
          params: {
            workspace_id: activeWorkspaceId || "default",
            query,
            limit: 5,
          },
        });
        if (active) {
          setLogs(res.logs);
        }
      } catch (e) {
        console.error(e);
      }
    };
    fetchIt();
    const interval = setInterval(fetchIt, 5000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [query, activeWorkspaceId]);

  return (
    <Card className="bg-bg-surface/50 border-border/60 mb-4 overflow-hidden">
      <CardHeader className="py-3 px-4 border-b border-border/60">
        <CardTitle className="text-[11px] font-bold text-text-primary uppercase tracking-widest">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[11px]">
            <tbody>
              {logs.map((log) => (
                <tr
                  key={log.id}
                  className="border-b border-border/40 hover:bg-bg-surface-bright/30"
                >
                  <td className="p-2 whitespace-nowrap text-text-muted font-mono">
                    {log.timestamp.split(" ")[1]}
                  </td>
                  <td
                    className="p-2 font-bold"
                    style={{ color: `var(--${log.level.toLowerCase()})` }}
                  >
                    {log.level}
                  </td>
                  <td className="p-2 truncate max-w-[200px] text-text-secondary">{log.raw_text}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
};
/**
 * Simple parser for A2UI Markup format (e.g. button label="Text" action={...})
 * Returns a JSON object compatible with the standard renderer.
 */
function parseA2UIMarkup(raw: string): A2UIComponent | null {
  const trimmed = raw.trim();

  // Handle Button Tag: button label="Text" action={...}
  if (trimmed.startsWith("button")) {
    const labelMatch = /label=["']([^"']+)["']/.exec(trimmed);
    const actionMatch = /action=\{([^}]+)\}/.exec(trimmed);

    if (labelMatch) {
      let action: { type: string; [key: string]: unknown } | undefined;
      if (actionMatch) {
        try {
          // Wrapped in {} to make it valid JSON
          action = JSON.parse(`{${actionMatch[1]}}`);
        } catch (e) {
          console.warn("Failed to parse action JSON in A2UI markup:", e);
        }
      }

      return {
        type: "button",
        label: labelMatch[1],
        action,
      };
    }
  }

  // Handle Text Tag: text value="..."
  if (trimmed.startsWith("text")) {
    const textMatch = /value=["']([^"']+)["']/.exec(trimmed);
    if (textMatch) {
      return {
        type: "text",
        text: textMatch[1],
      };
    }
  }

  // Handle Metric Tag: metric label="..." query="..."
  if (trimmed.startsWith("metric")) {
    const labelMatch = /label=["']([^"']+)["']/.exec(trimmed);
    const queryMatch = /query=["']([^"']+)["']/.exec(trimmed);
    if (labelMatch && queryMatch) {
      return {
        type: "metric",
        label: labelMatch[1],
        props: { query: queryMatch[1] },
      };
    }
  }

  // Handle Chart Area Tag: chart_area title="..." query="..."
  if (trimmed.startsWith("chart_area")) {
    const titleMatch = /title=["']([^"']+)["']/.exec(trimmed);
    const queryMatch = /query=["']([^"']+)["']/.exec(trimmed);
    if (titleMatch && queryMatch) {
      return {
        type: "chart_area",
        label: titleMatch[1],
        props: { query: queryMatch[1] },
      };
    }
  }

  // Handle Data Table Tag: data_table title="..." query="..."
  if (trimmed.startsWith("data_table")) {
    const titleMatch = /title=["']([^"']+)["']/.exec(trimmed);
    const queryMatch = /query=["']([^"']+)["']/.exec(trimmed);
    if (titleMatch && queryMatch) {
      return {
        type: "data_table",
        label: titleMatch[1],
        props: { query: queryMatch[1] },
      };
    }
  }

  return null;
}

/**
 * A2UIRenderer maps A2UI v0.9 specific primitives to project-standard shadcn/ui components.
 * Supports both standard JSON payloads and the compact Markup format.
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
        <div className="text-[10px] text-text-muted italic opacity-80 p-3 border border-border/40 rounded-lg bg-bg-surface-bright/50">
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
          <p key={index} className="text-text-secondary text-[13px] leading-relaxed mb-2">
            {comp.text}
          </p>
        );

      case "button":
        return (
          <Button
            key={index}
            variant="outline"
            size="sm"
            className="h-8 border-emerald-500/20 bg-emerald-500/5 text-emerald-400 hover:bg-emerald-500/10 hover:text-emerald-300 text-[11px] font-bold uppercase tracking-wider mb-2 mr-2"
            onClick={() => onAction?.(comp.action)}
          >
            {comp.label}
          </Button>
        );

      case "metric":
        return (
          <LiveMetric
            key={index}
            label={comp.label || "Metric"}
            query={(comp.props?.query as string) || ""}
          />
        );

      case "chart_area":
        // Fallback to metric if backend doesn't support query-based stats yet
        return (
          <LiveMetric
            key={index}
            label={comp.label || "Chart Data"}
            query={(comp.props?.query as string) || ""}
          />
        );

      case "data_table":
        return (
          <LiveDataTable
            key={index}
            title={comp.label || "Data Table"}
            query={(comp.props?.query as string) || ""}
          />
        );

      case "card":
        return (
          <Card key={index} className="bg-bg-surface/50 border-border/60 mb-4 overflow-hidden">
            {comp.label && (
              <CardHeader className="py-3 px-4 border-b border-border/60">
                <CardTitle className="text-[11px] font-bold text-text-primary uppercase tracking-widest">
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
