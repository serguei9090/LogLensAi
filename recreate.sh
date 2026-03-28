#!/bin/bash
mkdir -p src/components/atoms src/components/molecules src/components/organisms src/components/templates src/components/pages src/store src/lib/hooks sidecar/src sidecar/tests

# globals.css
cat << 'CSS' > src/styles/globals.css
@import "tailwindcss";
@import "@fontsource-variable/inter";
@import "@fontsource/jetbrains-mono";

@theme {
  --color-bg-base: #0D0F0E;
  --color-bg-surface: #111613;
  --color-bg-surface-bright: #1A1F1C;
  --color-bg-hover: #1E2520;
  --color-border: #2A3430;
  --color-border-muted: #1D2420;
  --color-primary: #22C55E;
  --color-primary-hover: #16A34A;
  --color-primary-muted: #14532D;
  --color-primary-glow: #22C55E33;
  --color-text-primary: #E8F5EC;
  --color-text-secondary: #8FA898;
  --color-text-muted: #4D6057;
  --color-text-inverse: #0D0F0E;
  --color-error: #EF4444;
  --color-error-bg: #450A0A;
  --color-warning: #F59E0B;
  --color-warning-bg: #451A03;
  --color-info: #38BDF8;
  --color-info-bg: #0C2A3E;
  --color-debug: #A78BFA;
  --color-debug-bg: #1E1333;
  --color-highlight-1: #FBBF24;
  --color-highlight-2: #60A5FA;
  --color-highlight-3: #F472B6;
  --color-scrollbar: #2A3430;

  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-xl: 16px;

  --font-sans: "Inter Variable", system-ui, sans-serif;
  --font-mono: "JetBrains Mono", monospace;
}

:root {
  --bg-base: var(--color-bg-base);
  --bg-surface: var(--color-bg-surface);
  --bg-surface-bright: var(--color-bg-surface-bright);
  --bg-hover: var(--color-bg-hover);
  --border: var(--color-border);
  --border-muted: var(--color-border-muted);
  --primary: var(--color-primary);
  --primary-hover: var(--color-primary-hover);
  --primary-muted: var(--color-primary-muted);
  --primary-glow: var(--color-primary-glow);
  --text-primary: var(--color-text-primary);
  --text-secondary: var(--color-text-secondary);
  --text-muted: var(--color-text-muted);
  --text-inverse: var(--color-text-inverse);
  --error: var(--color-error);
  --error-bg: var(--color-error-bg);
  --warning: var(--color-warning);
  --warning-bg: var(--color-warning-bg);
  --info: var(--color-info);
  --info-bg: var(--color-info-bg);
  --debug: var(--color-debug);
  --debug-bg: var(--color-debug-bg);
  --highlight-1: var(--color-highlight-1);
  --highlight-2: var(--color-highlight-2);
  --highlight-3: var(--color-highlight-3);
  --scrollbar: var(--color-scrollbar);

  --radius: var(--radius-md);
}

@layer base {
  :root {
    --background: var(--color-bg-base);
    --foreground: var(--color-text-primary);
    --card: var(--color-bg-surface-bright);
    --card-foreground: var(--color-text-primary);
    --popover: var(--color-bg-surface-bright);
    --popover-foreground: var(--color-text-primary);
    --primary-foreground: var(--color-text-inverse);
    --secondary: var(--color-bg-surface);
    --secondary-foreground: var(--color-text-secondary);
    --muted: var(--color-bg-surface);
    --muted-foreground: var(--color-text-muted);
    --accent: var(--color-bg-hover);
    --accent-foreground: var(--color-text-primary);
    --destructive: var(--color-error);
    --destructive-foreground: var(--color-text-inverse);
    --input: var(--color-border);
    --ring: var(--color-primary);
  }
}

* {
  box-sizing: border-box;
}

body {
  background-color: var(--bg-base);
  color: var(--text-primary);
  font-family: var(--font-sans);
  font-size: 14px;
}
CSS

yes | bunx shadcn@latest add input label switch badge tooltip dialog popover select separator scroll-area tabs card dropdown-menu table skeleton sonner accordion context-menu -y

# atoms
cat << 'ATOM' > src/components/atoms/LogLevelBadge.tsx
import { Badge } from "@/components/ui/badge";

export type LogLevel = "ERROR" | "WARN" | "INFO" | "DEBUG" | "TRACE";

interface LogLevelBadgeProps {
  level: LogLevel;
  className?: string;
}

const levelStyles: Record<LogLevel, string> = {
  ERROR: "bg-error text-text-inverse hover:bg-error/80",
  WARN: "bg-warning text-text-inverse hover:bg-warning/80",
  INFO: "bg-info text-text-inverse hover:bg-info/80",
  DEBUG: "bg-debug text-text-inverse hover:bg-debug/80",
  TRACE: "bg-primary-muted text-text-primary hover:bg-primary-muted/80",
};

export function LogLevelBadge({ level, className }: LogLevelBadgeProps) {
  return (
    <Badge className={`${levelStyles[level]} ${className || ""}`} variant="outline">
      {level}
    </Badge>
  );
}
ATOM

cat << 'ATOM' > src/components/atoms/StatusDot.tsx
import { cn } from "@/lib/utils";

interface StatusDotProps {
  active: boolean;
  className?: string;
}

export function StatusDot({ active, className }: StatusDotProps) {
  return (
    <div className={cn("relative flex h-3 w-3", className)}>
      {active && (
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
      )}
      <span
        className={cn(
          "relative inline-flex rounded-full h-3 w-3",
          active ? "bg-primary" : "bg-border"
        )}
      ></span>
    </div>
  );
}
ATOM

cat << 'ATOM' > src/components/atoms/TailSwitch.tsx
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

interface TailSwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label?: string;
  className?: string;
}

export function TailSwitch({ checked, onCheckedChange, label = "Live Tail", className }: TailSwitchProps) {
  return (
    <div className={`flex items-center space-x-2 ${className || ""}`}>
      <Switch id="live-tail" checked={checked} onCheckedChange={onCheckedChange} />
      <Label htmlFor="live-tail">{label}</Label>
    </div>
  );
}
ATOM

cat << 'ATOM' > src/components/atoms/HelpTooltip.tsx
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { HelpCircle } from "lucide-react";

interface HelpTooltipProps {
  content: string;
  className?: string;
}

export function HelpTooltip({ content, className }: HelpTooltipProps) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <HelpCircle className={`h-4 w-4 text-text-muted hover:text-text-primary cursor-help ${className || ""}`} />
        </TooltipTrigger>
        <TooltipContent>
          <p>{content}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
ATOM

cat << 'ATOM' > src/components/atoms/IconButton.tsx
import { Button } from "@/components/ui/button";
import { ReactNode } from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface IconButtonProps {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  className?: string;
}

export function IconButton({ icon, label, onClick, className }: IconButtonProps) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon" onClick={onClick} className={className} aria-label={label}>
            {icon}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>{label}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
ATOM

# molecules
cat << 'MOL' > src/components/molecules/FilterBuilder.tsx
import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { X, Filter, Plus } from "lucide-react";

export interface FilterEntry {
  id: string;
  field: "level" | "source_id" | "cluster_id" | "raw_text";
  operator: "=" | "!=" | "contains" | "not_contains" | "starts_with";
  value: string;
}

interface FilterBuilderProps {
  filters: FilterEntry[];
  onChange: (filters: FilterEntry[]) => void;
}

export function FilterBuilder({ filters, onChange }: FilterBuilderProps) {
  const [open, setOpen] = useState(false);
  const [field, setField] = useState<FilterEntry["field"]>("raw_text");
  const [operator, setOperator] = useState<FilterEntry["operator"]>("contains");
  const [value, setValue] = useState("");

  const handleAdd = () => {
    if (!value) return;
    onChange([
      ...filters,
      { id: Math.random().toString(36).substr(2, 9), field, operator, value },
    ]);
    setValue("");
  };

  const handleRemove = (id: string) => {
    onChange(filters.filter((f) => f.id !== id));
  };

  return (
    <div className="flex items-center gap-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="h-8 border-dashed">
            <Filter className="mr-2 h-4 w-4" />
            Filters {filters.length > 0 && <Badge variant="secondary" className="ml-2 px-1 rounded-sm">{filters.length}</Badge>}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-3" align="start">
          <div className="flex flex-col gap-3">
            <div className="flex gap-2">
              <Select value={field} onValueChange={(v) => setField(v as any)}>
                <SelectTrigger className="w-[110px] h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="level">Level</SelectItem>
                  <SelectItem value="source_id">Source ID</SelectItem>
                  <SelectItem value="cluster_id">Cluster ID</SelectItem>
                  <SelectItem value="raw_text">Raw Text</SelectItem>
                </SelectContent>
              </Select>
              <Select value={operator} onValueChange={(v) => setOperator(v as any)}>
                <SelectTrigger className="w-[110px] h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="=">=</SelectItem>
                  <SelectItem value="!=">!=</SelectItem>
                  <SelectItem value="contains">Contains</SelectItem>
                  <SelectItem value="not_contains">Not Contains</SelectItem>
                  <SelectItem value="starts_with">Starts With</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="Value..."
                className="h-8 text-xs flex-1"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              />
              <Button size="icon" className="h-8 w-8" onClick={handleAdd}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
      {filters.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap">
          {filters.map((f) => (
            <Badge key={f.id} variant="secondary" className="bg-primary-muted text-primary border-primary gap-1 pl-2 pr-1 py-0 h-6">
              <span className="text-[10px] opacity-70">{f.field}</span>
              <span className="text-[10px]">{f.operator}</span>
              <span className="font-mono text-xs max-w-[100px] truncate">{f.value}</span>
              <button onClick={() => handleRemove(f.id)} className="hover:bg-primary/20 rounded-full p-0.5" aria-label="Remove filter">
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
          <Button variant="ghost" size="xs" onClick={() => onChange([])} className="h-6 text-xs text-text-muted hover:text-text-primary">
            Clear
          </Button>
        </div>
      )}
    </div>
  );
}
MOL

cat << 'MOL' > src/components/molecules/HighlightBuilder.tsx
import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Highlighter, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface HighlightEntry {
  id: string;
  term: string;
  color: string;
}

interface HighlightBuilderProps {
  highlights: HighlightEntry[];
  onChange: (highlights: HighlightEntry[]) => void;
}

const PRESET_COLORS = ["#FBBF24", "#60A5FA", "#F472B6", "#34D399", "#FB923C"];

export function HighlightBuilder({ highlights, onChange }: HighlightBuilderProps) {
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState("");
  const [color, setColor] = useState(PRESET_COLORS[0]);

  const handleAdd = () => {
    if (!term) return;
    onChange([
      ...highlights,
      { id: Math.random().toString(36).substr(2, 9), term, color },
    ]);
    setTerm("");
  };

  const handleRemove = (id: string) => {
    onChange(highlights.filter((h) => h.id !== id));
  };

  return (
    <div className="flex items-center gap-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="h-8 border-dashed">
            <Highlighter className="mr-2 h-4 w-4" />
            Highlights {highlights.length > 0 && <Badge variant="secondary" className="ml-2 px-1 rounded-sm">{highlights.length}</Badge>}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-3" align="start">
          <div className="flex flex-col gap-3">
            <div className="flex gap-2 items-center">
              <Input
                placeholder="Term to highlight..."
                className="h-8 text-xs flex-1"
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              />
              <Button size="icon" className="h-8 w-8" onClick={handleAdd}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex justify-between px-1">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={cn(
                    "w-6 h-6 rounded-full border-2 transition-all",
                    color === c ? "border-primary shadow-sm shadow-primary/20 scale-110" : "border-transparent hover:scale-105"
                  )}
                  style={{ backgroundColor: c }}
                  aria-label={`Select color ${c}`}
                />
              ))}
            </div>
          </div>
        </PopoverContent>
      </Popover>
      {highlights.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap">
          {highlights.map((h) => (
            <Badge key={h.id} variant="secondary" className="gap-1.5 pl-2 pr-1 py-0 h-6 border-transparent">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: h.color }} />
              <span className="font-mono text-xs max-w-[100px] truncate">{h.term}</span>
              <button onClick={() => handleRemove(h.id)} className="hover:bg-foreground/10 rounded-full p-0.5" aria-label="Remove highlight">
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
          <Button variant="ghost" size="xs" onClick={() => onChange([])} className="h-6 text-xs text-text-muted hover:text-text-primary">
            Clear
          </Button>
        </div>
      )}
    </div>
  );
}
MOL

cat << 'MOL' > src/components/molecules/SearchBar.tsx
import { Input } from "@/components/ui/input";
import { Search, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useDebounce } from "@/lib/hooks/useDebounce";

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function SearchBar({ value, onChange, placeholder = "Search logs...", className }: SearchBarProps) {
  const [localValue, setLocalValue] = useState(value);
  const debouncedValue = useDebounce(localValue, 300);

  useEffect(() => {
    onChange(debouncedValue);
  }, [debouncedValue, onChange]);

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const handleClear = () => {
    setLocalValue("");
    onChange("");
  };

  return (
    <div className={`relative flex items-center w-full max-w-sm ${className || ""}`}>
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted pointer-events-none" />
      <Input
        type="text"
        placeholder={placeholder}
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        className="pl-9 pr-9 h-9 bg-bg-surface-bright border-border text-sm placeholder:text-text-muted focus-visible:ring-1 focus-visible:ring-primary focus-visible:border-primary transition-colors"
      />
      {localValue && (
        <button
          onClick={handleClear}
          className="absolute right-2 top-1/2 -translate-y-1/2 h-5 w-5 rounded-full flex items-center justify-center text-text-muted hover:text-text-primary hover:bg-bg-hover transition-colors focus:outline-none focus:ring-1 focus:ring-primary"
          aria-label="Clear search"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}
MOL

cat << 'MOL' > src/lib/hooks/useDebounce.ts
import { useState, useEffect } from "react";

export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}
MOL

cat << 'MOL' > src/lib/hooks/useSidecarBridge.ts
import { invoke } from "@tauri-apps/api/core";

export interface SidecarRequest {
  method: string;
  params?: Record<string, any>;
}

export interface SidecarResponse<T> {
  jsonrpc: string;
  id: string | number | null;
  result?: T;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}

export async function useSidecarBridge<T>(request: SidecarRequest): Promise<T> {
  try {
    // In a real Tauri setup, we would invoke the Rust command that writes to stdin
    // and reads from stdout of the python sidecar.
    // For this demonstration, we'll mock the JSON-RPC interface.
    
    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 200));

    // Mock implementations
    if (request.method === "get_logs") {
      return { total: 0, logs: [], offset: 0, limit: 50 } as unknown as T;
    }
    if (request.method === "start_tail") {
      return { status: "started" } as unknown as T;
    }
    if (request.method === "stop_tail") {
      return { status: "stopped" } as unknown as T;
    }
    if (request.method === "update_settings") {
      return { status: "success" } as unknown as T;
    }
    if (request.method === "get_settings") {
      return {} as unknown as T;
    }
    
    throw new Error(`Mock error: method ${request.method} not found`);

  } catch (error) {
    console.error("Sidecar bridge error:", error);
    throw error;
  }
}
MOL

# organisms
cat << 'ORG' > src/components/organisms/LogToolbar.tsx
import { SearchBar } from "@/components/molecules/SearchBar";
import { FilterBuilder, FilterEntry } from "@/components/molecules/FilterBuilder";
import { HighlightBuilder, HighlightEntry } from "@/components/molecules/HighlightBuilder";
import { TailSwitch } from "@/components/atoms/TailSwitch";
import { StatusDot } from "@/components/atoms/StatusDot";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

interface LogToolbarProps {
  onSearch: (q: string) => void;
  activeFilters: FilterEntry[];
  onFilterChange: (f: FilterEntry[]) => void;
  activeHighlights: HighlightEntry[];
  onHighlightChange: (h: HighlightEntry[]) => void;
  isWrapping: boolean;
  onWrapToggle: (v: boolean) => void;
  isTailing: boolean;
  onTailToggle: (v: boolean) => void;
  status: boolean;
}

export function LogToolbar({
  onSearch,
  activeFilters,
  onFilterChange,
  activeHighlights,
  onHighlightChange,
  isWrapping,
  onWrapToggle,
  isTailing,
  onTailToggle,
  status,
}: LogToolbarProps) {
  return (
    <div className="sticky top-0 z-10 flex flex-wrap items-center gap-4 bg-bg-surface-bright border-b border-border p-3 shadow-sm">
      <div className="flex-1 min-w-[200px] max-w-sm">
        <SearchBar value="" onChange={onSearch} />
      </div>
      
      <div className="flex items-center gap-2">
        <FilterBuilder filters={activeFilters} onChange={onFilterChange} />
        <div className="h-6 w-px bg-border mx-2" />
        <HighlightBuilder highlights={activeHighlights} onChange={onHighlightChange} />
      </div>

      <div className="flex-1" />

      <div className="flex items-center gap-6 shrink-0">
        <div className="flex items-center space-x-2">
          <Switch id="wrap-text" checked={isWrapping} onCheckedChange={onWrapToggle} />
          <Label htmlFor="wrap-text" className="text-sm font-medium leading-none cursor-pointer">
            Wrap Lines
          </Label>
        </div>
        
        <div className="h-6 w-px bg-border" />

        <TailSwitch checked={isTailing} onCheckedChange={onTailToggle} />
        
        <StatusDot active={status} className="ml-2" />
      </div>
    </div>
  );
}
ORG

cat << 'ORG' > src/components/organisms/VirtualLogTable.tsx
import { useVirtualizer } from "@tanstack/react-virtual";
import { useRef, useState, useMemo } from "react";
import { LogLevelBadge, LogLevel } from "@/components/atoms/LogLevelBadge";
import { HighlightEntry } from "@/components/molecules/HighlightBuilder";
import { MessageSquarePlus, ChevronDown } from "lucide-react";
import { IconButton } from "@/components/atoms/IconButton";
import React from "react";

export interface LogEntry {
  id: number;
  timestamp: string;
  level: LogLevel;
  message: string;
  cluster_id: string;
  has_comment?: boolean;
  comment?: string;
  raw_text?: string;
}

interface VirtualLogTableProps {
  logs: LogEntry[];
  highlights: HighlightEntry[];
  isWrapping: boolean;
  onAddComment: (id: number, comment: string) => void;
}

export function VirtualLogTable({ logs, highlights, isWrapping, onAddComment }: VirtualLogTableProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const [expandedRow, setExpandedRow] = useState<number | null>(null);

  const rowVirtualizer = useVirtualizer({
    count: logs.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => (isWrapping ? 40 : 32),
    overscan: 10,
    measureElement: (element) => element?.getBoundingClientRect().height,
  });

  const getHighlightedElements = (text: string) => {
    if (!highlights || highlights.length === 0 || !text) return <>{text}</>;

    const highlightColors: { [term: string]: string } = {};
    const terms: string[] = [];

    highlights.forEach((h) => {
      if (h.term) {
        highlightColors[h.term.toLowerCase()] = h.color;
        terms.push(h.term.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&"));
      }
    });

    if (terms.length === 0) return <>{text}</>;

    const regex = new RegExp(`(${terms.join("|")})`, "gi");
    const parts = text.split(regex);

    return (
      <>
        {parts.map((part, i) => {
          if (regex.test(part)) {
            const color = highlightColors[part.toLowerCase()];
            return (
              <mark key={i} style={{ backgroundColor: color, color: "black", padding: "0 2px", borderRadius: "2px" }}>
                {part}
              </mark>
            );
          }
          return <React.Fragment key={i}>{part}</React.Fragment>;
        })}
      </>
    );
  };

  const toggleRow = (id: number) => {
    setExpandedRow(expandedRow === id ? null : id);
  };

  return (
    <div ref={parentRef} className="h-full w-full overflow-auto bg-bg-base border border-border rounded-md relative select-text">
      <div
        style={{
          height: `${rowVirtualizer.getTotalSize()}px`,
          width: "100%",
          position: "relative",
        }}
      >
        <table className="w-full text-left text-sm whitespace-nowrap table-fixed">
          <thead className="sticky top-0 bg-bg-surface-bright border-b border-border z-10 text-text-secondary text-xs font-semibold h-8 select-none">
            <tr>
              <th className="w-12 px-2 py-1 text-center">#</th>
              <th className="w-48 px-2 py-1">Timestamp</th>
              <th className="w-24 px-2 py-1">Level</th>
              <th className={`px-2 py-1 ${isWrapping ? "" : "truncate"}`}>Message</th>
              <th className="w-32 px-2 py-1 text-right">Cluster</th>
              <th className="w-16 px-2 py-1 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="font-mono text-[13px] relative z-0">
            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
              const log = logs[virtualRow.index];
              const isExpanded = expandedRow === log.id;
              
              let rowBg = "bg-transparent hover:bg-bg-hover";
              if (log.level === "ERROR") rowBg = "bg-error-bg/30 border-l-2 border-error hover:bg-error-bg/50";
              else if (log.level === "WARN") rowBg = "bg-warning-bg/30 border-l-2 border-warning hover:bg-warning-bg/50";
              else if (log.level === "INFO") rowBg = "bg-info-bg/10 hover:bg-info-bg/30 text-info";
              else if (log.level === "DEBUG") rowBg = "bg-debug-bg/10 hover:bg-debug-bg/30 text-debug";

              const hasHighlightMatch = highlights.some(h => new RegExp(h.term, 'i').test(log.message));
              if (hasHighlightMatch && log.level !== "ERROR" && log.level !== "WARN") {
                rowBg = "bg-primary-muted/30 border-l-2 border-primary hover:bg-primary-muted/50 text-text-primary";
              }

              return (
                <tr
                  key={virtualRow.key}
                  ref={rowVirtualizer.measureElement}
                  data-index={virtualRow.index}
                  className={`group cursor-pointer transition-colors border-b border-border-muted ${rowBg} ${isExpanded ? "bg-bg-hover" : ""}`}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                  onClick={() => toggleRow(log.id)}
                >
                  <td className="w-12 px-2 py-1 text-center text-text-muted select-none group-hover:text-text-secondary align-top">{log.id}</td>
                  <td className="w-48 px-2 py-1 text-text-secondary align-top">{log.timestamp}</td>
                  <td className="w-24 px-2 py-1 align-top"><LogLevelBadge level={log.level} className="scale-90" /></td>
                  <td className={`px-2 py-1 text-text-primary overflow-hidden align-top ${isWrapping ? "whitespace-normal break-words" : "text-ellipsis whitespace-nowrap"}`}>
                    {getHighlightedElements(log.message)}
                  </td>
                  <td className="w-32 px-2 py-1 text-right text-text-muted truncate align-top">
                    {log.cluster_id}
                  </td>
                  <td className="w-16 px-2 py-1 text-center relative align-top" onClick={(e) => e.stopPropagation()}>
                    <IconButton
                      icon={<MessageSquarePlus className="h-4 w-4" />}
                      label="Add Comment"
                      onClick={() => {
                        const comment = prompt("Enter comment:");
                        if (comment) onAddComment(log.id, comment);
                      }}
                      className="opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6 text-text-muted hover:text-primary"
                    />
                    {log.has_comment && (
                      <div className="absolute top-1 right-2 w-2 h-2 rounded-full bg-primary ring-2 ring-bg-surface-bright" title={log.comment} />
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      
      {expandedRow !== null && (
        <div className="sticky bottom-0 left-0 w-full bg-bg-surface-bright border-t border-border p-4 shadow-lg z-20 slide-in-bottom">
          <div className="flex justify-between items-center mb-2">
            <h3 className="font-semibold text-text-primary flex items-center gap-2">
              <ChevronDown className="h-4 w-4 text-text-muted" />
              Raw Log Data (ID: {expandedRow})
            </h3>
            <IconButton
              icon={<ChevronDown className="h-4 w-4 rotate-180" />}
              label="Close"
              onClick={() => setExpandedRow(null)}
            />
          </div>
          <pre className="text-xs font-mono text-text-secondary bg-bg-base p-3 rounded-md border border-border overflow-x-auto max-h-40 overflow-y-auto select-text whitespace-pre-wrap">
            {logs.find(l => l.id === expandedRow)?.raw_text || logs.find(l => l.id === expandedRow)?.message || "No raw data available."}
          </pre>
        </div>
      )}
    </div>
  );
}
ORG

cat << 'ORG' > src/components/organisms/Sidebar.tsx
import { Plus, Database, Settings, LayoutDashboard, Terminal, MoreVertical, Trash2, Edit2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger, ContextMenuSeparator } from "@/components/ui/context-menu";

export interface Workspace {
  id: string;
  name: string;
  sourceType: "local" | "ssh" | "manual";
  sourcePath: string | null;
}

interface SidebarProps {
  workspaces: Workspace[];
  activeWorkspaceId: string;
  onWorkspaceSelect: (id: string) => void;
  onWorkspaceCreate: () => void;
  onWorkspaceRename?: (id: string, name: string) => void;
  onWorkspaceDelete?: (id: string) => void;
  activeNav: "investigation" | "settings";
  onNavSelect: (nav: "investigation" | "settings") => void;
}

export function Sidebar({
  workspaces,
  activeWorkspaceId,
  onWorkspaceSelect,
  onWorkspaceCreate,
  onWorkspaceRename,
  onWorkspaceDelete,
  activeNav,
  onNavSelect,
}: SidebarProps) {
  
  const handleRename = (id: string, currentName: string) => {
    if (!onWorkspaceRename) return;
    const newName = prompt("Enter new workspace name:", currentName);
    if (newName && newName.trim() !== "") {
      onWorkspaceRename(id, newName.trim());
    }
  };

  const handleDelete = (id: string) => {
    if (!onWorkspaceDelete) return;
    if (confirm("Are you sure you want to delete this workspace?")) {
      onWorkspaceDelete(id);
    }
  };

  return (
    <div className="w-64 h-screen bg-bg-surface border-r border-border flex flex-col select-none">
      <div className="p-4 border-b border-border flex items-center gap-3">
        <div className="bg-primary p-1.5 rounded-lg text-bg-base">
          <Terminal className="h-5 w-5" />
        </div>
        <h1 className="font-bold text-lg tracking-tight text-text-primary">LogLens<span className="text-primary">Ai</span></h1>
      </div>

      <div className="flex-1 flex flex-col min-h-0">
        <div className="px-4 py-3 border-b border-border-muted flex justify-between items-center">
          <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">Workspaces</span>
          <Button variant="ghost" size="icon-xs" onClick={onWorkspaceCreate} aria-label="Create Workspace" className="text-text-secondary hover:text-primary h-6 w-6">
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        <ScrollArea className="flex-1 overflow-y-auto w-full">
          <div className="px-2 py-2 space-y-1">
            {workspaces.map((ws) => (
              <ContextMenu key={ws.id}>
                <ContextMenuTrigger>
                  <button
                    onClick={() => onWorkspaceSelect(ws.id)}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2 text-sm rounded-md transition-colors text-left",
                      activeWorkspaceId === ws.id
                        ? "bg-primary-muted/20 text-primary font-medium"
                        : "text-text-secondary hover:bg-bg-hover hover:text-text-primary"
                    )}
                  >
                    <Database className={cn("h-4 w-4 shrink-0", activeWorkspaceId === ws.id ? "text-primary" : "text-text-muted")} />
                    <div className="flex-1 truncate">
                      <span className="block truncate">{ws.name}</span>
                      {ws.sourcePath && (
                        <span className="block text-[10px] text-text-muted truncate mt-0.5 opacity-70 font-mono">
                          {ws.sourcePath.split("/").pop()}
                        </span>
                      )}
                    </div>
                  </button>
                </ContextMenuTrigger>
                <ContextMenuContent className="w-48">
                  <ContextMenuItem onClick={() => handleRename(ws.id, ws.name)} className="cursor-pointer">
                    <Edit2 className="mr-2 h-4 w-4" />
                    Rename Workspace
                  </ContextMenuItem>
                  <ContextMenuSeparator />
                  <ContextMenuItem onClick={() => handleDelete(ws.id)} className="cursor-pointer text-error focus:text-error focus:bg-error-bg">
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete Workspace
                  </ContextMenuItem>
                </ContextMenuContent>
              </ContextMenu>
            ))}
          </div>
        </ScrollArea>

        <div className="mt-auto px-2 py-4 border-t border-border-muted space-y-1 bg-bg-surface/50">
          <button
            onClick={() => onNavSelect("investigation")}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2.5 text-sm rounded-md transition-colors text-left",
              activeNav === "investigation"
                ? "bg-primary text-text-inverse font-medium"
                : "text-text-secondary hover:bg-bg-hover hover:text-text-primary"
            )}
          >
            <Terminal className="h-4 w-4" />
            Investigation
          </button>
          
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="w-full flex items-center gap-3 px-3 py-2.5 text-sm rounded-md transition-colors text-left text-text-muted cursor-not-allowed opacity-50">
                  <LayoutDashboard className="h-4 w-4" />
                  Dashboard
                </div>
              </TooltipTrigger>
              <TooltipContent side="right">Coming Soon</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <button
            onClick={() => onNavSelect("settings")}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2.5 text-sm rounded-md transition-colors text-left",
              activeNav === "settings"
                ? "bg-primary text-text-inverse font-medium"
                : "text-text-secondary hover:bg-bg-hover hover:text-text-primary"
            )}
          >
            <Settings className="h-4 w-4" />
            Settings
          </button>
        </div>
      </div>
    </div>
  );
}
ORG

cat << 'ORG' > src/components/organisms/DiagnosticSidebar.tsx
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { X, Activity, AlertTriangle, Lightbulb } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

export interface DiagnosticData {
  summary: string;
  root_cause: string;
  recommended_actions: string[];
}

interface DiagnosticSidebarProps {
  open: boolean;
  onClose: () => void;
  data: DiagnosticData | null;
  loading: boolean;
}

export function DiagnosticSidebar({ open, onClose, data, loading }: DiagnosticSidebarProps) {
  return (
    <div
      className={cn(
        "fixed inset-y-0 right-0 w-96 bg-bg-surface-bright border-l border-border shadow-2xl transform transition-transform duration-300 ease-in-out z-50 flex flex-col",
        open ? "translate-x-0" : "translate-x-full"
      )}
    >
      <div className="flex items-center justify-between p-4 border-b border-border bg-bg-surface">
        <div className="flex items-center gap-2 text-primary font-semibold">
          <Activity className="h-5 w-5" />
          <h2>AI Diagnostics</h2>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 text-text-muted hover:text-text-primary">
          <X className="h-4 w-4" />
        </Button>
      </div>

      <ScrollArea className="flex-1 p-5">
        {loading ? (
          <div className="space-y-4 animate-pulse">
            <div className="h-4 bg-border rounded w-3/4"></div>
            <div className="h-4 bg-border rounded w-1/2"></div>
            <div className="h-4 bg-border rounded w-5/6"></div>
          </div>
        ) : data ? (
          <div className="space-y-6">
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wider flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-warning" />
                Root Cause
              </h3>
              <p className="text-sm leading-relaxed text-text-primary bg-warning-bg/20 p-3 rounded-md border border-warning/20">
                {data.root_cause}
              </p>
            </div>

            <Separator className="bg-border-muted" />

            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wider">
                Summary
              </h3>
              <p className="text-sm leading-relaxed text-text-primary">
                {data.summary}
              </p>
            </div>

            <Separator className="bg-border-muted" />

            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wider flex items-center gap-2">
                <Lightbulb className="h-4 w-4 text-info" />
                Recommended Actions
              </h3>
              <ul className="space-y-2">
                {data.recommended_actions.map((action, i) => (
                  <li key={i} className="flex gap-3 text-sm text-text-primary bg-bg-base p-3 rounded border border-border">
                    <span className="text-primary font-mono font-bold">{i + 1}.</span>
                    <span className="leading-tight">{action}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-text-muted space-y-4 pt-20">
            <Activity className="h-12 w-12 opacity-20" />
            <p className="text-sm text-center">Select a cluster to analyze</p>
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
ORG

cat << 'ORG' > src/components/organisms/ImportFeedModal.tsx
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { TailSwitch } from "@/components/atoms/TailSwitch";
import { FolderOpen, Terminal, Code } from "lucide-react";
import { open as openDialog } from "@tauri-apps/plugin-dialog";

interface ImportFeedModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportLocal: (path: string, tail: boolean) => void;
  onImportSSH: (host: string, port: number, user: string, pass: string, path: string, tail: boolean) => void;
  onIngestManual: (logs: string) => void;
}

export function ImportFeedModal({ open, onOpenChange, onImportLocal, onImportSSH, onIngestManual }: ImportFeedModalProps) {
  const [activeTab, setActiveTab] = useState("local");
  
  const [localPath, setLocalPath] = useState("");
  const [localTail, setLocalTail] = useState(true);

  const [sshHost, setSshHost] = useState("");
  const [sshPort, setSshPort] = useState("22");
  const [sshUser, setSshUser] = useState("");
  const [sshPass, setSshPass] = useState("");
  const [sshPath, setSshPath] = useState("");
  const [sshTail, setSshTail] = useState(true);

  const [manualLogs, setManualLogs] = useState("");

  const handleBrowseLocal = async () => {
    try {
      const selected = await openDialog({
        multiple: false,
        directory: false,
      });
      if (selected && typeof selected === "string") {
        setLocalPath(selected);
      } else if (selected && Array.isArray(selected) && selected.length > 0) {
        setLocalPath(selected[0]);
      }
    } catch (e) {
      // Fallback for browser environment testing
      console.warn("Tauri dialog failed, using prompt fallback.", e);
      const path = prompt("Enter local file path:");
      if (path) setLocalPath(path);
    }
  };

  const submitLocal = (e: React.FormEvent) => {
    e.preventDefault();
    if (localPath) {
      onImportLocal(localPath, localTail);
      onOpenChange(false);
    }
  };

  const submitSSH = (e: React.FormEvent) => {
    e.preventDefault();
    if (sshHost && sshUser && sshPath) {
      onImportSSH(sshHost, parseInt(sshPort), sshUser, sshPass, sshPath, sshTail);
      onOpenChange(false);
    }
  };

  const submitManual = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualLogs) {
      onIngestManual(manualLogs);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Import Data Feed</DialogTitle>
          <DialogDescription>
            Select the source of your logs to begin ingestion and clustering.
          </DialogDescription>
        </DialogHeader>
        
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full mt-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="local"><FolderOpen className="w-4 h-4 mr-2"/>Local File</TabsTrigger>
            <TabsTrigger value="ssh"><Terminal className="w-4 h-4 mr-2"/>SSH Remote</TabsTrigger>
            <TabsTrigger value="manual"><Code className="w-4 h-4 mr-2"/>Manual</TabsTrigger>
          </TabsList>
          
          <TabsContent value="local">
            <form onSubmit={submitLocal} className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="local-path">File Path</Label>
                <div className="flex gap-2">
                  <Input 
                    id="local-path" 
                    placeholder="/var/log/syslog" 
                    value={localPath}
                    onChange={(e) => setLocalPath(e.target.value)}
                    required
                  />
                  <Button type="button" variant="secondary" onClick={handleBrowseLocal}>Browse</Button>
                </div>
              </div>
              <div className="flex items-center justify-between pt-2">
                <TailSwitch checked={localTail} onCheckedChange={setLocalTail} label="Live Tail" />
                <Button type="submit">Import File</Button>
              </div>
            </form>
          </TabsContent>
          
          <TabsContent value="ssh">
            <form onSubmit={submitSSH} className="space-y-4 pt-4">
              <div className="grid grid-cols-4 gap-4">
                <div className="col-span-3 space-y-2">
                  <Label htmlFor="ssh-host">Host</Label>
                  <Input id="ssh-host" placeholder="example.com or 192.168.1.10" value={sshHost} onChange={(e) => setSshHost(e.target.value)} required />
                </div>
                <div className="col-span-1 space-y-2">
                  <Label htmlFor="ssh-port">Port</Label>
                  <Input id="ssh-port" type="number" value={sshPort} onChange={(e) => setSshPort(e.target.value)} required />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="ssh-user">Username</Label>
                  <Input id="ssh-user" value={sshUser} onChange={(e) => setSshUser(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ssh-pass">Password (Optional)</Label>
                  <Input id="ssh-pass" type="password" placeholder="Or use SSH key" value={sshPass} onChange={(e) => setSshPass(e.target.value)} />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="ssh-path">Remote File Path</Label>
                <Input id="ssh-path" placeholder="/var/log/nginx/access.log" value={sshPath} onChange={(e) => setSshPath(e.target.value)} required />
              </div>
              <div className="flex items-center justify-between pt-2">
                <TailSwitch checked={sshTail} onCheckedChange={setSshTail} label="Live Tail" />
                <Button type="submit">Connect & Import</Button>
              </div>
            </form>
          </TabsContent>
          
          <TabsContent value="manual">
            <form onSubmit={submitManual} className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="manual-logs">Paste Raw Logs</Label>
                <Textarea 
                  id="manual-logs" 
                  placeholder="Paste logs here (one per line)..." 
                  className="min-h-[150px] font-mono text-xs"
                  value={manualLogs}
                  onChange={(e) => setManualLogs(e.target.value)}
                  required
                />
              </div>
              <div className="flex justify-end pt-2">
                <Button type="submit">Ingest Logs</Button>
              </div>
            </form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
ORG

cat << 'ORG' > src/components/organisms/SettingsPanel.tsx
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { HelpTooltip } from "@/components/atoms/HelpTooltip";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

export interface AppSettings {
  ai_provider: string;
  ai_api_key: string;
  ai_system_prompt: string;
  drain_similarity_threshold: number;
  drain_max_children: number;
  drain_max_clusters: number;
  ui_row_height: string;
  ui_font_size: string;
}

const defaultSettings: AppSettings = {
  ai_provider: "gemini-cli",
  ai_api_key: "",
  ai_system_prompt: "You are a Log Analysis Specialist. Return JSON with summary, root_cause, actions.",
  drain_similarity_threshold: 0.4,
  drain_max_children: 100,
  drain_max_clusters: 1000,
  ui_row_height: "default",
  ui_font_size: "13px",
};

export function SettingsPanel({ onSave }: { onSave: (settings: AppSettings) => void }) {
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);

  const updateSetting = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = () => {
    onSave(settings);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 py-6 px-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Configuration</h1>
        <Button onClick={handleSave}>Save Settings</Button>
      </div>

      <Accordion type="multiple" defaultValue={["ai", "drain", "general"]} className="w-full space-y-4">
        <AccordionItem value="ai" className="border-none bg-transparent">
          <Card>
            <AccordionTrigger className="hover:no-underline px-6 py-4">
              <div className="text-left">
                <CardTitle>AI Provider</CardTitle>
                <CardDescription className="mt-1">Configure the AI model used for cluster analysis.</CardDescription>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-6 pb-6 pt-2">
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="ai_provider">Provider</Label>
                    <Select value={settings.ai_provider} onValueChange={(v) => updateSetting("ai_provider", v)}>
                      <SelectTrigger id="ai_provider">
                        <SelectValue placeholder="Select a provider" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="gemini-cli">Gemini CLI (Local)</SelectItem>
                        <SelectItem value="openai">OpenAI</SelectItem>
                        <SelectItem value="anthropic">Anthropic</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ai_api_key">API Key (if required)</Label>
                    <Input
                      id="ai_api_key"
                      type="password"
                      value={settings.ai_api_key}
                      onChange={(e) => updateSetting("ai_api_key", e.target.value)}
                      placeholder="••••••••••••••••"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="ai_system_prompt">System Prompt</Label>
                    <HelpTooltip content="The system instruction sent to the AI before cluster analysis." />
                  </div>
                  <Textarea
                    id="ai_system_prompt"
                    value={settings.ai_system_prompt}
                    onChange={(e) => updateSetting("ai_system_prompt", e.target.value)}
                    className="h-24 font-mono text-xs"
                  />
                </div>
              </div>
            </AccordionContent>
          </Card>
        </AccordionItem>

        <AccordionItem value="drain" className="border-none bg-transparent">
          <Card>
            <AccordionTrigger className="hover:no-underline px-6 py-4">
              <div className="text-left">
                <CardTitle>Drain3 Engine</CardTitle>
                <CardDescription className="mt-1">Tune the parameters for the streaming log clustering engine.</CardDescription>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-6 pb-6 pt-2">
              <div className="grid grid-cols-3 gap-6">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="drain_sim">Similarity Threshold</Label>
                    <HelpTooltip content="Controls how aggressively logs are grouped. Higher = stricter matching." />
                  </div>
                  <Input
                    id="drain_sim"
                    type="number"
                    step="0.05"
                    min="0"
                    max="1"
                    value={settings.drain_similarity_threshold}
                    onChange={(e) => updateSetting("drain_similarity_threshold", parseFloat(e.target.value))}
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="drain_children">Max Children</Label>
                    <HelpTooltip content="Max branches per node in the parse tree. Increase for very diverse logs." />
                  </div>
                  <Input
                    id="drain_children"
                    type="number"
                    min="1"
                    value={settings.drain_max_children}
                    onChange={(e) => updateSetting("drain_max_children", parseInt(e.target.value, 10))}
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="drain_clusters">Max Clusters</Label>
                    <HelpTooltip content="Cap on total clusters. Prevents memory bloat on huge log sets." />
                  </div>
                  <Input
                    id="drain_clusters"
                    type="number"
                    min="1"
                    value={settings.drain_max_clusters}
                    onChange={(e) => updateSetting("drain_max_clusters", parseInt(e.target.value, 10))}
                  />
                </div>
              </div>
            </AccordionContent>
          </Card>
        </AccordionItem>

        <AccordionItem value="general" className="border-none bg-transparent">
          <Card>
            <AccordionTrigger className="hover:no-underline px-6 py-4">
              <div className="text-left">
                <CardTitle>General UI</CardTitle>
                <CardDescription className="mt-1">Customize the appearance of the application.</CardDescription>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-6 pb-6 pt-2">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="ui_row_height">Log Row Height</Label>
                  <Select value={settings.ui_row_height} onValueChange={(v) => updateSetting("ui_row_height", v)}>
                    <SelectTrigger id="ui_row_height">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="compact">Compact</SelectItem>
                      <SelectItem value="default">Default</SelectItem>
                      <SelectItem value="comfortable">Comfortable</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ui_font_size">Base Font Size</Label>
                  <Select value={settings.ui_font_size} onValueChange={(v) => updateSetting("ui_font_size", v)}>
                    <SelectTrigger id="ui_font_size">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="12px">12px (Small)</SelectItem>
                      <SelectItem value="13px">13px (Default)</SelectItem>
                      <SelectItem value="14px">14px</SelectItem>
                      <SelectItem value="15px">15px</SelectItem>
                      <SelectItem value="16px">16px (Large)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </AccordionContent>
          </Card>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
ORG

# templates
cat << 'TPL' > src/components/templates/AppLayout.tsx
import { ReactNode } from "react";
import { Sidebar, Workspace } from "@/components/organisms/Sidebar";
import { DiagnosticSidebar, DiagnosticData } from "@/components/organisms/DiagnosticSidebar";

interface AppLayoutProps {
  workspaces: Workspace[];
  activeWorkspaceId: string;
  onWorkspaceSelect: (id: string) => void;
  onWorkspaceCreate: () => void;
  onWorkspaceRename?: (id: string, name: string) => void;
  onWorkspaceDelete?: (id: string) => void;
  activeNav: "investigation" | "settings";
  onNavSelect: (nav: "investigation" | "settings") => void;
  children: ReactNode;
  diagnosticOpen: boolean;
  onDiagnosticClose: () => void;
  diagnosticData: DiagnosticData | null;
  diagnosticLoading: boolean;
}

export function AppLayout({
  workspaces,
  activeWorkspaceId,
  onWorkspaceSelect,
  onWorkspaceCreate,
  onWorkspaceRename,
  onWorkspaceDelete,
  activeNav,
  onNavSelect,
  children,
  diagnosticOpen,
  onDiagnosticClose,
  diagnosticData,
  diagnosticLoading,
}: AppLayoutProps) {
  return (
    <div className="flex h-screen w-full bg-bg-base overflow-hidden relative">
      <Sidebar
        workspaces={workspaces}
        activeWorkspaceId={activeWorkspaceId}
        onWorkspaceSelect={onWorkspaceSelect}
        onWorkspaceCreate={onWorkspaceCreate}
        onWorkspaceRename={onWorkspaceRename}
        onWorkspaceDelete={onWorkspaceDelete}
        activeNav={activeNav}
        onNavSelect={onNavSelect}
      />
      <main className="flex-1 flex flex-col min-w-0 relative h-full">
        {children}
      </main>
      <DiagnosticSidebar
        open={diagnosticOpen}
        onClose={onDiagnosticClose}
        data={diagnosticData}
        loading={diagnosticLoading}
      />
    </div>
  );
}
TPL

cat << 'TPL' > src/components/templates/InvestigationLayout.tsx
import { ReactNode } from "react";
import { LogToolbar } from "@/components/organisms/LogToolbar";
import { FilterEntry } from "@/components/molecules/FilterBuilder";
import { HighlightEntry } from "@/components/molecules/HighlightBuilder";

interface InvestigationLayoutProps {
  onSearch: (q: string) => void;
  activeFilters: FilterEntry[];
  onFilterChange: (f: FilterEntry[]) => void;
  activeHighlights: HighlightEntry[];
  onHighlightChange: (h: HighlightEntry[]) => void;
  isWrapping: boolean;
  onWrapToggle: (v: boolean) => void;
  isTailing: boolean;
  onTailToggle: (v: boolean) => void;
  status: boolean;
  children: ReactNode;
}

export function InvestigationLayout({
  onSearch,
  activeFilters,
  onFilterChange,
  activeHighlights,
  onHighlightChange,
  isWrapping,
  onWrapToggle,
  isTailing,
  onTailToggle,
  status,
  children,
}: InvestigationLayoutProps) {
  return (
    <div className="flex flex-col h-full w-full">
      <LogToolbar
        onSearch={onSearch}
        activeFilters={activeFilters}
        onFilterChange={onFilterChange}
        activeHighlights={activeHighlights}
        onHighlightChange={onHighlightChange}
        isWrapping={isWrapping}
        onWrapToggle={onWrapToggle}
        isTailing={isTailing}
        onTailToggle={onTailToggle}
        status={status}
      />
      <div className="flex-1 p-2 min-h-0 bg-bg-surface">
        {children}
      </div>
    </div>
  );
}
TPL

# pages
cat << 'PAGE' > src/components/pages/InvestigationPage.tsx
import { useState, useEffect } from "react";
import { InvestigationLayout } from "@/components/templates/InvestigationLayout";
import { VirtualLogTable } from "@/components/organisms/VirtualLogTable";
import { ImportFeedModal } from "@/components/organisms/ImportFeedModal";
import { useInvestigationStore } from "@/store/investigationStore";
import { useWorkspaceStore } from "@/store/workspaceStore";
import { useSidecarBridge } from "@/lib/hooks/useSidecarBridge";
import { toast } from "sonner";

export function InvestigationPage() {
  const {
    searchQuery,
    setSearchQuery,
    filters,
    setFilters,
    highlights,
    setHighlights,
    logs,
    setLogs,
    isTailing,
    setTailing,
  } = useInvestigationStore();

  const { activeWorkspaceId } = useWorkspaceStore();

  const [isWrapping, setIsWrapping] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isConnected, setIsConnected] = useState(true);

  useEffect(() => {
    if (!activeWorkspaceId) return;

    const fetchLogs = async () => {
      try {
        const result = await useSidecarBridge<any>({
          method: "get_logs",
          params: { workspace_id: activeWorkspaceId, offset: 0, limit: 100 },
        });
        setLogs(result.logs || [], result.total || 0);
      } catch (error) {
        console.error("Failed to fetch logs", error);
        toast.error("Failed to connect to backend");
        setIsConnected(false);
      }
    };

    fetchLogs();
    
    // In a real implementation this would use an interval or websocket/sse for live tail updates
    const interval = setInterval(fetchLogs, 2000);
    return () => clearInterval(interval);

  }, [activeWorkspaceId, setLogs]);

  const handleImportLocal = async (path: string, tail: boolean) => {
    try {
      if (tail) {
        await useSidecarBridge({
          method: "start_tail",
          params: { filepath: path, workspace_id: activeWorkspaceId },
        });
        setTailing(true);
        toast.success(`Started tailing ${path}`);
      } else {
        toast.info("One-time import not yet fully implemented in mock.");
      }
    } catch (e) {
      toast.error("Failed to start tailing.");
    }
  };

  const handleToggleTail = async (tail: boolean) => {
    try {
      if (!tail) {
        await useSidecarBridge({
          method: "stop_tail",
          params: { filepath: "current_path", workspace_id: activeWorkspaceId },
        });
      }
      setTailing(tail);
    } catch (e) {
      toast.error("Failed to toggle tail state.");
    }
  };

  return (
    <>
      <InvestigationLayout
        onSearch={setSearchQuery}
        activeFilters={filters}
        onFilterChange={setFilters}
        activeHighlights={highlights}
        onHighlightChange={setHighlights}
        isWrapping={isWrapping}
        onWrapToggle={setIsWrapping}
        isTailing={isTailing}
        onTailToggle={handleToggleTail}
        status={isConnected}
      >
        <VirtualLogTable
          logs={logs}
          highlights={highlights}
          isWrapping={isWrapping}
          onAddComment={(id, comment) => console.log("Added comment", id, comment)}
        />
      </InvestigationLayout>

      <ImportFeedModal
        open={isImportOpen}
        onOpenChange={setIsImportOpen}
        onImportLocal={handleImportLocal}
        onImportSSH={(host, port, user, pass, path, tail) => toast.info("SSH import requested")}
        onIngestManual={(logs) => toast.info(`Manual ingest requested: ${logs.length} chars`)}
      />
    </>
  );
}
PAGE

cat << 'PAGE' > src/components/pages/SettingsPage.tsx
import { SettingsPanel, AppSettings } from "@/components/organisms/SettingsPanel";
import { toast } from "sonner";
import { useSidecarBridge } from "@/lib/hooks/useSidecarBridge";

export function SettingsPage() {
  const handleSave = async (settings: AppSettings) => {
    try {
      await useSidecarBridge({
        method: "update_settings",
        params: { settings },
      });
      toast.success("Settings saved successfully.");
    } catch (error) {
      toast.error("Failed to save settings.");
    }
  };

  return (
    <div className="flex-1 overflow-auto bg-bg-surface h-full">
      <SettingsPanel onSave={handleSave} />
    </div>
  );
}
PAGE

# stores
cat << 'STORE' > src/store/workspaceStore.ts
import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface Workspace {
  id: string;
  name: string;
  sourceType: "local" | "ssh" | "manual";
  sourcePath: string | null;
  createdAt: Date;
}

interface WorkspaceStore {
  workspaces: Workspace[];
  activeWorkspaceId: string;
  setActive: (id: string) => void;
  addWorkspace: (ws: Omit<Workspace, "createdAt">) => void;
  removeWorkspace: (id: string) => void;
  renameWorkspace: (id: string, name: string) => void;
}

export const useWorkspaceStore = create<WorkspaceStore>()(
  persist(
    (set) => ({
      workspaces: [],
      activeWorkspaceId: "",
      setActive: (id) => set({ activeWorkspaceId: id }),
      addWorkspace: (ws) =>
        set((state) => ({
          workspaces: [...state.workspaces, { ...ws, createdAt: new Date() }],
          activeWorkspaceId: ws.id,
        })),
      removeWorkspace: (id) =>
        set((state) => {
          const newWorkspaces = state.workspaces.filter((w) => w.id !== id);
          return {
            workspaces: newWorkspaces,
            activeWorkspaceId: state.activeWorkspaceId === id ? (newWorkspaces[0]?.id || "") : state.activeWorkspaceId,
          };
        }),
      renameWorkspace: (id, name) =>
        set((state) => ({
          workspaces: state.workspaces.map((w) => (w.id === id ? { ...w, name } : w)),
        })),
    }),
    {
      name: "workspace-storage",
    }
  )
);
STORE

cat << 'STORE' > src/store/investigationStore.ts
import { create } from "zustand";
import { FilterEntry } from "@/components/molecules/FilterBuilder";
import { HighlightEntry } from "@/components/molecules/HighlightBuilder";
import { LogEntry } from "@/components/organisms/VirtualLogTable";

export interface InvestigationStore {
  searchQuery: string;
  filters: FilterEntry[];
  highlights: HighlightEntry[];
  logs: LogEntry[];
  total: number;
  offset: number;
  isTailing: boolean;
  setSearchQuery: (q: string) => void;
  setFilters: (f: FilterEntry[]) => void;
  setHighlights: (h: HighlightEntry[]) => void;
  setLogs: (logs: LogEntry[], total: number) => void;
  setTailing: (v: boolean) => void;
}

export const useInvestigationStore = create<InvestigationStore>((set) => ({
  searchQuery: "",
  filters: [],
  highlights: [],
  logs: [],
  total: 0,
  offset: 0,
  isTailing: false,
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  setFilters: (filters) => set({ filters }),
  setHighlights: (highlights) => set({ highlights }),
  setLogs: (logs, total) => set({ logs, total }),
  setTailing: (isTailing) => set({ isTailing }),
}));
STORE

# App.tsx
cat << 'APP' > src/App.tsx
import { useState, useEffect } from "react";
import { AppLayout } from "@/components/templates/AppLayout";
import { InvestigationPage } from "@/components/pages/InvestigationPage";
import { SettingsPage } from "@/components/pages/SettingsPage";
import { useWorkspaceStore } from "@/store/workspaceStore";
import { Toaster } from "@/components/ui/sonner";

export default function App() {
  const { workspaces, activeWorkspaceId, setActive, addWorkspace, renameWorkspace, removeWorkspace } = useWorkspaceStore();
  const [activeNav, setActiveNav] = useState<"investigation" | "settings">("investigation");

  useEffect(() => {
    if (workspaces.length === 0) {
      addWorkspace({ id: "default-ws", name: "Default Workspace", sourceType: "local", sourcePath: null });
    }
  }, [workspaces, addWorkspace]);

  return (
    <>
      <Toaster theme="dark" position="bottom-right" />
      <AppLayout
        workspaces={workspaces}
        activeWorkspaceId={activeWorkspaceId}
        onWorkspaceSelect={setActive}
        onWorkspaceCreate={() => {
          const name = prompt("Enter workspace name:");
          if (name) {
            addWorkspace({
              id: Math.random().toString(36).substr(2, 9),
              name,
              sourceType: "local",
              sourcePath: null,
            });
          }
        }}
        onWorkspaceRename={renameWorkspace}
        onWorkspaceDelete={removeWorkspace}
        activeNav={activeNav}
        onNavSelect={setActiveNav}
        diagnosticOpen={false}
        onDiagnosticClose={() => {}}
        diagnosticData={null}
        diagnosticLoading={false}
      >
        {activeNav === "investigation" && <InvestigationPage />}
        {activeNav === "settings" && <SettingsPage />}
      </AppLayout>
    </>
  );
}
APP

cat << 'TEST' > src/components/atoms/TailSwitch.test.tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import { TailSwitch } from "./TailSwitch";

test("renders TailSwitch and responds to clicks", () => {
  const handleChange = vi.fn();
  render(<TailSwitch checked={false} onCheckedChange={handleChange} />);
  
  const label = screen.getByText("Live Tail");
  expect(label).toBeInTheDocument();

  const switchRole = screen.getByRole("switch");
  expect(switchRole).not.toBeChecked();

  fireEvent.click(switchRole);
  expect(handleChange).toHaveBeenCalledWith(true, expect.anything());
});
TEST
