import type { LogSource } from "@/store/workspaceStore";

export interface FusionSourceConfig {
  source_id: string;
  enabled: boolean;
  tz_offset: number;
  custom_format: string | null;
  parser_config: string | null;
}

export interface DiscoveryTemplate {
  id: number;
  name: string;
  config: string;
  created_at: string;
}

export type OrchestratorView =
  | "picker"
  | "fusion-form"
  | "ai-context-form"
  | "time-alignment-form";

export interface OrchestratorHubProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly workspaceId: string;
  readonly availableSources: LogSource[];
  readonly editingFusionId?: string | null;
  readonly editingFusionName?: string | null;
  readonly onFusionSaved: (
    fusionId: string,
    fusionName: string,
    configs: FusionSourceConfig[],
  ) => void;
  readonly onEngineSettingsOpen?: () => void;
}
