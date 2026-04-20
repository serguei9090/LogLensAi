import { HelpTooltip } from "@/components/atoms/HelpTooltip";
import { cn } from "@/lib/utils";
import { Check, HelpCircle, Plus, ToggleLeft, ToggleRight, Trash2, X } from "lucide-react";
import type React from "react";
import { useState } from "react";

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

const SYSTEM_FACETS = [
  {
    name: "ip",
    desc: "IPv4 and IPv6 addresses",
    pattern: "Heuristic (Heuristic-based validation)",
  },
  { name: "uuid", desc: "Standard UUIDs", pattern: "[0-9a-f]{8}-..." },
  { name: "email", desc: "Email addresses", pattern: "[a-z0-9._%+-]+@..." },
  { name: "user_id / status", desc: "Common fields", pattern: "user_id=123, status=200" },
  { name: "kv_pairs", desc: "Generic Key=Value", pattern: "key=value, key:value" },
];

export function FacetExtractionSettings({
  rules,
  onChange,
  title = "Custom Facet Extraction",
}: FacetExtractionSettingsProps) {
  const [showSystem, setShowSystem] = useState(false);
  const [newRule, setNewRule] = useState<FacetExtractionRule>({
    name: "",
    regex: "",
    group: 1,
    enabled: true,
  });

  const addRule = () => {
    if (!newRule.name || !newRule.regex) {
      return;
    }
    onChange([...rules, { ...newRule }]);
    setNewRule({ name: "", regex: "", group: 1, enabled: true });
  };

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

  const updateRule = (index: number, updates: Partial<FacetExtractionRule>) => {
    const nextRules = [...rules];
    nextRules[index] = { ...nextRules[index], ...updates };
    onChange(nextRules);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
            {title}
            <HelpTooltip content="Define custom regex patterns to extract metadata (facets) from raw logs. Facets are stored as structured JSON and can be searched or filtered immediately." />
          </h3>
          <p className="text-xs text-text-muted mt-1">
            Rules are applied in order. Use named groups (?&lt;name&gt;...) or index.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowSystem(!showSystem)}
          className="text-[10px] font-bold uppercase py-1.5 px-3 rounded-lg border border-border bg-bg-surface/50 text-text-muted hover:text-primary hover:border-primary/30 transition-all flex items-center gap-2"
        >
          {showSystem ? "Hide" : "Show"} System Facets
          <div
            className={cn(
              "w-1.5 h-1.5 rounded-full",
              showSystem ? "bg-primary animate-pulse" : "bg-zinc-600",
            )}
          />
        </button>
      </div>

      {showSystem && (
        <div className="p-3 bg-primary/5 border border-primary/20 rounded-xl space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
          <p className="text-[11px] font-bold text-primary-muted uppercase tracking-wider">
            Active System Heuristics (Always On)
          </p>
          <div className="grid grid-cols-2 gap-x-6 gap-y-2">
            {SYSTEM_FACETS.map((sf) => (
              <div
                key={sf.name}
                className="flex items-center justify-between gap-4 py-1 border-b border-primary/10 last:border-0"
              >
                <div className="flex flex-col">
                  <span className="text-[11px] font-semibold text-text-primary">{sf.name}</span>
                  <span className="text-[10px] text-text-muted">{sf.desc}</span>
                </div>
                <span className="text-[10px] font-mono text-primary-muted/70 truncate max-w-[150px]">
                  {sf.pattern}
                </span>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-text-muted italic pt-1">
            * System facets are optimized for high-performance extraction and cannot be disabled.
          </p>
        </div>
      )}

      <div className="bg-bg-card/30 border border-border rounded-xl overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-border bg-bg-surface/50">
              <th className="px-4 py-2 text-[10px] font-bold uppercase text-text-muted w-32">
                Facet Name
              </th>
              <th className="px-4 py-2 text-[10px] font-bold uppercase text-text-muted">
                Regex Pattern
              </th>
              <th className="px-4 py-2 text-[10px] font-bold uppercase text-text-muted w-16 text-center">
                Group
              </th>
              <th className="px-4 py-2 text-[10px] font-bold uppercase text-text-muted w-16 text-center">
                Status
              </th>
              <th className="px-4 py-2 text-[10px] font-bold uppercase text-text-muted w-12" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {Array.isArray(rules) && rules.map((rule, idx) => (
              <tr
                key={`${rule.name}-${idx}`}
                className={cn("group", !rule.enabled && "opacity-50")}
              >
                <td className="px-4 py-3">
                  <input
                    type="text"
                    value={rule.name}
                    onChange={(e) => updateRule(idx, { name: e.target.value })}
                    className="w-full bg-transparent border-none focus:ring-0 text-sm text-text-primary h-6"
                  />
                </td>
                <td className="px-4 py-3">
                  <input
                    type="text"
                    value={rule.regex}
                    onChange={(e) => updateRule(idx, { regex: e.target.value })}
                    className="w-full bg-transparent border-none focus:ring-0 text-sm text-text-muted font-mono h-6 placeholder:text-text-muted/20"
                    placeholder="e.g. user_id=(\d+)"
                  />
                </td>
                <td className="px-4 py-3">
                  <input
                    type="number"
                    value={rule.group}
                    onChange={(e) =>
                      updateRule(idx, { group: Number.parseInt(e.target.value) || 1 })
                    }
                    className="w-full bg-transparent border-none focus:ring-0 text-sm text-text-primary text-center h-6"
                  />
                </td>
                <td className="px-4 py-3 text-center">
                  <button
                    type="button"
                    onClick={() => toggleRule(idx)}
                    className="text-text-muted hover:text-primary transition-colors inline-block align-middle"
                  >
                    {rule.enabled ? (
                      <ToggleRight className="h-5 w-5 text-primary" />
                    ) : (
                      <ToggleLeft className="h-5 w-5" />
                    )}
                  </button>
                </td>
                <td className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() => removeRule(idx)}
                    className="text-text-muted hover:text-error opacity-0 group-hover:opacity-100 transition-all p-1"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}

            {/* Add New Rule Row */}
            <tr className="bg-primary/5">
              <td className="px-4 py-3">
                <input
                  type="text"
                  placeholder="New facet..."
                  value={newRule.name}
                  onChange={(e) => setNewRule({ ...newRule, name: e.target.value })}
                  className="w-full bg-transparent border-none focus:ring-0 text-sm font-semibold text-primary h-6"
                />
              </td>
              <td className="px-4 py-3">
                <input
                  type="text"
                  placeholder="Regex pattern..."
                  value={newRule.regex}
                  onChange={(e) => setNewRule({ ...newRule, regex: e.target.value })}
                  className="w-full bg-transparent border-none focus:ring-0 text-sm font-mono text-text-primary h-6"
                />
              </td>
              <td className="px-4 py-3">
                <input
                  type="number"
                  value={newRule.group}
                  onChange={(e) =>
                    setNewRule({ ...newRule, group: Number.parseInt(e.target.value) || 1 })
                  }
                  className="w-full bg-transparent border-none focus:ring-0 text-sm text-text-primary text-center h-6"
                />
              </td>
              <td className="px-4 py-3 text-center">
                <div className="w-10 inline-block h-6" />
              </td>
              <td className="px-4 py-3">
                <button
                  type="button"
                  onClick={addRule}
                  disabled={!newRule.name || !newRule.regex}
                  className="bg-primary text-bg-main p-1.5 rounded-lg hover:scale-105 active:scale-95 disabled:opacity-30 disabled:scale-100 transition-all shadow-lg shadow-primary/20"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="p-3 bg-bg-surface/40 border border-border rounded-xl">
          <p className="text-[10px] text-text-muted uppercase font-bold mb-1">Cheat Sheet</p>
          <ul className="text-[11px] text-text-muted space-y-1">
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
        <div className="p-3 bg-bg-surface/40 border border-border rounded-xl text-[11px] text-text-muted flex flex-col justify-center">
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
