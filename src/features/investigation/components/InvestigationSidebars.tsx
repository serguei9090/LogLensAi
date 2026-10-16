import { ColumnManagerSidebar } from "../ColumnManagerSidebar";
import { FacetSidebar } from "../FacetSidebar";
import { AIInvestigationSidebar } from "../ai-sidebar";

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
