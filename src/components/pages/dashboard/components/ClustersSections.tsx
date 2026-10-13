import { ClusterRow } from "@/components/molecules/ClusterRow";
import { AlertCircle, AlertTriangle } from "lucide-react";
import type { ReactNode } from "react";
import type { DashboardStats } from "../types";

export interface ClustersSectionProps {
  readonly stats: DashboardStats | null;
  readonly selectedWorkspaceId: string;
}

const SKELETON_CLUSTERS = ["sk-cluster-1", "sk-cluster-2", "sk-cluster-3"];

export function ErrorClustersSection({ stats, selectedWorkspaceId }: ClustersSectionProps) {
  let content: ReactNode;
  if (stats === null) {
    content = SKELETON_CLUSTERS.map((rowKey) => (
      <div
        key={rowKey}
        className="flex flex-col gap-3 p-3 rounded-lg border border-white/5 bg-bg-surface/30 animate-pulse"
      >
        <div className="flex items-center gap-4">
          <div className="h-3 w-6 bg-white/5 rounded" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-3/4 bg-white/10 rounded" />
            <div className="h-2 w-full bg-white/5 rounded" />
          </div>
        </div>
      </div>
    ));
  } else if (stats.top_error_clusters.length > 0) {
    content = stats.top_error_clusters.map((c, idx) => (
      <ClusterRow
        key={c.template}
        index={idx}
        template={c.template}
        count={c.count}
        total={stats.total_logs}
        type="error"
        clusterId={(c as any).cluster_id}
        workspaceId={selectedWorkspaceId}
        category={(c as any).category}
        severity={(c as any).severity}
        isOutage={(c as any).is_outage}
        confidence={(c as any).confidence}
        ragTag={(c as any).rag_tag}
        isKnownIssue={(c as any).is_known_issue}
      />
    ));
  } else {
    content = (
      <div className="py-20 text-center text-xs font-mono text-text-muted uppercase tracking-widest">
        No Errors Detected
      </div>
    );
  }

  return (
    <section className="bg-bg-surface/50 border border-border rounded-xl p-6 backdrop-blur-sm relative overflow-hidden">
      <div className="flex items-center gap-2 mb-6">
        <AlertTriangle className="h-4 w-4 text-error" />
        <h2 className="text-xs font-bold uppercase tracking-widest text-text-muted">
          Top Error Clusters
        </h2>
      </div>
      <div className="space-y-2 relative z-10">{content}</div>
    </section>
  );
}

export function NoiseClustersSection({ stats, selectedWorkspaceId }: ClustersSectionProps) {
  let content: ReactNode;
  if (stats === null) {
    content = SKELETON_CLUSTERS.map((rowKey) => (
      <div
        key={rowKey}
        className="flex flex-col gap-3 p-3 rounded-lg border border-white/5 bg-bg-surface/30 animate-pulse"
      >
        <div className="flex items-center gap-4">
          <div className="h-3 w-6 bg-white/5 rounded" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-3/4 bg-white/10 rounded" />
            <div className="h-2 w-full bg-white/5 rounded" />
          </div>
        </div>
      </div>
    ));
  } else if (stats.top_clusters.length > 0) {
    content = stats.top_clusters.map((c, idx) => (
      <ClusterRow
        key={c.template}
        index={idx}
        template={c.template}
        count={c.count}
        total={stats.total_logs}
        type="noise"
        clusterId={(c as any).cluster_id}
        workspaceId={selectedWorkspaceId}
        category={(c as any).category}
        severity={(c as any).severity}
        isOutage={(c as any).is_outage}
        confidence={(c as any).confidence}
        ragTag={(c as any).rag_tag}
        isKnownIssue={(c as any).is_known_issue}
      />
    ));
  } else {
    content = (
      <div className="py-20 text-center text-xs font-mono text-text-muted uppercase tracking-widest">
        No Clusters
      </div>
    );
  }

  return (
    <section className="bg-bg-surface/50 border border-border rounded-xl p-6 backdrop-blur-sm relative overflow-hidden">
      <div className="flex items-center gap-2 mb-6">
        <AlertCircle className="h-4 w-4 text-debug" />
        <h2 className="text-xs font-bold uppercase tracking-widest text-text-muted">
          Top Noise Generators
        </h2>
      </div>
      <div className="space-y-2 relative z-10">{content}</div>
    </section>
  );
}
