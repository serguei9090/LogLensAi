import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useInvestigationStore } from "@/store/investigationStore";
import { useUIStore } from "@/store/uiStore";
import { motion } from "framer-motion";
import { FilterX, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { FacetList } from "../molecules/FacetList";

export function FacetSidebar() {
  const { filters, setFilters } = useInvestigationStore();
  const { facetSidebarCollapsed, toggleFacetSidebar } = useUIStore();

  const clearFacetFilters = () => {
    setFilters(filters.filter((f) => !f.field.startsWith("facets.") && f.field !== "level"));
  };

  const hasFacetFilters = filters.some((f) => f.field.startsWith("facets.") || f.field === "level");

  return (
    <motion.div
      initial={false}
      animate={{
        width: facetSidebarCollapsed ? 0 : 256,
        opacity: facetSidebarCollapsed ? 0 : 1,
        marginRight: facetSidebarCollapsed ? 0 : 0,
      }}
      transition={{ type: "spring", stiffness: 400, damping: 40 }}
      className={cn(
        "border-r border-[#1D2420] bg-[#0d0f0e] flex flex-col h-full overflow-hidden select-none relative",
        facetSidebarCollapsed ? "pointer-events-none" : "",
      )}
    >
      <div className="h-12 border-b border-[#1D2420] flex items-center justify-between px-4 shrink-0">
        <span className="text-xs font-semibold text-[#8FA898] uppercase tracking-wider whitespace-nowrap">
          Log Facets
        </span>
        <div className="flex items-center gap-1">
          {hasFacetFilters && (
            <button
              type="button"
              onClick={clearFacetFilters}
              className="p-1 hover:bg-[#22C55E10] text-[#4d6057] hover:text-[#22C55E] rounded transition-colors"
              title="Clear Facet Filters"
            >
              <FilterX className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            type="button"
            onClick={toggleFacetSidebar}
            className="p-1 hover:bg-[#22C55E10] text-[#4d6057] hover:text-[#22C55E] rounded transition-colors"
            title="Collapse Facets"
          >
            <PanelLeftClose className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <FacetList />
      </ScrollArea>
    </motion.div>
  );
}
