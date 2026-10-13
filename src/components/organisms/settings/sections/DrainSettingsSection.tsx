import { FacetExtractionSettings } from "@/components/molecules/FacetExtractionSettings";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import type { AppSettings } from "@/store/settingsStore";
import {
  Activity,
  ChevronDown,
  Clock,
  Layers,
  Plus,
  RefreshCcw,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { SectionLabel } from "../components/SectionLabel";
import { SettingInput } from "../components/SettingInput";

interface DrainSettingsSectionProps {
  readonly settings: AppSettings;
  readonly update: <K extends keyof AppSettings>(
    key: K,
    val: AppSettings[K],
    saveImmediately?: boolean,
  ) => void;
  readonly onSave: (settings: AppSettings) => void;
  readonly handleResetMasks: () => void;
  readonly setIsResetPatternsModalOpen: (open: boolean) => void;
}

export function DrainSettingsSection({
  settings,
  update,
  onSave,
  handleResetMasks,
  setIsResetPatternsModalOpen,
}: DrainSettingsSectionProps) {
  const [isClusteringOpen, setIsClusteringOpen] = useState(true);
  const [isTimestampOpen, setIsTimestampOpen] = useState(false);
  const [isFacetsOpen, setIsFacetsOpen] = useState(false);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
      <div className="border-b border-border pb-6">
        <h2 className="text-2xl font-bold text-text-primary">Global Core Engine</h2>
        <p className="text-sm text-text-muted mt-2">
          System-wide defaults for log parsing, clustering, and pattern discovery.
        </p>
      </div>

      {/* Collapsible Card 1: Drain3 Clustering Engine */}
      <div className="bg-bg-surface/30 border border-border/80 rounded-2xl overflow-hidden transition-all shadow-sm">
        <button
          type="button"
          onClick={() => setIsClusteringOpen(!isClusteringOpen)}
          className="w-full flex items-center justify-between p-5 bg-bg-surface/40 hover:bg-bg-surface/70 transition-colors text-left cursor-pointer select-none"
        >
          <div className="flex items-center gap-3.5">
            <div className="bg-primary/20 p-2.5 rounded-xl border border-primary/20">
              <Layers className="h-5 w-5 text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-text-primary">Drain3 Clustering Engine</h3>
                <span className="text-xs font-mono uppercase px-2 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/25">
                  Active
                </span>
              </div>
              <p className="text-xs text-text-muted mt-0.5">
                Template discovery, similarity thresholds, and variable masking heuristics.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <ChevronDown
              className={cn(
                "h-5 w-5 text-text-muted transition-transform duration-200",
                isClusteringOpen && "rotate-180 text-primary",
              )}
            />
          </div>
        </button>

        {isClusteringOpen && (
          <div className="p-6 pt-3 space-y-6 border-t border-border/50 animate-in fade-in-50 duration-200">
            <div className="grid grid-cols-3 gap-8 pt-2">
              <div className="space-y-2">
                <SectionLabel htmlFor="drain_sim">Similarity</SectionLabel>
                <SettingInput
                  id="drain_sim"
                  type="number"
                  step="0.05"
                  min="0"
                  max="1"
                  value={settings.drain_similarity_threshold}
                  onChange={(e) =>
                    update("drain_similarity_threshold", Number.parseFloat(e.target.value), false)
                  }
                  onBlur={() => onSave(settings)}
                />
              </div>
              <div className="space-y-2">
                <SectionLabel htmlFor="drain_children">Branches</SectionLabel>
                <SettingInput
                  id="drain_children"
                  type="number"
                  min="1"
                  value={settings.drain_max_children}
                  onChange={(e) =>
                    update("drain_max_children", Number.parseInt(e.target.value, 10), false)
                  }
                  onBlur={() => onSave(settings)}
                />
              </div>
              <div className="space-y-2">
                <SectionLabel htmlFor="drain_clusters">Cluster Cap</SectionLabel>
                <SettingInput
                  id="drain_clusters"
                  type="number"
                  min="1"
                  value={settings.drain_max_clusters}
                  onChange={(e) =>
                    update("drain_max_clusters", Number.parseInt(e.target.value, 10), false)
                  }
                  onBlur={() => onSave(settings)}
                />
              </div>
            </div>

            <div className="bg-bg-surface/50 border border-border rounded-2xl p-6">
              <div className="flex justify-between text-xs font-bold text-text-muted mb-4 uppercase tracking-tighter">
                <span>Permissive</span>
                <span className="text-primary text-sm">
                  {settings.drain_similarity_threshold * 100}% Sensitivity
                </span>
                <span>Strict</span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={settings.drain_similarity_threshold}
                onChange={(e) =>
                  update("drain_similarity_threshold", Number.parseFloat(e.target.value))
                }
                className="w-full h-2 bg-border rounded-lg appearance-none cursor-pointer accent-primary"
              />
              <p className="text-xs text-text-muted/60 mt-4 leading-relaxed">
                The similarity threshold determines how 'close' two log lines must be to share a
                template. Lower values 0.1–0.4 are better for high-variance logs.
              </p>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <SectionLabel>Variable Masking</SectionLabel>
                <Button
                  variant="ghost"
                  onClick={handleResetMasks}
                  className="text-xs font-bold text-primary/60 hover:text-primary transition-colors flex items-center gap-1.5 uppercase pr-1 cursor-pointer h-auto p-0"
                >
                  <RotateCcw className="size-3" />
                  Reset to Standard
                </Button>
              </div>
              <div className="space-y-2">
                <p className="text-xs text-text-muted px-1 -mt-2">
                  Sanitize logs by replacing dynamic variables like IPs or IDs with tokens before
                  clustering.
                </p>

                {/* Standard Heuristics Visibility */}
                <div className="bg-bg-card/30 border border-border rounded-xl p-3 space-y-2 opacity-80 scale-[0.98] origin-left">
                  <p className="text-xs font-bold text-primary-muted uppercase tracking-wider mb-1">
                    Standard System Heuristics
                  </p>
                  <div className="flex items-center justify-between gap-4 py-1 border-b border-primary/10">
                    <span className="text-xs font-semibold text-text-primary">IP ADDRESS</span>
                    <span className="text-xs font-mono text-text-muted truncate">
                      IPv4 / IPv6 Formats
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-4 py-1 border-b border-primary/10">
                    <span className="text-xs font-semibold text-text-primary">UUID / GUID</span>
                    <span className="text-xs font-mono text-text-muted truncate">
                      Standard 36-char markers
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-4 py-1 border-b border-primary/10">
                    <span className="text-xs font-semibold text-text-primary">
                      HEX MEMORY / HASH
                    </span>
                    <span className="text-xs font-mono text-text-muted truncate">
                      0x... addresses & sha hashes
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-4 py-1 border-b border-primary/10">
                    <span className="text-xs font-semibold text-text-primary">DURATION</span>
                    <span className="text-xs font-mono text-text-muted truncate">
                      took ...ms / ...s latencies
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-4 py-1 border-b border-primary/10">
                    <span className="text-xs font-semibold text-text-primary">EMAIL</span>
                    <span className="text-xs font-mono text-text-muted truncate">
                      user@domain addresses
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-4 py-1 border-b border-primary/10">
                    <span className="text-xs font-semibold text-text-primary">MAC ADDRESS</span>
                    <span className="text-xs font-mono text-text-muted truncate">
                      xx:xx:xx:xx:xx:xx hardware IDs
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-4 py-1">
                    <span className="text-xs font-semibold text-text-primary">DATETIME</span>
                    <span className="text-xs font-mono text-text-muted truncate">
                      ISO / RFC3339 timestamps
                    </span>
                  </div>
                </div>

                {(Array.isArray(settings.drain_masks) ? settings.drain_masks : []).map(
                  (mask, idx) => (
                    <div
                      key={`${mask.label}-${idx}`}
                      className="flex items-center gap-3 bg-bg-surface/30 p-2 rounded-xl border border-border group animate-in slide-in-from-left-2 duration-200"
                    >
                      <div className="px-2">
                        <Switch
                          checked={mask.enabled}
                          onCheckedChange={(val) => {
                            const newMasks = [...settings.drain_masks];
                            newMasks[idx].enabled = val;
                            update("drain_masks", newMasks);
                          }}
                          className="scale-75"
                        />
                      </div>
                      <div className="flex-1 grid grid-cols-12 gap-2">
                        <div className="col-span-3">
                          <input
                            type="text"
                            value={mask.label}
                            onChange={(e) => {
                              const newMasks = [...settings.drain_masks];
                              newMasks[idx].label = e.target.value;
                              update("drain_masks", newMasks);
                            }}
                            className="w-full bg-transparent border-none text-xs font-bold text-primary focus:ring-0 px-0 h-6 uppercase"
                            placeholder="LABEL"
                          />
                        </div>
                        <div className="col-span-9">
                          <input
                            type="text"
                            value={mask.pattern}
                            onChange={(e) => {
                              const newMasks = [...settings.drain_masks];
                              newMasks[idx].pattern = e.target.value;
                              update("drain_masks", newMasks);
                            }}
                            className="w-full bg-transparent border-none text-xs text-text-primary font-mono focus:ring-0 px-0 h-6"
                            placeholder="Regex Pattern"
                          />
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => {
                          const newMasks = settings.drain_masks.filter((_, i) => i !== idx);
                          update("drain_masks", newMasks);
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1.5 text-text-muted hover:text-red-400 transition-all cursor-pointer"
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  ),
                )}

                <Button
                  variant="ghost"
                  onClick={() => {
                    update("drain_masks", [
                      ...settings.drain_masks,
                      { label: "NEW_MASK", pattern: "", enabled: true },
                    ]);
                  }}
                  className="w-full flex items-center justify-center gap-2 py-3 border border-dashed border-border rounded-xl text-xs font-bold text-text-muted hover:border-primary hover:text-primary hover:bg-primary/5 transition-all uppercase tracking-wider cursor-pointer h-auto"
                >
                  <Plus className="size-3" />
                  Add Custom Masking Instruction
                </Button>
              </div>
            </div>

            {/* Reset Templates within Drain3 Section */}
            <div className="bg-red-500/5 border border-red-500/10 rounded-2xl p-6 flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-red-400">Pattern Memory</p>
                <p className="text-xs text-text-muted mt-1 max-w-[300px]">
                  Clearing patterns will force the engine to re-learn log templates from scratch.
                  This does not affect your masking rules.
                </p>
              </div>
              <Button
                variant="ghost"
                onClick={() => setIsResetPatternsModalOpen(true)}
                className="flex items-center gap-2 px-4 py-2 bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded-xl text-xs font-bold transition-all border border-red-500/20 h-auto"
              >
                <RefreshCcw className="size-3.5" />
                Clear Pattern Cache
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Collapsible Card 2: Log Timestamp Extraction & Detection */}
      <div className="bg-bg-surface/30 border border-border/80 rounded-2xl overflow-hidden transition-all shadow-sm">
        <button
          type="button"
          onClick={() => setIsTimestampOpen(!isTimestampOpen)}
          className="w-full flex items-center justify-between p-5 bg-bg-surface/40 hover:bg-bg-surface/70 transition-colors text-left cursor-pointer select-none"
        >
          <div className="flex items-center gap-3.5">
            <div className="bg-primary/20 p-2.5 rounded-xl border border-primary/20">
              <Clock className="h-5 w-5 text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-text-primary">
                  Log Timestamp Extraction & Detection
                </h3>
                <span
                  className={cn(
                    "text-xs font-mono uppercase px-2 py-0.5 rounded-full border",
                    settings.timestamp_auto_detect
                      ? "bg-primary/15 text-primary border-primary/25"
                      : "bg-bg-surface text-text-muted border-border",
                  )}
                >
                  {settings.timestamp_auto_detect ? "Auto-Detect On" : "Manual / Disabled"}
                </span>
              </div>
              <p className="text-xs text-text-muted mt-0.5">
                Control how dates and timezones are automatically detected or parsed from log lines.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <ChevronDown
              className={cn(
                "h-5 w-5 text-text-muted transition-transform duration-200",
                isTimestampOpen && "rotate-180 text-primary",
              )}
            />
          </div>
        </button>

        {isTimestampOpen && (
          <div className="p-6 pt-3 space-y-6 border-t border-border/50 animate-in fade-in-50 duration-200">
            <div className="space-y-4">
              <div className="flex items-center justify-between bg-bg-surface/50 border border-border rounded-xl p-4 hover:bg-bg-surface transition-colors">
                <div>
                  <p className="text-sm font-bold text-text-primary">Auto-Detect Timestamps</p>
                  <p className="text-xs text-text-muted mt-0.5">
                    Scan log messages automatically for standard date formats (ISO, Apache, Syslog,
                    etc.).
                  </p>
                </div>
                <Switch
                  checked={settings.timestamp_auto_detect}
                  onCheckedChange={(checked) => update("timestamp_auto_detect", checked)}
                />
              </div>

              <div className="grid grid-cols-2 gap-6 pt-2">
                <div className="space-y-2">
                  <SectionLabel htmlFor="timestamp_custom_regex">
                    Custom Timestamp Regex
                  </SectionLabel>
                  <SettingInput
                    id="timestamp_custom_regex"
                    type="text"
                    value={settings.timestamp_custom_regex || ""}
                    onChange={(e) => update("timestamp_custom_regex", e.target.value, false)}
                    onBlur={() => onSave(settings)}
                    placeholder="e.g. ^\[(?P<timestamp>[^\]]+)\]"
                  />
                  <p className="text-xs text-text-muted/50 px-1">
                    Use a custom regex pattern to extract the timestamp string (requires a{" "}
                    <code>?P&lt;timestamp&gt;</code> capture group).
                  </p>
                </div>

                <div className="space-y-2">
                  <SectionLabel htmlFor="timestamp_custom_format">
                    Custom Timestamp Format
                  </SectionLabel>
                  <SettingInput
                    id="timestamp_custom_format"
                    type="text"
                    value={settings.timestamp_custom_format || ""}
                    onChange={(e) => update("timestamp_custom_format", e.target.value, false)}
                    onBlur={() => onSave(settings)}
                    placeholder="e.g. %d/%b/%Y:%H:%M:%S"
                  />
                  <p className="text-xs text-text-muted/50 px-1">
                    Optionally provide a custom <code>strptime</code> format string to parse the
                    extracted timestamp.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Collapsible Card 3: Metadata Extraction (Facets) */}
      <div className="bg-bg-surface/30 border border-border/80 rounded-2xl overflow-hidden transition-all shadow-sm">
        <button
          type="button"
          onClick={() => setIsFacetsOpen(!isFacetsOpen)}
          className="w-full flex items-center justify-between p-5 bg-bg-surface/40 hover:bg-bg-surface/70 transition-colors text-left cursor-pointer select-none"
        >
          <div className="flex items-center gap-3.5">
            <div className="bg-blue-500/10 p-2.5 rounded-xl border border-blue-500/20">
              <Activity className="h-5 w-5 text-blue-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-text-primary">
                  Metadata Extraction (Facets)
                </h3>
                <span className="text-xs font-mono uppercase px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-400 border border-blue-500/25">
                  {(settings.facet_extractions || []).filter((r) => r.enabled).length} Rules Active
                </span>
              </div>
              <p className="text-xs text-text-muted mt-0.5">
                Regex rules and capturing groups to extract structured fields from raw text into
                queryable facets.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <ChevronDown
              className={cn(
                "h-5 w-5 text-text-muted transition-transform duration-200",
                isFacetsOpen && "rotate-180 text-primary",
              )}
            />
          </div>
        </button>

        {isFacetsOpen && (
          <div className="p-6 pt-3 space-y-6 border-t border-border/50 animate-in fade-in-50 duration-200">
            <FacetExtractionSettings
              rules={settings.facet_extractions || []}
              onChange={(rules) => update("facet_extractions", rules)}
              title="Global Extraction Rules"
            />
          </div>
        )}
      </div>
    </div>
  );
}
