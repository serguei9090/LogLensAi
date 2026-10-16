import { Activity, Code, FolderOpen, Server } from "lucide-react";
import type { TabOption } from "./types";

export const isTauri =
  globalThis.window !== undefined && "__TAURI_INTERNALS__" in globalThis.window;

export const TABS: TabOption[] = [
  { id: "local", icon: FolderOpen, label: "Files" },
  { id: "ssh", icon: Server, label: "SSH" },
  { id: "manual", icon: Code, label: "Manual" },
  { id: "live", icon: Activity, label: "Live" },
];

export const inputCls =
  "w-full h-10 px-4 rounded-xl text-sm bg-bg-surface border border-border text-text-primary placeholder:text-text-muted/30 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all font-sans";

export const labelCls =
  "text-xs font-bold uppercase tracking-wider text-text-muted mb-2 ml-1 block";
