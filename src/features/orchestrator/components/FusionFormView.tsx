import { cn } from "@/lib/utils";
import type { LogSource } from "@/store/workspaceStore";
import { Check, Settings2 } from "lucide-react";
import type { DiscoveryTemplate, FusionSourceConfig } from "../types";

interface FusionFormViewProps {
  readonly fusionName: string;
  readonly setFusionName: (v: string) => void;
  readonly configs: FusionSourceConfig[];
  readonly availableSources: LogSource[];
  readonly templates: DiscoveryTemplate[];
  readonly isLoadingConfig: boolean;
  readonly onToggleSource: (sourceId: string) => void;
  readonly onApplyTemplate: (sourceId: string, templateId: string) => void;
  readonly onOpenParser: (sourceId: string) => void;
  readonly onBack: () => void;
}

export function FusionFormView({
  fusionName,
  setFusionName,
  configs,
  availableSources,
  templates,
  isLoadingConfig,
  onToggleSource,
  onApplyTemplate,
  onOpenParser,
  onBack,
}: FusionFormViewProps) {
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-2 duration-300 outline-none">
      <button
        type="button"
        onClick={onBack}
        className="text-xs text-white/50 hover:text-white transition-all flex items-center gap-1.5"
      >
        ← Back
      </button>

      <div className="space-y-5">
        <div className="space-y-1.5">
          <label
            htmlFor="fusion-name-input"
            className="text-xs font-medium text-white/40 px-0.5 uppercase tracking-wider"
          >
            Name
          </label>
          <input
            id="fusion-name-input"
            type="text"
            value={fusionName}
            onChange={(e) => setFusionName(e.target.value)}
            placeholder="e.g. Cluster Primary 01"
            className="w-full h-10 bg-white/5 border border-white/10 rounded-lg px-3 text-sm text-white outline-none focus:border-white/30 transition-all placeholder:text-white/20"
          />
        </div>

        <div className="space-y-3">
          <p className="text-xs font-medium text-white/40 px-0.5 uppercase tracking-wider">
            Sources
          </p>
          {isLoadingConfig ? (
            <div className="py-10 flex flex-col items-center gap-3">
              <div className="size-5 rounded-full border-2 border-white/5 border-t-white/50 animate-spin" />
              <p className="text-xs text-white/40">Loading</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[340px] overflow-y-auto pr-1 custom-scrollbar">
              {configs.map((config) => {
                const sourceInfo = availableSources.find((s) => s.path === config.source_id);
                const label =
                  sourceInfo?.name ?? config.source_id.split("/").pop() ?? config.source_id;
                return (
                  <div
                    key={config.source_id}
                    className={cn(
                      "group flex flex-row items-center gap-3 p-3 rounded-lg border transition-all",
                      config.enabled
                        ? "bg-white/[0.04] border-white/20"
                        : "bg-white/[0.01] border-white/5 opacity-60 hover:opacity-100",
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => onToggleSource(config.source_id)}
                      className={cn(
                        "size-[18px] rounded border flex items-center justify-center transition-all",
                        config.enabled
                          ? "bg-white border-white text-black"
                          : "bg-transparent border-white/20 text-transparent",
                      )}
                    >
                      <Check className="size-3" />
                    </button>
                    <div className="flex-1 min-w-0">
                      <p
                        className={cn(
                          "text-sm font-medium truncate",
                          config.enabled ? "text-white/90" : "text-white/60",
                        )}
                      >
                        {label}
                      </p>
                      {config.enabled && templates.length > 0 && (
                        <select
                          className="mt-1 w-full bg-transparent text-xs text-white/40 outline-none cursor-pointer hover:text-white/60 transition-colors"
                          onChange={(e) => onApplyTemplate(config.source_id, e.target.value)}
                          defaultValue=""
                        >
                          <option value="" disabled className="bg-[#111]">
                            Apply Template...
                          </option>
                          {templates.map((t) => (
                            <option key={t.id} value={t.id} className="bg-[#111]">
                              {t.name}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                    {config.enabled && (
                      <button
                        type="button"
                        onClick={() => onOpenParser(config.source_id)}
                        className={cn(
                          "p-1.5 rounded transition-all border",
                          config.parser_config
                            ? "bg-white/10 border-white/20 text-white"
                            : "bg-transparent border-transparent text-white/30 hover:bg-white/5 hover:text-white",
                        )}
                      >
                        <Settings2 className="size-3.5" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
