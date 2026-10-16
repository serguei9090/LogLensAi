import { useKeyboardShortcuts } from "@/lib/hooks/useKeyboardShortcuts";
import { useEffect } from "react";
import { toast } from "sonner";

interface UseInvestigationShortcutsOptions {
  readonly searchRef: React.RefObject<HTMLInputElement | null>;
  readonly fetchLogs: (opts?: { forceFull?: boolean }) => void;
  readonly setSearchQuery: (q: string) => void;
  readonly setFilters: (f: any[]) => void;
  readonly setHighlights: (h: any[]) => void;
}

export function useInvestigationShortcuts({
  searchRef,
  fetchLogs,
  setSearchQuery,
  setFilters,
  setHighlights,
}: UseInvestigationShortcutsOptions) {
  useEffect(() => {
    const handleRefresh = () => fetchLogs({ forceFull: true });
    const handleClear = () => {
      setSearchQuery("");
      setFilters([]);
      setHighlights([]);
      toast.info("Filters cleared");
    };

    globalThis.addEventListener("loglens:refresh-logs", handleRefresh);
    globalThis.addEventListener("loglens:clear-filters", handleClear);
    return () => {
      globalThis.removeEventListener("loglens:refresh-logs", handleRefresh);
      globalThis.removeEventListener("loglens:clear-filters", handleClear);
    };
  }, [fetchLogs, setSearchQuery, setFilters, setHighlights]);

  useKeyboardShortcuts([
    {
      key: "f",
      ctrl: true,
      description: "Focus Search",
      handler: () => searchRef.current?.focus(),
    },
    {
      key: "r",
      description: "Refresh Logs",
      handler: () => fetchLogs({ forceFull: true }),
    },
    {
      key: "Escape",
      description: "Clear Filters",
      handler: () => {
        setSearchQuery("");
        setFilters([]);
        setHighlights([]);
      },
    },
  ]);
}
