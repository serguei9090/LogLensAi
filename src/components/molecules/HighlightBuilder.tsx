import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { Check, Highlighter, Plus, X } from "lucide-react";
import { useState } from "react";
import { HexColorPicker } from "react-colorful";

export interface HighlightEntry {
  id: string;
  term: string;
  color: string;
}

const PRESET_COLORS = [
  { hex: "#FBBF24", name: "Amber" },
  { hex: "#60A5FA", name: "Blue" },
  { hex: "#F472B6", name: "Pink" },
  { hex: "#34D399", name: "Emerald" },
  { hex: "#FB923C", name: "Orange" },
  { hex: "#A78BFA", name: "Purple" },
];

interface HighlightBuilderProps {
  readonly highlights: HighlightEntry[];
  readonly onChange: (highlights: HighlightEntry[]) => void;
}

export function HighlightBuilder({ highlights, onChange }: HighlightBuilderProps) {
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState("");
  const [color, setColor] = useState(PRESET_COLORS[0].hex);
  const [customColors, setCustomColors] = useState<string[]>([]);
  const [pendingColor, setPendingColor] = useState(PRESET_COLORS[0].hex);

  const handleAdd = () => {
    if (!term.trim()) {
      return;
    }
    onChange([...highlights, { id: crypto.randomUUID(), term: term.trim(), color }]);
    setTerm("");
  };

  const handleRemove = (id: string) => onChange(highlights.filter((h) => h.id !== id));

  const handleConfirmCustomColor = () => {
    setCustomColors((prev) =>
      [pendingColor, ...prev.filter((c) => c !== pendingColor)].slice(0, 4),
    );
    setColor(pendingColor);
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          className={cn(
            "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-all border",
            open || highlights.length > 0
              ? "bg-amber-950/40 border-amber-600/40 text-amber-300"
              : "bg-zinc-900 border-zinc-700 text-zinc-400 hover:border-zinc-600 hover:text-zinc-300",
          )}
        >
          <Highlighter className="h-3.5 w-3.5" />
          Highlights
          {highlights.length > 0 && (
            <span className="bg-amber-500/20 text-amber-300 rounded px-1 text-[10px] font-bold">
              {highlights.length}
            </span>
          )}
        </PopoverTrigger>

        {/* Fully opaque dark popover panel */}
        <PopoverContent
          className="w-64 p-0 bg-[#141a17] border border-zinc-700 shadow-2xl shadow-black/70 rounded-xl overflow-hidden"
          align="start"
          sideOffset={8}
        >
          {/* Header */}
          <div className="px-3 py-2.5 border-b border-zinc-800">
            <p className="text-xs font-semibold text-zinc-300">Highlight Terms</p>
          </div>

          {/* Color palette */}
          <div className="px-3 pt-3 pb-2">
            <p className="text-[10px] uppercase tracking-wider text-zinc-600 mb-2 font-medium">
              Color
            </p>
            <div className="flex gap-2 flex-wrap">
              {/* Custom Color Picker Trigger */}
              <Popover>
                <PopoverTrigger
                  title="Custom Color"
                  className="w-5 h-5 rounded-full border border-dashed border-zinc-500 hover:border-zinc-300 flex items-center justify-center transition-colors"
                >
                  <Plus className="h-2.5 w-2.5 text-zinc-500" />
                </PopoverTrigger>
                <PopoverContent className="w-52 p-3 bg-zinc-900 border-zinc-700 rounded-xl shadow-2xl ring-1 ring-white/10 animate-in fade-in zoom-in-95 duration-100">
                  <div className="space-y-3">
                    <div className="rounded-md overflow-hidden border border-white/5">
                      <HexColorPicker
                        color={pendingColor}
                        onChange={setPendingColor}
                        style={{ width: "100%", height: "160px" }}
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <div
                        className="w-8 h-8 rounded-md shadow-inner border border-white/10 shrink-0 transition-colors duration-200"
                        style={{ backgroundColor: pendingColor }}
                      />
                      <div className="flex-1 flex gap-1.5">
                        <Input
                          value={pendingColor}
                          onChange={(e) => setPendingColor(e.target.value)}
                          className="h-8 text-[10px] font-mono bg-zinc-800 border-zinc-700 text-zinc-200 uppercase px-2 focus-visible:ring-1 focus-visible:ring-amber-500/50"
                          placeholder="#000000"
                        />
                        <button
                          type="button"
                          onClick={handleConfirmCustomColor}
                          className="h-8 w-8 rounded-md bg-amber-600 hover:bg-amber-500 flex items-center justify-center transition-all shadow-lg shadow-amber-900/20 active:scale-95"
                          title="Confirm color"
                        >
                          <Check className="h-3.5 w-3.5 text-white" />
                        </button>
                      </div>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>

              {/* Custom Colors (Recently used) */}
              {customColors.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={cn(
                    "w-5 h-5 rounded-full transition-all border-2",
                    color === c
                      ? "border-white scale-110 shadow-md"
                      : "border-transparent hover:scale-105 hover:border-zinc-500",
                  )}
                  style={{ backgroundColor: c }}
                />
              ))}

              {/* Divider if custom colors exist */}
              {customColors.length > 0 && <div className="w-[1px] h-4 bg-zinc-800 self-center" />}

              {/* Preset colors */}
              {PRESET_COLORS.map((c) => (
                <button
                  key={c.hex}
                  type="button"
                  onClick={() => setColor(c.hex)}
                  title={c.name}
                  className={cn(
                    "w-5 h-5 rounded-full transition-all border-2",
                    color === c.hex
                      ? "border-white scale-110 shadow-md"
                      : "border-transparent hover:scale-105 hover:border-zinc-500",
                  )}
                  style={{ backgroundColor: c.hex }}
                />
              ))}
            </div>
          </div>

          {/* Term input */}
          <div className="px-3 pb-3">
            <p className="text-[10px] uppercase tracking-wider text-zinc-600 mb-1.5 font-medium">
              Term
            </p>
            <div className="flex gap-2 items-center">
              <div
                className="w-3 h-3 rounded-full shrink-0 border border-white/20 shadow-sm"
                style={{ backgroundColor: color }}
              />
              <Input
                placeholder="Term to highlight..."
                className="h-8 text-xs flex-1 bg-zinc-800 border-zinc-700 text-zinc-100 placeholder:text-zinc-600 focus-visible:ring-amber-500/30"
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              />
              <button
                type="button"
                onClick={handleAdd}
                className="h-8 w-8 rounded-md bg-amber-600 hover:bg-amber-500 flex items-center justify-center transition-colors shrink-0"
              >
                <Plus className="h-4 w-4 text-white" />
              </button>
            </div>
          </div>

          {/* Active highlights list */}
          {highlights.length > 0 && (
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
              {highlights.map((h) => (
                <div
                  key={h.id}
                  className="flex items-center gap-2 bg-zinc-800/60 rounded-md px-2 py-1.5"
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: h.color }}
                  />
                  <span className="text-xs text-zinc-200 font-mono flex-1 truncate">{h.term}</span>
                  <button
                    type="button"
                    onClick={() => handleRemove(h.id)}
                    className="text-zinc-600 hover:text-red-400 transition-colors"
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
