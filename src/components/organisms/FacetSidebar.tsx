import { motion } from "framer-motion";
import { FilterX, PanelLeftClose } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useInvestigationStore } from "@/store/investigationStore";
import { useUIStore } from "@/store/uiStore";
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
        marginRight: 0,
      }}
      transition={{ type: "spring", stiffness: 400, damping: 40 }}
      className={cn(
        "border-r border-border-subtle bg-bg-app flex flex-col h-full overflow-hidden select-none relative",
        facetSidebarCollapsed ? "pointer-events-none" : "",
      )}
    >
      <div className="h-12 border-b border-border-subtle flex items-center justify-between px-4 shrink-0">
        <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider whitespace-nowrap">
          Log Facets
        </span>
        <div className="flex items-center gap-1">
          {hasFacetFilters && (
            <Button
              variant="ghost"
              size="icon"
              onClick={clearFacetFilters}
              className="h-7 w-7 text-text-muted hover:text-primary hover:bg-primary/10 transition-colors"
              title="Clear Facet Filters"
            >
              <FilterX className="h-3.5 w-3.5" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleFacetSidebar}
            className="h-7 w-7 text-text-muted hover:text-primary hover:bg-primary/10 transition-colors"
            title="Collapse Facets"
          >
            <PanelLeftClose className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <FacetList />
      </ScrollArea>
    </motion.div>
  );
}
