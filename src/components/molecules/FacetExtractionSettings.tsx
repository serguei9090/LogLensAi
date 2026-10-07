import { HelpTooltip } from "@/components/atoms/HelpTooltip";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { Plus, Trash2 } from "lucide-react";

export interface FacetExtractionRule {
  name: string;
  regex: string;
  group: number;
  enabled: boolean;
}

interface FacetExtractionSettingsProps {
  rules: FacetExtractionRule[];
  onChange: (rules: FacetExtractionRule[]) => void;
  title?: string;
}

const COMMON_FACET_PRESETS: Array<{ name: string; regex: string; group: number; label: string }> = [
  {
    label: "HTTP Status",
    name: "status_code",
    regex: String.raw`\b([1-5][0-9]{2})\b`,
    group: 1,
  },
  {
    label: "Duration",
    name: "duration_ms",
    regex: String.raw`took\s+(\d+(?:\.\d+)?)\s*ms`,
    group: 1,
  },
  {
    label: "User / Account",
    name: "user",
    regex: String.raw`user(?:name)?[:=]\s*([a-zA-Z0-9_\.\-]+)`,
    group: 1,
  },
  {
    label: "Client IP",
    name: "client_ip",
    regex: String.raw`\b(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\b`,
    group: 1,
  },
  {
    label: "UUID",
    name: "uuid",
    regex: String.raw`([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})`,
    group: 1,
  },
  {
    label: "Email",
    name: "email",
    regex: String.raw`([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})`,
    group: 1,
  },
  {
    label: "Session ID",
    name: "session_id",
    regex: String.raw`jsessionid=([a-zA-Z0-9_\-]+)`,
    group: 1,
  },
  {
    label: "Trace ID",
    name: "trace_id",
    regex: String.raw`(?:trace_?id|traceId)[:=]\s*([a-zA-Z0-9_\-]+)`,
    group: 1,
  },
  {
    label: "Component / Logger",
    name: "component",
    regex: String.raw`\[([a-zA-Z0-9_\.\-]+)\]`,
    group: 1,
  },
  {
    label: "Query Time (ms)",
    name: "query_time_ms",
    regex: String.raw`query\s+time[:=]\s*(\d+(?:\.\d+)?)\s*ms`,
    group: 1,
  },
];

export function FacetExtractionSettings({
  rules,
  onChange,
  title = "Custom Facet Extraction",
}: FacetExtractionSettingsProps) {
  const removeRule = (index: number) => {
    const nextRules = [...rules];
    nextRules.splice(index, 1);
    onChange(nextRules);
  };

  const toggleRule = (index: number) => {
    const nextRules = [...rules];
    nextRules[index] = { ...nextRules[index], enabled: !nextRules[index].enabled };
    onChange(nextRules);
  };

  const togglePreset = (preset: (typeof COMMON_FACET_PRESETS)[number]) => {
    const existingIndex = rules.findIndex((r) => r.name === preset.name);
    if (existingIndex >= 0) {
      const nextRules = [...rules];
      nextRules.splice(existingIndex, 1);
      onChange(nextRules);
    } else {
      onChange([
        ...rules,
        {
          name: preset.name,
          regex: preset.regex,
          group: preset.group,
          enabled: true,
        },
      ]);
    }
  };

  const updateRule = (index: number, updates: Partial<FacetExtractionRule>) => {
    const nextRules = [...rules];
    nextRules[index] = { ...nextRules[index], ...updates };
    onChange(nextRules);
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
          {title}
          <HelpTooltip content="Define regex patterns to extract metadata facets (HTTP status, user, latency, etc.) from raw logs into structured searchable fields." />
        </h3>
        <p className="text-xs text-text-muted mt-1">
          Click any preset pillow to activate or deactivate extraction. Rules are evaluated in
          order.
        </p>
      </div>

      {/* Interactive Preset Pillows */}
      <div className="flex items-center gap-1.5 flex-wrap pt-1">
        <span className="text-xs uppercase font-bold text-text-muted mr-1">Standard Facets:</span>
        {COMMON_FACET_PRESETS.map((preset) => {
          const matchedRule = rules.find((r) => r.name === preset.name);
          const isAdded = Boolean(matchedRule);
          const isEnabled = matchedRule ? matchedRule.enabled : false;

          return (
            <button
              key={preset.name}
              type="button"
              onClick={() => togglePreset(preset)}
              className={cn(
                "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-all border cursor-pointer select-none",
                isAdded && isEnabled
                  ? "bg-primary/15 border-primary/40 text-primary hover:bg-primary/25 hover:border-primary/60 shadow-sm shadow-primary/10"
                  : isAdded && !isEnabled
                    ? "bg-bg-surface/50 border-border text-text-muted line-through opacity-70 hover:opacity-100"
                    : "bg-bg-surface/40 border-border/60 text-text-secondary hover:border-primary/40 hover:text-text-primary hover:bg-bg-surface",
              )}
            >
              <span
                className={cn(
                  "size-1.5 rounded-full transition-colors",
                  isAdded && isEnabled
                    ? "bg-primary"
                    : isAdded && !isEnabled
                      ? "bg-amber-500/60"
                      : "bg-border",
                )}
              />
              {preset.label}
            </button>
          );
        })}
      </div>

      <div className="bg-bg-card/30 border border-border rounded-xl overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-border bg-bg-surface/50">
              <th className="px-4 py-2 text-xs font-bold uppercase text-text-muted w-32">
                Facet Name
              </th>
              <th className="px-4 py-2 text-xs font-bold uppercase text-text-muted">
                Regex Pattern
              </th>
              <th className="px-4 py-2 text-xs font-bold uppercase text-text-muted w-20 text-center">
                <div className="inline-flex items-center justify-center gap-1">
                  <span>Group</span>
                  <HelpTooltip content="The 1-based capturing group number in the regex to extract (e.g. 1 for the first parenthesis '(\d+)'). Named groups like '(?<status>\d+)' map automatically." />
                </div>
              </th>
              <th className="px-4 py-2 text-xs font-bold uppercase text-text-muted w-16 text-center">
                Status
              </th>
              <th className="px-4 py-2 text-xs font-bold uppercase text-text-muted w-12" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {Array.isArray(rules) &&
              rules.map((rule, idx) => (
                <tr
                  key={`${rule.name}-${idx}`}
                  className={cn("group", !rule.enabled && "opacity-50")}
                >
                  <td className="px-4 py-3">
                    <input
                      type="text"
                      value={rule.name}
                      onChange={(e) => updateRule(idx, { name: e.target.value })}
                      className="w-full bg-transparent border-none focus:ring-0 text-sm font-semibold text-primary h-6"
                      placeholder="facet_name"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="text"
                      value={rule.regex}
                      onChange={(e) => updateRule(idx, { regex: e.target.value })}
                      className="w-full bg-transparent border-none focus:ring-0 text-sm text-text-primary font-mono h-6 placeholder:text-text-muted/30"
                      placeholder="e.g. user_id=(\d+)"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="number"
                      min={1}
                      max={9}
                      value={rule.group}
                      onChange={(e) =>
                        updateRule(idx, { group: Number.parseInt(e.target.value, 10) || 1 })
                      }
                      className="w-full bg-transparent border-none focus:ring-0 text-sm text-text-primary text-center font-mono h-6"
                    />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center">
                      <Switch
                        checked={rule.enabled}
                        onCheckedChange={() => toggleRule(idx)}
                        size="sm"
                        aria-label={`Toggle facet rule ${rule.name}`}
                      />
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      type="button"
                      onClick={() => removeRule(idx)}
                      className="text-text-muted hover:text-error opacity-0 group-hover:opacity-100 transition-all p-1 cursor-pointer"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      <Button
        variant="ghost"
        onClick={() => {
          onChange([
            ...rules,
            { name: "custom_facet", regex: String.raw`(\w+)`, group: 1, enabled: true },
          ]);
        }}
        className="w-full flex items-center justify-center gap-2 py-3 border border-dashed border-border rounded-xl text-xs font-bold text-text-muted hover:border-primary hover:text-primary hover:bg-primary/5 transition-all uppercase tracking-tighter cursor-pointer h-auto"
      >
        <Plus className="size-3" />
        Add Custom Facet Instruction
      </Button>

      <div className="grid grid-cols-2 gap-3">
        <div className="p-3 bg-bg-surface/40 border border-border rounded-xl">
          <p className="text-xs text-text-muted uppercase font-bold mb-1">Cheat Sheet</p>
          <ul className="text-xs text-text-muted space-y-1">
            <li>
              <code className="text-primary-muted">\d+</code> - Match digits
            </li>
            <li>
              <code className="text-primary-muted">\w+</code> - Match word chars
            </li>
            <li>
              <code className="text-primary-muted">\[(.*?)\]</code> - Capture within brackets
            </li>
          </ul>
        </div>
        <div className="p-3 bg-bg-surface/40 border border-border rounded-xl text-xs text-text-muted flex flex-col justify-center">
          <p>
            Named groups like{" "}
            <code className="bg-bg-surface px-1 rounded border border-border">
              (?&lt;user_id&gt;...)
            </code>{" "}
            will automatically map to the facet name if available.
          </p>
        </div>
      </div>
    </div>
  );
}
