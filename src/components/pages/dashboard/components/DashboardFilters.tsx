import { type TimeRange, TimeRangePicker } from "@/components/molecules/TimeRangePicker";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { RefreshCcw } from "lucide-react";

export interface DashboardFiltersProps {
  readonly selectedWorkspaceId: string;
  readonly onWorkspaceChange: (v: string) => void;
  readonly workspaces: any[];
  readonly selectedSourceId: string;
  readonly onSourceChange: (v: string) => void;
  readonly sources: any[];
  readonly timeRange: TimeRange;
  readonly onTimeRangeChange: (tr: TimeRange) => void;
  readonly timeBounds: { min: string; max: string } | null;
  readonly onResetTime: () => void;
  readonly loading: boolean;
  readonly onRefresh: () => void;
}

export function DashboardFilters({
  selectedWorkspaceId,
  onWorkspaceChange,
  workspaces,
  selectedSourceId,
  onSourceChange,
  sources,
  timeRange,
  onTimeRangeChange,
  timeBounds,
  onResetTime,
  loading,
  onRefresh,
}: Readonly<DashboardFiltersProps>) {
  const selectedWorkspace = workspaces.find((w) => w.id === selectedWorkspaceId);
  const selectedSource = sources.find((s) => s.id === selectedSourceId);

  const isFiltered =
    timeBounds &&
    ((timeRange.start && timeRange.start !== timeBounds.min) ||
      (timeRange.end && timeRange.end !== timeBounds.max));

  return (
    <div className="flex flex-wrap items-center gap-3 bg-bg-surface/30 p-2 rounded-xl border border-border/50 backdrop-blur-sm">
      <div className="flex items-center gap-2">
        <span className="text-xs font-bold uppercase tracking-widest text-text-muted ml-2">
          Context:
        </span>

        <Select value={selectedWorkspaceId} onValueChange={(val) => val && onWorkspaceChange(val)}>
          <SelectTrigger className="w-[180px] h-8 text-xs bg-bg-base/40 border-white/5 hover:border-white/10 transition-all font-medium">
            <SelectValue placeholder="Select Workspace">{selectedWorkspace?.name}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {workspaces.map((w) => (
              <SelectItem key={w.id} value={w.id}>
                {w.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={selectedSourceId}
          onValueChange={(val) => val && onSourceChange(val)}
          disabled={selectedWorkspaceId === "all"}
        >
          <SelectTrigger className="w-[180px] h-8 text-xs bg-bg-base/40 border-white/5 hover:border-white/10 transition-all font-medium">
            <SelectValue placeholder="Log Source">
              {selectedSourceId === "all" ? "Entire Workspace" : selectedSource?.name}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Entire Workspace</SelectItem>
            {sources.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="h-4 w-px bg-border/50 mx-1" />

      <div className="flex items-center gap-2">
        <span className="text-xs font-bold uppercase tracking-widest text-text-muted">Time:</span>
        {isFiltered && (
          <button
            type="button"
            onClick={onResetTime}
            className="text-xs h-7 px-2 border border-primary/20 bg-primary/5 text-primary hover:bg-primary hover:text-text-inverse transition-all rounded font-semibold cursor-pointer"
          >
            All Time
          </button>
        )}
        <TimeRangePicker
          value={timeRange}
          onChange={onTimeRangeChange}
          className="h-8 scale-90 origin-left"
        />
        <Button
          variant="outline"
          size="icon"
          onClick={onRefresh}
          title="Refresh Data"
          className="h-8 w-8 text-text-muted hover:text-primary border-white/5 hover:border-white/10 bg-bg-base/40 transition-all"
        >
          <RefreshCcw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
        </Button>
      </div>
    </div>
  );
}
