import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { callSidecar } from "@/lib/hooks/useSidecarBridge";
import { useWorkspaceStore } from "@/store/workspaceStore";
import { useEffect, useState } from "react";

export interface A2UILogTableProps {
  readonly title: string;
  readonly query: string;
  readonly sourceIds?: string[];
}

export function A2UILogTable({ title, query, sourceIds }: A2UILogTableProps) {
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
            source_ids: sourceIds && sourceIds.length > 0 ? sourceIds : undefined,
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
    const interval = setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") {
        return;
      }
      fetchIt();
    }, 5000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [query, activeWorkspaceId, sourceIds]);

  return (
    <Card className="bg-bg-surface/50 border-border/60 mb-4 overflow-hidden">
      <CardHeader className="py-3 px-4 border-b border-border/60">
        <CardTitle className="text-xs font-bold text-text-primary uppercase tracking-widest">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
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
}
