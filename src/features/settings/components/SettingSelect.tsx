import { cn } from "@/lib/utils";
import { Check, ChevronDown, Search, X } from "lucide-react";
import * as React from "react";
import { useEffect, useMemo, useRef, useState } from "react";

function parseOptionChildren(children: React.ReactNode): Array<{ value: string; label: string }> {
  const items: Array<{ value: string; label: string }> = [];
  React.Children.forEach(children, (child) => {
    if (React.isValidElement(child)) {
      const props = child.props as {
        value?: string | number;
        children?: React.ReactNode;
      };
      const val = props.value !== undefined ? String(props.value) : "";
      const text = props.children !== undefined ? String(props.children) : val;
      items.push({ value: val, label: text });
    }
  });
  return items;
}

export function SettingSelect({
  value,
  onChange,
  id,
  children,
  className,
  placeholder = "Select option...",
  searchable = false,
  searchPlaceholder = "Search options...",
  showFreeBadge = false,
  showFreeFilter = false,
  showCheckForOption,
}: {
  readonly value: string;
  readonly onChange: (v: string) => void;
  readonly id?: string;
  readonly children: React.ReactNode;
  readonly className?: string;
  readonly placeholder?: string;
  readonly searchable?: boolean;
  readonly searchPlaceholder?: string;
  readonly showFreeBadge?: boolean;
  readonly showFreeFilter?: boolean;
  readonly showCheckForOption?: (optionValue: string) => boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [onlyFree, setOnlyFree] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const optionsListRef = useRef<HTMLDivElement>(null);

  const listboxId = useMemo(
    () => (id ? `${id}-listbox` : `select-listbox-${Math.random().toString(36).slice(2, 9)}`),
    [id],
  );

  const options = useMemo(() => parseOptionChildren(children), [children]);
  const selectedOption = options.find((o) => o.value === value);
  const displayLabel = selectedOption ? selectedOption.label : value || placeholder;

  const freeCount = useMemo(() => {
    return options.filter((o) => {
      const val = o.value.toLowerCase();
      return val.endsWith(":free") || val.includes(":free") || val === "openrouter/free";
    }).length;
  }, [options]);

  const filteredOptions = useMemo(() => {
    if (!searchable && !onlyFree) {
      return options;
    }
    const q = searchQuery.toLowerCase().trim();
    return options.filter((opt) => {
      const val = opt.value.toLowerCase();
      const isFree = val.endsWith(":free") || val.includes(":free") || val === "openrouter/free";
      if (onlyFree && !isFree) {
        return false;
      }
      if (!q) {
        return true;
      }
      return opt.label.toLowerCase().includes(q) || val.includes(q);
    });
  }, [options, searchable, onlyFree, searchQuery]);

  useEffect(() => {
    if (isOpen) {
      const idx = filteredOptions.findIndex((o) => o.value === value);
      setHighlightedIndex(idx >= 0 ? idx : 0);
    } else {
      setHighlightedIndex(-1);
    }
  }, [isOpen, value, filteredOptions]);

  useEffect(() => {
    if (isOpen && highlightedIndex >= 0 && optionsListRef.current) {
      const optionEl = optionsListRef.current.children[highlightedIndex] as HTMLElement | undefined;
      if (optionEl && typeof optionEl.scrollIntoView === "function") {
        optionEl.scrollIntoView({ block: "nearest" });
      }
    }
  }, [isOpen, highlightedIndex]);

  useEffect(() => {
    if (isOpen && searchable) {
      const timer = setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
    if (!isOpen) {
      setSearchQuery("");
      setOnlyFree(false);
    }
  }, [isOpen, searchable]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    const handlePointerDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlightedIndex((prev) => (prev < filteredOptions.length - 1 ? prev + 1 : 0));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : filteredOptions.length - 1));
      } else if (e.key === "Enter" && !e.shiftKey) {
        if (highlightedIndex >= 0 && highlightedIndex < filteredOptions.length) {
          e.preventDefault();
          onChange(filteredOptions[highlightedIndex].value);
          setIsOpen(false);
        }
      }
    };
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, filteredOptions, highlightedIndex, onChange]);

  return (
    <div ref={containerRef} className={cn("relative w-full", className)}>
      <button
        id={id}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={listboxId}
        aria-label={displayLabel}
        onClick={() => setIsOpen((prev) => !prev)}
        className={cn(
          "w-full h-10 pl-4 pr-10 rounded-xl text-sm bg-bg-surface border text-text-primary text-left transition-all cursor-pointer flex items-center justify-between select-none relative",
          isOpen ? "border-primary ring-2 ring-primary/20" : "border-border hover:border-border/80",
        )}
      >
        <span className="truncate">{displayLabel}</span>
        <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-text-muted transition-transform duration-200">
          <ChevronDown className={cn("h-4 w-4", isOpen && "rotate-180 text-primary")} />
        </div>
      </button>

      {isOpen && (
        <div
          id={listboxId}
          role="listbox"
          tabIndex={-1}
          className="absolute top-[calc(100%+4px)] left-0 w-full z-50 rounded-xl border border-border bg-[#141716] shadow-2xl overflow-hidden animate-in fade-in-50 zoom-in-95 duration-150 flex flex-col"
        >
          {searchable && (
            <div className="p-2 border-b border-border/80 bg-[#141716] space-y-1.5 shrink-0">
              <div className="relative flex items-center">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-muted pointer-events-none" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={searchPlaceholder}
                  aria-label={searchPlaceholder}
                  className="w-full h-8 pl-8 pr-7 text-xs rounded-lg bg-bg-surface border border-border text-text-primary placeholder:text-text-muted/40 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    aria-label="Clear search query"
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary p-0.5 cursor-pointer"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>

              {(showFreeFilter || freeCount > 0) && (
                <div
                  className="flex items-center justify-between px-0.5 text-xs"
                  aria-live="polite"
                  aria-atomic="true"
                >
                  <span className="text-text-muted">
                    {filteredOptions.length} of {options.length} models
                  </span>
                  <button
                    type="button"
                    onClick={() => setOnlyFree((prev) => !prev)}
                    className={cn(
                      "px-1.5 py-0.5 rounded text-xs font-mono border transition-all cursor-pointer flex items-center gap-1",
                      onlyFree
                        ? "bg-emerald-500/25 text-emerald-300 border-emerald-500/50 font-semibold"
                        : "bg-white/5 text-text-muted border-border hover:text-text-primary",
                    )}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    Free only {freeCount > 0 && `(${freeCount})`}
                  </button>
                </div>
              )}
            </div>
          )}

          <div ref={optionsListRef} className="max-h-60 overflow-y-auto p-1.5 space-y-0.5">
            {filteredOptions.map((opt, idx) => {
              const isSelected = opt.value === value;
              const isHighlighted = idx === highlightedIndex;
              const valLower = opt.value.toLowerCase();
              const isFree =
                showFreeBadge &&
                (valLower.endsWith(":free") ||
                  valLower.includes(":free") ||
                  valLower === "openrouter/free");
              const shouldShowCheck = showCheckForOption
                ? showCheckForOption(opt.value)
                : isSelected;
              return (
                <button
                  key={opt.value}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => {
                    onChange(opt.value);
                    setIsOpen(false);
                  }}
                  onMouseEnter={() => setHighlightedIndex(idx)}
                  className={cn(
                    "w-full px-3 py-2 text-xs rounded-lg text-left transition-colors flex items-center justify-between cursor-pointer group outline-none",
                    isSelected
                      ? "bg-primary/15 text-primary font-medium"
                      : isHighlighted
                        ? "bg-white/10 text-white"
                        : "text-text-primary hover:bg-white/5 hover:text-white",
                  )}
                >
                  <div className="flex items-center gap-2 truncate pr-2">
                    <span className="truncate">{opt.label}</span>
                    {isFree && (
                      <span className="text-xs uppercase font-mono px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/30 shrink-0 leading-none">
                        FREE
                      </span>
                    )}
                  </div>
                  {shouldShowCheck && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
                </button>
              );
            })}

            {filteredOptions.length === 0 && (
              <div className="p-3 text-center text-xs text-text-muted space-y-2">
                <p>No models matching "{searchQuery}"</p>
                {searchQuery.trim() && (
                  <button
                    type="button"
                    onClick={() => {
                      onChange(searchQuery.trim());
                      setIsOpen(false);
                    }}
                    className="w-full py-1.5 px-3 rounded-lg text-xs font-mono bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20 transition-colors cursor-pointer"
                  >
                    Use "{searchQuery.trim()}" as custom model
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
