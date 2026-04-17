import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { Filter, Plus, X } from "lucide-react";
import { useState } from "react";

export interface FilterEntry {
  id: string;
  field: "level" | "source_id" | "cluster_id" | "raw_text" | "message";
  operator: "equals" | "not_equals" | "contains" | "not_contains" | "starts_with" | "regex";
  value: string;
}

const FIELDS: { value: FilterEntry["field"]; label: string }[] = [
  { value: "message", label: "Message" },
  { value: "level", label: "Level" },
  { value: "cluster_id", label: "Cluster" },
  { value: "source_id", label: "Source" },
  { value: "raw_text", label: "Raw Text" },
];

const OPERATORS: { value: FilterEntry["operator"]; label: string }[] = [
  { value: "contains", label: "contains" },
  { value: "not_contains", label: "not contains" },
  { value: "equals", label: "is exactly" },
  { value: "not_equals", label: "is not" },
  { value: "starts_with", label: "starts with" },
  { value: "regex", label: "regex match" },
];

interface FilterBuilderProps {
  readonly filters: FilterEntry[];
  readonly onChange: (filters: FilterEntry[]) => void;
}

export function FilterBuilder({ filters, onChange }: FilterBuilderProps) {
  const [open, setOpen] = useState(false);
  const [field, setField] = useState<FilterEntry["field"]>("raw_text");
  const [operator, setOperator] = useState<FilterEntry["operator"]>("contains");
  const [value, setValue] = useState("");

  const handleAdd = () => {
    if (!value.trim()) {
      return;
    }
    onChange([...filters, { id: crypto.randomUUID(), field, operator, value: value.trim() }]);
    setValue("");
  };

  const handleRemove = (id: string) => onChange(filters.filter((f) => f.id !== id));

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          className={cn(
            "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-all border",
            open || filters.length > 0
              ? "bg-emerald-950/60 border-emerald-600/40 text-emerald-300"
              : "bg-zinc-900 border-zinc-700 text-zinc-400 hover:border-zinc-600 hover:text-zinc-300",
          )}
        >
          <Filter className="h-3.5 w-3.5" />
          Filters
          {filters.length > 0 && (
            <span className="bg-emerald-500/20 text-emerald-300 rounded px-1 text-[10px] font-bold">
              {filters.length}
            </span>
          )}
        </PopoverTrigger>

        {/* Fully opaque dark popover panel */}
        <PopoverContent
          className="w-72 p-0 bg-[#141a17] border border-zinc-700 shadow-2xl shadow-black/70 rounded-xl overflow-hidden"
          align="start"
          sideOffset={8}
        >
          {/* Header */}
          <div className="px-3 py-2.5 border-b border-zinc-800">
            <p className="text-xs font-semibold text-zinc-300">Add Filter</p>
          </div>

          {/* Field & Operator pills */}
          <div className="px-3 pt-3 pb-2 flex gap-2">
            <div className="flex-1">
              <p className="text-[10px] uppercase tracking-wider text-zinc-600 mb-1 font-medium">
                Field
              </p>
              <div className="flex flex-wrap gap-1">
                {FIELDS.map((f) => (
                  <button
                    key={f.value}
                    type="button"
                    onClick={() => setField(f.value)}
                    className={cn(
                      "px-2 py-0.5 rounded text-xs transition-colors",
                      field === f.value
                        ? "bg-emerald-600 text-white font-medium"
                        : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200",
                    )}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="px-3 pb-2">
            <p className="text-[10px] uppercase tracking-wider text-zinc-600 mb-1 font-medium">
              Operator
            </p>
            <div className="flex flex-wrap gap-1">
              {OPERATORS.map((op) => (
                <button
                  key={op.value}
                  type="button"
                  onClick={() => setOperator(op.value)}
                  className={cn(
                    "px-2 py-0.5 rounded text-xs transition-colors",
                    operator === op.value
                      ? "bg-zinc-600 text-white font-medium"
                      : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200",
                  )}
                >
                  {op.label}
                </button>
              ))}
            </div>
          </div>

          {/* Value input */}
          <div className="px-3 pb-3">
            <div className="flex gap-2 items-center mt-1">
              <Input
                placeholder="Value..."
                className="h-8 text-xs flex-1 bg-zinc-800 border-zinc-700 text-zinc-100 placeholder:text-zinc-600 focus-visible:ring-emerald-500/30"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              />
              <button
                type="button"
                onClick={handleAdd}
                className="h-8 w-8 rounded-md bg-emerald-600 hover:bg-emerald-500 flex items-center justify-center transition-colors shrink-0"
              >
                <Plus className="h-4 w-4 text-white" />
              </button>
            </div>
          </div>

          {/* Active filters list */}
          {filters.length > 0 && (
            <div className="border-t border-zinc-800 px-3 py-2 space-y-1.5">
              <div className="flex items-center justify-between mb-1">
                <p className="text-[10px] uppercase tracking-wider text-zinc-600 font-medium">
                  Active
                </p>
                <button
                  type="button"
                  onClick={() => onChange([])}
                  className="text-[10px] text-zinc-600 hover:text-red-400 transition-colors"
                >
                  Clear all
                </button>
              </div>
              {filters.map((f, i) => (
                <div
                  key={f.id}
                  className="flex items-center gap-2 bg-zinc-800/60 rounded-md px-2 py-1.5 group/f"
                >
                  <div className="flex flex-col opacity-0 group-hover/f:opacity-100 transition-opacity">
                    <button
                      type="button"
                      disabled={i === 0}
                      onClick={() => {
                        const newF = [...filters];
                        [newF[i - 1], newF[i]] = [newF[i], newF[i - 1]];
                        onChange(newF);
                      }}
                      className="text-[8px] text-zinc-500 hover:text-emerald-400 disabled:opacity-0"
                    >
                      ▲
                    </button>
                    <button
                      type="button"
                      disabled={i === filters.length - 1}
                      onClick={() => {
                        const newF = [...filters];
                        [newF[i + 1], newF[i]] = [newF[i], newF[i + 1]];
                        onChange(newF);
                      }}
                      className="text-[8px] text-zinc-500 hover:text-emerald-400 disabled:opacity-0"
                    >
                      ▼
                    </button>
                  </div>
                  <span className="text-[10px] text-emerald-500/80 font-mono font-bold shrink-0">
                    {f.field}
                  </span>
                  <span className="text-[10px] text-zinc-600 italic shrink-0">{f.operator}</span>
                  <span className="text-xs text-zinc-200 font-mono flex-1 truncate">{f.value}</span>
                  <button
                    type="button"
                    onClick={() => handleRemove(f.id)}
                    className="text-zinc-600 hover:text-red-400 transition-colors shrink-0"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}
