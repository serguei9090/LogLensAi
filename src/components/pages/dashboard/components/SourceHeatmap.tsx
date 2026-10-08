import type { DashboardStats } from "../types";

export interface SourceHeatmapProps {
  readonly stats: DashboardStats | null;
}

const SKELETON_ROWS = ["sk-row-1", "sk-row-2"];
const SKELETON_CELLS = Array.from({ length: 24 }, (_, i) => `sk-cell-${i}`);

export function SourceHeatmap({ stats }: Readonly<SourceHeatmapProps>) {
  if (!stats) {
    return (
      <div className="space-y-4 animate-pulse">
        {SKELETON_ROWS.map((rowKey) => (
          <div key={rowKey} className="flex items-center gap-4">
            <div className="h-3 w-32 bg-white/10 rounded" />
            <div className="flex-1 flex gap-1 h-4">
              {SKELETON_CELLS.map((cellKey) => (
                <div
                  key={cellKey}
                  className="h-full flex-1 rounded-sm bg-white/5"
                  style={{ minWidth: "4px" }}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (stats.source_heatmap.length === 0) {
    return (
      <div className="py-20 text-center text-xs font-mono text-text-muted uppercase tracking-widest">
        Insufficient Source Data
      </div>
    );
  }

  const uniqueSources = Array.from(new Set(stats.source_heatmap.map((d) => d.source_name)));

  return (
    <div className="relative z-10">
      <div className="flex flex-col gap-4">
        {uniqueSources.map((sourceName) => {
          const sourceData = stats.source_heatmap.filter((d) => d.source_name === sourceName);
          const maxCount = Math.max(...sourceData.map((d) => d.count));

          return (
            <div key={sourceName} className="flex items-center gap-4">
              <span className="text-xs font-mono text-text-muted w-32 truncate">{sourceName}</span>
              <div className="flex-1 grid grid-cols-[repeat(50,minmax(0,1fr))] gap-1 h-4">
                {sourceData.slice(-50).map((d) => {
                  const intensity = maxCount > 0 ? d.count / maxCount : 0;
                  return (
                    <div
                      key={`${d.source_name}-${d.timestamp}`}
                      className="h-full rounded-sm border border-white/5 transition-[transform,background-color] duration-200 hover:scale-115"
                      style={{
                        backgroundColor: `rgba(34, 197, 94, ${intensity})`,
                      }}
                      title={`${d.timestamp}: ${d.count} logs`}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
