import { GridPattern } from "@/components/atoms/GridPattern";
import { Button } from "@/components/ui/button";
import type { IngestionJob } from "@/lib/hooks/useIngestionStatus";
import {
  Download,
  FileUp,
  Filter,
  Rocket,
  Sparkles,
} from "lucide-react";

interface TableOverlaysProps {
  readonly showPreparing: boolean;
  readonly showHydrating: boolean;
  readonly showOverlay: boolean;
  readonly isQueued: boolean;
  readonly isIndexing: boolean;
  readonly activeJob?: IngestionJob | null;
  readonly isEmpty: boolean;
  readonly hasActiveFilters: boolean;
  readonly searchQuery?: string;
  readonly onClearFilters: () => void;
  readonly onImport?: () => void;
}

export function TableOverlays({
  showPreparing,
  showHydrating,
  showOverlay,
  isQueued,
  isIndexing,
  activeJob,
  isEmpty,
  hasActiveFilters,
  searchQuery,
  onClearFilters,
  onImport,
}: TableOverlaysProps) {
  if (showPreparing) {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center animate-in fade-in zoom-in-95 duration-500 bg-bg-base/50 backdrop-blur-sm z-50">
        <div className="flex flex-col items-center gap-6 max-w-md w-full">
          <div className="relative">
            <div className="absolute -inset-4 bg-primary/20 rounded-full blur-2xl animate-pulse" />
            <div className="relative bg-bg-surface border border-border shadow-2xl rounded-2xl p-6">
              <Sparkles className="size-12 text-primary animate-pulse" />
            </div>
          </div>
          <div className="space-y-2">
            <h3 className="text-xl font-bold text-text-primary animate-pulse">
              Preparing Ingestion...
            </h3>
            <p className="text-sm text-text-muted leading-relaxed">
              Initializing storage buffers and checking queue status.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (showHydrating) {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center animate-in fade-in zoom-in-95 duration-500 bg-bg-base/50 backdrop-blur-sm z-50">
        <div className="flex flex-col items-center gap-6 max-w-md w-full">
          <div className="relative">
            <div className="absolute -inset-4 bg-primary/20 rounded-full blur-2xl animate-pulse" />
            <div className="relative bg-bg-surface border border-border shadow-2xl rounded-2xl p-6">
              <Sparkles className="size-12 text-primary animate-pulse" />
            </div>
          </div>
          <div className="space-y-2">
            <h3 className="text-xl font-bold text-text-primary animate-pulse">
              Retrieving logs...
            </h3>
            <p className="text-sm text-text-muted leading-relaxed">
              Hydrating log records from storage.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (showOverlay && !showPreparing && !showHydrating) {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center animate-in fade-in zoom-in-95 duration-500 bg-bg-base/50 backdrop-blur-sm z-50">
        <div className="flex flex-col items-center gap-6 max-w-md w-full">
          {isQueued && activeJob ? (
            <>
              <div className="relative">
                <div className="absolute -inset-4 bg-amber-500/20 rounded-full blur-2xl animate-pulse" />
                <div className="relative bg-bg-surface border border-amber-500/30 shadow-2xl rounded-2xl p-6">
                  <span className="text-4xl">⏳</span>
                </div>
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-bold text-amber-400">Queued for Processing</h3>
                <p className="text-sm text-text-muted leading-relaxed">
                  {activeJob.queue_position > 1
                    ? `This file is position #${activeJob.queue_position} in the queue. The system processes one file at a time to ensure maximum throughput and data integrity.`
                    : "This file is next in line. Processing will begin momentarily."}
                </p>
              </div>
              <div className="w-full space-y-2">
                <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden border border-white/5 relative">
                  <div className="h-full w-full bg-gradient-to-r from-transparent via-amber-500/60 to-transparent animate-shimmer absolute inset-0" />
                </div>
                <p className="text-xs text-amber-400/60 font-bold uppercase tracking-widest text-center">
                  {activeJob.total_lines > 0
                    ? `${activeJob.total_lines.toLocaleString()} lines ready to index`
                    : "Counting lines..."}
                </p>
              </div>
            </>
          ) : (
            <>
              <div className="relative">
                <div className="absolute -inset-4 bg-primary/20 rounded-full blur-2xl animate-pulse" />
                <div className="relative bg-bg-surface border border-border shadow-2xl rounded-2xl p-6">
                  <Sparkles className="size-12 text-primary animate-pulse" />
                </div>
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-bold text-text-primary animate-pulse">
                  {isIndexing ? "Indexing Dataset..." : "Retrieving logs..."}
                </h3>
                <p className="text-sm text-text-muted leading-relaxed">
                  {isIndexing
                    ? "Building database indices and mapping patterns for the complete file. Almost ready."
                    : "Hydrating log records from storage."}
                </p>
              </div>
              {isIndexing && (
                <div className="w-full space-y-3">
                  {activeJob ? (
                    <>
                      <div className="flex justify-between text-xs font-bold uppercase tracking-widest text-text-muted">
                        <span>
                          {activeJob.processed_lines.toLocaleString()} /{" "}
                          {activeJob.total_lines.toLocaleString()} lines
                        </span>
                        <span className="text-primary">
                          {Math.round(
                            (activeJob.processed_lines / activeJob.total_lines) * 100,
                          )}
                          %
                        </span>
                      </div>
                      <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden border border-white/5">
                        <div
                          className="h-full bg-primary transition-all duration-500 ease-out shadow-[0_0_10px_rgba(34,197,94,0.5)]"
                          style={{
                            width: `${
                              activeJob.total_lines > 0
                                ? (activeJob.processed_lines / activeJob.total_lines) * 100
                                : 0
                            }%`,
                          }}
                        />
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex justify-between text-xs font-bold uppercase tracking-widest text-text-muted">
                        <span>Preparing Ingestion...</span>
                      </div>
                      <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden border border-white/5 relative">
                        <div className="h-full w-full bg-gradient-to-r from-transparent via-primary/80 to-transparent animate-shimmer absolute inset-0" />
                      </div>
                    </>
                  )}
                </div>
              )}
            </>
          )}
        </div>
        {(isQueued || isIndexing) && (
          <div className="mt-12 flex items-center gap-6 text-xs font-bold uppercase tracking-widest text-text-muted/30">
            <div className="flex items-center gap-1.5">
              <Download className="size-3" /> local files
            </div>
            <div className="w-1 h-1 rounded-full bg-current" />
            <div className="flex items-center gap-1.5">
              <Rocket className="size-3" /> live streams
            </div>
            <div className="w-1 h-1 rounded-full bg-current" />
            <div className="flex items-center gap-1.5">
              <Sparkles className="size-3" /> ssh tailing
            </div>
          </div>
        )}
      </div>
    );
  }

  if (isEmpty) {
    if (hasActiveFilters) {
      return (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center animate-in fade-in zoom-in-95 duration-300 relative overflow-hidden">
          <GridPattern width={24} height={24} className="opacity-30" dotSize={1} />
          <div className="relative mb-6 z-10">
            <div className="absolute -inset-4 bg-amber-500/10 rounded-full blur-2xl" />
            <div className="relative bg-bg-surface border border-border shadow-2xl rounded-2xl p-6">
              <Filter className="size-12 text-amber-400" />
            </div>
          </div>
          <h3 className="text-xl font-bold text-text-primary z-10">
            No logs match active filters
          </h3>
          <p className="text-sm text-text-muted mt-2 max-w-[340px] leading-relaxed z-10">
            {searchQuery ? `No results found matching query "${searchQuery}". ` : ""}
            Adjust or clear your active filters to display matching log records.
          </p>
          <Button
            onClick={onClearFilters}
            variant="outline"
            className="mt-6 px-6 py-2.5 rounded-xl border-border/80 hover:bg-white/5 text-text-primary font-semibold transition-all active:scale-95 z-10"
          >
            Clear Filters
          </Button>
        </div>
      );
    }

    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center animate-in fade-in zoom-in-95 duration-500 relative overflow-hidden">
        <GridPattern width={24} height={24} className="opacity-35" dotSize={1} />
        <div className="relative mb-6 z-10">
          <div className="absolute -inset-4 bg-primary/10 rounded-full blur-2xl animate-pulse" />
          <div className="relative bg-bg-surface border border-border shadow-2xl rounded-2xl p-6">
            <FileUp className="size-12 text-primary" />
          </div>
        </div>
        <h3 className="text-xl font-bold text-text-primary z-10">No logs detected</h3>
        <p className="text-sm text-text-muted mt-2 max-w-[280px] leading-relaxed z-10">
          This workspace is currently empty. Connect a data source or upload a log file to begin analysis.
        </p>
        <Button
          onClick={onImport}
          className="mt-8 px-8 py-6 rounded-2xl bg-primary hover:bg-primary-hover text-white font-bold shadow-xl shadow-primary/20 transition-all active:scale-95 group z-10"
        >
          <Rocket className="size-5 mr-2 group-hover:-translate-y-0.5 transition-transform duration-200 ease-out" />
          Import First Log
        </Button>
        <div className="mt-12 flex items-center gap-6 text-xs font-bold uppercase tracking-widest text-text-muted/30 z-10">
          <div className="flex items-center gap-1.5">
            <Download className="size-3" /> local files
          </div>
          <div className="w-1 h-1 rounded-full bg-current" />
          <div className="flex items-center gap-1.5">
            <Rocket className="size-3" /> live streams
          </div>
          <div className="w-1 h-1 rounded-full bg-current" />
          <div className="flex items-center gap-1.5">
            <Sparkles className="size-3" /> ssh tailing
          </div>
        </div>
      </div>
    );
  }

  return null;
}
