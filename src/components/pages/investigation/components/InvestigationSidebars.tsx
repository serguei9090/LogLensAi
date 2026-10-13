import { ColumnManagerSidebar } from "@/components/organisms/ColumnManagerSidebar";
import { FacetSidebar } from "@/components/organisms/FacetSidebar";
import { AIInvestigationSidebar } from "@/components/organisms/ai-sidebar";

interface InvestigationSidebarsProps {
  readonly isSourceLoading: boolean;
  readonly isFetching: boolean;
  readonly hasActiveJob: boolean;
  readonly onEngineSettingsOpen: () => void;
}

export function InvestigationLeftSidebar({
  isSourceLoading,
  isFetching,
  hasActiveJob,
}: Omit<InvestigationSidebarsProps, "onEngineSettingsOpen">) {
  return (
    <>
      <FacetSidebar isLoading={isSourceLoading || isFetching || hasActiveJob} />
      <ColumnManagerSidebar />
    </>
  );
}

export function InvestigationRightSidebar({
  onEngineSettingsOpen,
}: Pick<InvestigationSidebarsProps, "onEngineSettingsOpen">) {
  return <AIInvestigationSidebar onEngineSettingsOpen={onEngineSettingsOpen} />;
}
