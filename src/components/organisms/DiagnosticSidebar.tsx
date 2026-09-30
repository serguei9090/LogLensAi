import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { Activity, AlertTriangle, Lightbulb, X } from "lucide-react";

export interface DiagnosticData {
  summary: string;
  root_cause: string;
  recommended_actions: string[];
}

interface DiagnosticSidebarProps {
  open: boolean;
  onClose: () => void;
  data: DiagnosticData | null;
  loading: boolean;
}

export function DiagnosticSidebar({ open, onClose, data, loading }: DiagnosticSidebarProps) {
  return (
    <div
      className={cn(
        "fixed inset-y-0 right-0 w-96 bg-bg-surface-bright border-l border-border shadow-2xl transform transition-transform duration-300 ease-in-out z-50 flex flex-col",
        open ? "translate-x-0" : "translate-x-full",
      )}
    >
      <div className="flex items-center justify-between p-4 border-b border-border bg-bg-surface">
        <div className="flex items-center gap-2 text-primary font-semibold">
          <Activity className="h-5 w-5" />
          <h2>AI Diagnostics</h2>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="h-8 w-8 text-text-muted hover:text-text-primary"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <ScrollArea className="flex-1 p-5">
        {loading ? (
          <div className="space-y-4 animate-pulse">
            <div className="h-4 bg-border rounded w-3/4" />
            <div className="h-4 bg-border rounded w-1/2" />
            <div className="h-4 bg-border rounded w-5/6" />
          </div>
        ) : data ? (
          <div className="space-y-6">
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wider flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-warning" />
                Root Cause
              </h3>
              <p className="text-sm leading-relaxed text-text-primary bg-warning-bg/20 p-3 rounded-md border border-warning/20">
                {data.root_cause}
              </p>
            </div>

            <Separator className="bg-border-muted" />

            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wider">
                Summary
              </h3>
              <p className="text-sm leading-relaxed text-text-primary">{data.summary}</p>
            </div>

            <Separator className="bg-border-muted" />

            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wider flex items-center gap-2">
                <Lightbulb className="h-4 w-4 text-info" />
                Recommended Actions
              </h3>
              <ul className="space-y-2">
                {data.recommended_actions.map((action, i) => (
                  <li
                    key={`action-${i}`}
                    className="flex gap-3 text-sm text-text-primary bg-bg-base p-3 rounded border border-border"
                  >
                    <span className="text-primary font-mono font-bold">{i + 1}.</span>
                    <span className="leading-tight">{action}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-text-muted space-y-4 pt-20">
            <Activity className="h-12 w-12 opacity-20" />
            <p className="text-sm text-center">Select a cluster to analyze</p>
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
