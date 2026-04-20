import { FacetExtractionSettings } from "@/components/molecules/FacetExtractionSettings";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { callSidecar } from "@/lib/hooks/useSidecarBridge";
import { cn } from "@/lib/utils";
import { useSettingsStore } from "@/store/settingsStore";
import { Cpu, Info, Layers, Plus, RefreshCcw, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

interface WorkspaceEngineSettingsProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly workspaceId: string;
}

export function WorkspaceEngineSettings({
  isOpen,
  onClose,
  workspaceId,
}: WorkspaceEngineSettingsProps) {
  const { settings, fetchSettings, updateSettings } = useSettingsStore();
  const [localSettings, setLocalSettings] = useState(settings);
  const [globalSettings, setGlobalSettings] = useState<Record<string, unknown> | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // 1. Force refresh workspace settings from sidecar right when modal opens
  useEffect(() => {
    if (isOpen && workspaceId) {
      fetchSettings(workspaceId);
    }
  }, [isOpen, workspaceId, fetchSettings]);

  // 2. Sync local state when store settings change (including after potential fetch)
  useEffect(() => {
    if (isOpen) {
      setLocalSettings(settings);
    }
  }, [isOpen, settings]);

  // 3. Fetch global settings once for reference
  useEffect(() => {
    if (isOpen) {
      const safeParse = (raw: string | null) => {
        if (!raw) {
          return null;
        }
        try {
          return JSON.parse(raw);
        } catch (e) {
          console.debug(
            "Standard JSON parse failed for workspace settings, attempting legacy fix...",
            e,
          );
          try {
            const jsonified = raw
              .replaceAll("'", '"')
              .replaceAll("True", "true")
              .replaceAll("False", "false")
              .replaceAll("None", "null");
            return JSON.parse(jsonified);
          } catch (innerError) {
            console.error("Deep JSON parsing failed for workspace settings", innerError);
            return null;
          }
        }
      };

      callSidecar({ method: "get_settings", params: {} }).then((res) => {
        const remoteSettings = res as Record<string, unknown>;
        if (remoteSettings) {
          setGlobalSettings({
            ...remoteSettings,
            drain_similarity_threshold: Number.parseFloat(
              (remoteSettings.drain_similarity_threshold as string) || "0.5",
            ),
            drain_max_children: Number.parseInt(
              (remoteSettings.drain_max_children as string) || "100",
              10,
            ),
            drain_max_clusters: Number.parseInt(
              (remoteSettings.drain_max_clusters as string) || "1000",
              10,
            ),
            drain_masks: (() => {
              const parsed = safeParse(remoteSettings.drain_masks as string);
              return Array.isArray(parsed) ? parsed : [];
            })(),
            facet_extractions: (() => {
              const parsed = safeParse(remoteSettings.facet_extractions as string);
              return Array.isArray(parsed) ? parsed : [];
            })(),
          });
        }
      });
    }
  }, [isOpen]);

  const update = (key: string, value: unknown) => {
    setLocalSettings((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Only send Drain-related settings as overrides
      const overrides = {
        drain_similarity_threshold: localSettings.drain_similarity_threshold,
        drain_max_children: localSettings.drain_max_children,
        drain_max_clusters: localSettings.drain_max_clusters,
        drain_masks: localSettings.drain_masks,
        facet_extractions: localSettings.facet_extractions,
      };
      await updateSettings(overrides, workspaceId);
      toast.success("Workspace overrides saved successfully");
      onClose();
    } catch (e) {
      console.error("Failed to save workspace overrides", e);
      toast.error("Failed to save workspace overrides");
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = async () => {
    try {
      await callSidecar({
        method: "reset_workspace_settings",
        params: { workspace_id: workspaceId },
      });
      await fetchSettings(workspaceId);
      toast.success("Workspace overrides cleared. Using global settings.");
      onClose();
    } catch (e) {
      console.error("Failed to reset workspace settings", e);
      toast.error("Failed to reset workspace settings");
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[600px] bg-[#0d0f0e] border-zinc-800 p-0 overflow-hidden">
        <DialogHeader className="p-6 border-b border-zinc-900 bg-zinc-950/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/10 rounded-lg">
              <Cpu className="size-5 text-emerald-400" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold text-zinc-100">
                Engine Core: Workspace Overrides
              </DialogTitle>
              <DialogDescription className="text-xs text-zinc-400">
                Fine-tune pattern mining parameters for this specific workspace.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="p-6 space-y-6 max-h-[60vh] overflow-y-auto custom-scrollbar">
          {/* Similarity Threshold */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label
                htmlFor="drain-similarity"
                className="text-xs font-bold uppercase tracking-wider text-zinc-500 flex items-center gap-2"
              >
                Similarity Sensitivity
                <Info className="size-3 opacity-50" />
              </label>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-emerald-400">
                  {(localSettings.drain_similarity_threshold * 100).toFixed(0)}%
                </span>
                {globalSettings?.drain_similarity_threshold ===
                  localSettings.drain_similarity_threshold && (
                  <span className="text-[9px] bg-zinc-800 text-zinc-500 px-1.5 py-0.5 rounded border border-zinc-700/50">
                    GLOBAL
                  </span>
                )}
              </div>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={localSettings.drain_similarity_threshold}
              onChange={(e) =>
                update("drain_similarity_threshold", Number.parseFloat(e.target.value))
              }
              id="drain-similarity"
              className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
            />
            <p className="text-[10px] text-zinc-500 leading-relaxed italic">
              Determines how strict the pattern matching is. Higher = more specific clusters.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="drain-max-children"
                  className="text-[10px] font-bold uppercase text-zinc-500"
                >
                  Max Branches
                </label>
                {localSettings.drain_max_children === globalSettings?.drain_max_children && (
                  <span className="text-[8px] text-zinc-600 uppercase">Default</span>
                )}
              </div>
              <input
                type="number"
                value={localSettings.drain_max_children}
                onChange={(e) => update("drain_max_children", Number.parseInt(e.target.value, 10))}
                id="drain-max-children"
                className="w-full h-9 px-3 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-zinc-100 focus:outline-none focus:border-emerald-500/50 transition-all font-mono"
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="drain-max-clusters"
                  className="text-[10px] font-bold uppercase text-zinc-500"
                >
                  Cluster Cap
                </label>
                {localSettings.drain_max_clusters === globalSettings?.drain_max_clusters && (
                  <span className="text-[8px] text-zinc-600 uppercase">Default</span>
                )}
              </div>
              <input
                type="number"
                value={localSettings.drain_max_clusters}
                onChange={(e) => update("drain_max_clusters", Number.parseInt(e.target.value, 10))}
                id="drain-max-clusters"
                className="w-full h-9 px-3 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-zinc-100 focus:outline-none focus:border-emerald-500/50 transition-all font-mono"
              />
            </div>
          </div>

          <div className="space-y-3 pt-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500 flex items-center gap-2">
              Variable Masking
              <Layers className="size-3 opacity-50" />
            </h3>
            <div className="space-y-2">
              {(Array.isArray(localSettings.drain_masks) ? localSettings.drain_masks : []).map(
                (mask, idx) => {
                  const isGlobal = (
                    globalSettings?.drain_masks as { label: string; pattern: string }[]
                  )?.some(
                    (gm: { label: string; pattern: string }) =>
                      gm.label === mask.label && gm.pattern === mask.pattern,
                  );
                  return (
                    <div
                      key={`mask-${mask.label}-${idx}`}
                      className="flex items-center gap-2 bg-zinc-900/50 p-2 rounded-lg border border-zinc-800/50 group"
                    >
                      <Switch
                        checked={mask.enabled}
                        onCheckedChange={(val) => {
                          const m = [...localSettings.drain_masks];
                          m[idx] = { ...m[idx], enabled: val };
                          update("drain_masks", m);
                        }}
                        className="scale-75"
                      />
                      <div className="flex flex-col">
                        <input
                          value={mask.label}
                          onChange={(e) => {
                            const m = [...localSettings.drain_masks];
                            m[idx] = { ...m[idx], label: e.target.value };
                            update("drain_masks", m);
                          }}
                          placeholder="LABEL"
                          className="bg-transparent border-none text-[10px] font-bold text-emerald-400 focus:ring-0 w-20 px-0 uppercase"
                        />
                        {isGlobal && (
                          <span className="text-[7px] text-zinc-600 font-bold -mt-1 uppercase tracking-tighter">
                            GLOBAL
                          </span>
                        )}
                      </div>
                      <input
                        value={mask.pattern}
                        onChange={(e) => {
                          const m = [...localSettings.drain_masks];
                          m[idx] = { ...m[idx], pattern: e.target.value };
                          update("drain_masks", m);
                        }}
                        placeholder="Regex Pattern"
                        className="flex-1 bg-transparent border-none text-[10px] text-zinc-400 font-mono focus:ring-0 px-0"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const m = localSettings.drain_masks.filter((_, i) => i !== idx);
                          update("drain_masks", m);
                        }}
                        className={cn(
                          "p-1 text-zinc-500 hover:text-red-400 transition-all",
                          isGlobal ? "opacity-0 group-hover:opacity-100" : "opacity-100",
                        )}
                      >
                        <Trash2 className="size-3" />
                      </button>
                    </div>
                  );
                },
              )}
              <Button
                variant="outline"
                size="sm"
                className="w-full border-dashed border-zinc-800 h-8 text-[10px] text-zinc-500 hover:text-emerald-400"
                onClick={() => {
                  update("drain_masks", [
                    ...localSettings.drain_masks,
                    { label: "NEW", pattern: "", enabled: true },
                  ]);
                }}
              >
                <Plus className="size-3 mr-2" />
                Add Custom Workspace Mask
              </Button>
            </div>
          </div>

          <div className="pt-4 border-t border-zinc-800">
            <FacetExtractionSettings
              rules={localSettings.facet_extractions || []}
              onChange={(rules) => update("facet_extractions", rules)}
              title="Workspace Facet Extraction"
            />
          </div>
        </div>

        <DialogFooter className="px-6 pb-6 pt-4 bg-zinc-900/50 border-t border-zinc-800 flex items-center justify-between">
          <button
            type="button"
            onClick={handleReset}
            className="flex items-center gap-2 px-4 h-9 rounded-lg text-[10px] font-bold uppercase tracking-wider text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-all border border-transparent hover:border-zinc-700"
          >
            <RefreshCcw className="size-3" />
            Reset Overrides
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 h-9 rounded-lg text-[10px] font-bold uppercase tracking-wider text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-all"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="flex items-center gap-2 px-6 h-9 rounded-lg bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500 hover:text-zinc-900 disabled:opacity-50 disabled:cursor-not-allowed transition-all border border-emerald-500/20 text-[10px] font-black uppercase tracking-widest shadow-[0_0_20px_rgba(16,185,129,0.1)]"
            >
              {isSaving ? "Saving..." : "Save Overrides"}
              {!isSaving && <Cpu className="size-3" />}
            </button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
