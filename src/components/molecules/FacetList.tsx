import { useInvestigationStore } from "@/store/investigationStore";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, ChevronRight, Database } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import type { FilterEntry } from "./FilterBuilder";

interface FacetListProps {
  onApplyFilter?: (key: string, value: string) => void;
  className?: string;
}

export function FacetList({ onApplyFilter, className }: FacetListProps) {
  const { availableFacets, filters, setFilters } = useInvestigationStore();
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(
    new Set(["ip", "uuid", "level", "email", "user_id"])
  );

  const toggleKey = (key: string) => {
    const next = new Set(expandedKeys);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setExpandedKeys(next);
  };

  const handleApplyFilter = (key: string, value: string) => {
    if (onApplyFilter) {
      onApplyFilter(key, value);
      return;
    }

    const field = key === "level" ? "level" : `facets.${key}`;
    // Check if filter already exists
    if (filters.some((f: FilterEntry) => f.field === field && f.value === value)) return;

    setFilters([...filters, { id: crypto.randomUUID(), field, value, operator: "equals" }]);
  };

  if (Object.entries(availableFacets).length === 0) {
    return (
      <div className={cn("px-6 py-10 text-center", className)}>
        <Database className="h-8 w-8 text-[#1D2420] mx-auto mb-3" />
        <p className="text-[11px] text-[#4d6057]">
          No metadata facets detected in current view.
        </p>
      </div>
    );
  }

  return (
    <div className={cn("py-2 space-y-1", className)}>
      {Object.entries(availableFacets).map(([key, values]) => (
        <div key={key} className="px-2">
          <button
            onClick={() => toggleKey(key)}
            className="w-full flex items-center gap-2 px-2 py-1.5 hover:bg-[#1E2520] rounded text-[#E8F5EC] transition-colors group"
          >
            {expandedKeys.has(key) ? (
              <ChevronDown className="h-3.5 w-3.5 text-[#4D6057]" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 text-[#4D6057]" />
            )}
            <span className="text-xs font-medium capitalize flex-1 text-left">{key}</span>
            <span className="text-[10px] text-[#4D6057] group-hover:text-[#22C55E]">
              {values.length}
            </span>
          </button>

          <AnimatePresence initial={false}>
            {expandedKeys.has(key) && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="pl-6 pr-2 py-1 space-y-1">
                  {values.map((v) => {
                    const field = key === "level" ? "level" : `facets.${key}`;
                    const isActive = filters.some(
                      (f: FilterEntry) => f.field === field && f.value === v.value
                    );
                    return (
                      <button
                        key={v.value}
                        onClick={() => handleApplyFilter(key, v.value)}
                        className={cn(
                          "w-full flex items-center justify-between group py-1 px-2 rounded text-[11px] transition-all",
                          isActive
                            ? "bg-[#22C55E15] text-[#22C55E]"
                            : "text-[#8FA898] hover:bg-[#1E2520] hover:text-[#E8F5EC]"
                        )}
                      >
                        <span className="truncate max-w-[140px] font-mono">{v.value}</span>
                        <span className="text-[9px] opacity-40 group-hover:opacity-100">
                          {v.count}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ))}
    </div>
  );
}
