import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAiStore } from "@/store/aiStore";
import { useUIStore } from "@/store/uiStore";
import { useWorkspaceStore } from "@/store/workspaceStore";
import {
  Database,
  LayoutDashboard,
  PanelRight,
  PlusCircle,
  RotateCcw,
  Search,
  Settings,
  Sidebar,
  XCircle,
} from "lucide-react";
import { useMemo, useState } from "react";

interface CommandPaletteProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly onNavSelect: (nav: "investigation" | "settings" | "dashboard") => void;
}

export function CommandPalette({ open, onOpenChange, onNavSelect }: CommandPaletteProps) {
  const { toggleSidebar, toggleFacetSidebar } = useUIStore();
  const { setSidebarOpen: setAiSidebarOpen } = useAiStore();
  const { addWorkspace } = useWorkspaceStore();
  const [search, setSearch] = useState("");

  const commands = useMemo(
    () => [
      {
        group: "Navigation",
        items: [
          {
            icon: LayoutDashboard,
            label: "Go to Dashboard",
            action: () => onNavSelect("dashboard"),
            shortcut: "G D",
          },
          {
            icon: Database,
            label: "Go to Investigation",
            action: () => onNavSelect("investigation"),
            shortcut: "G I",
          },
          {
            icon: Settings,
            label: "Go to Settings",
            action: () => onNavSelect("settings"),
            shortcut: "G S",
          },
        ],
      },
      {
        group: "Actions",
        items: [
          {
            icon: Sidebar,
            label: "Toggle Main Sidebar",
            action: () => toggleSidebar(),
            shortcut: "Ctrl+\\",
          },
          {
            icon: PanelRight,
            label: "Toggle AI Investigation",
            action: () => setAiSidebarOpen(true),
            shortcut: "Ctrl+J",
          },
          {
            icon: PanelRight,
            label: "Toggle Facet Sidebar",
            action: () => toggleFacetSidebar(),
            shortcut: "Ctrl+F",
          },
          {
            icon: PlusCircle,
            label: "New Workspace",
            action: () => addWorkspace({ id: `ws-${Date.now()}`, name: "New Workspace" }),
            shortcut: "Ctrl+N",
          },
        ],
      },
      {
        group: "Investigation",
        items: [
          {
            icon: RotateCcw,
            label: "Refresh Current Logs",
            action: () => window.dispatchEvent(new CustomEvent("loglens:refresh-logs")),
            shortcut: "R",
          },
          {
            icon: XCircle,
            label: "Clear Filters & Search",
            action: () => window.dispatchEvent(new CustomEvent("loglens:clear-filters")),
            shortcut: "Esc",
          },
        ],
      },
    ],
    [onNavSelect, toggleSidebar, toggleFacetSidebar, setAiSidebarOpen, addWorkspace],
  );

  const filteredGroups = useMemo(() => {
    if (!search) {
      return commands;
    }
    return commands
      .map((group) => ({
        ...group,
        items: group.items.filter((item) =>
          item.label.toLowerCase().includes(search.toLowerCase()),
        ),
      }))
      .filter((group) => group.items.length > 0);
  }, [search, commands]);

  const handleAction = (action: () => void) => {
    action();
    onOpenChange(false);
    setSearch("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl bg-zinc-950/90 border-zinc-800/60 backdrop-blur-xl p-0 overflow-hidden outline-none">
        <DialogHeader className="p-4 border-b border-zinc-800/40">
          <DialogTitle className="sr-only">Command Palette</DialogTitle>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-zinc-500" />
            <Input
              autoFocus
              placeholder="Type a command or search..."
              className="bg-transparent border-none focus-visible:ring-0 pl-10 h-12 text-base text-zinc-200"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && filteredGroups[0]?.items[0]) {
                  handleAction(filteredGroups[0].items[0].action);
                }
              }}
            />
          </div>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh]">
          {filteredGroups.length === 0 ? (
            <div className="p-8 text-center text-zinc-500 text-sm italic">
              No matching commands found.
            </div>
          ) : (
            <div className="p-2 space-y-4">
              {filteredGroups.map((group) => (
                <div key={group.group}>
                  <h3 className="px-3 mb-2 text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                    {group.group}
                  </h3>
                  <div className="space-y-1">
                    {group.items.map((item) => (
                      <button
                        type="button"
                        key={item.label}
                        className="w-full flex items-center justify-between p-2.5 rounded-lg transition-all cursor-pointer hover:bg-white/5 border border-transparent hover:border-zinc-800 focus-visible:bg-white/5 focus-visible:border-zinc-700 outline-none group"
                        onClick={() => handleAction(item.action)}
                      >
                        <div className="flex items-center gap-3">
                          <item.icon className="size-4 text-zinc-400 group-hover:text-emerald-400" />
                          <span className="text-sm text-zinc-300 group-hover:text-zinc-100 font-medium">
                            {item.label}
                          </span>
                        </div>
                        {item.shortcut && (
                          <div className="flex items-center gap-1">
                            {item.shortcut.split(" ").map((k) => (
                              <kbd
                                key={k}
                                className="px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-[10px] text-zinc-500 font-mono"
                              >
                                {k}
                              </kbd>
                            ))}
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        <div className="p-3 border-t border-zinc-800/40 bg-zinc-900/20 flex justify-between items-center text-[10px] text-zinc-500">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5">
              <kbd className="px-1 rounded bg-zinc-800 border border-zinc-700">↵</kbd> select
            </span>
            <span className="flex items-center gap-1.5">
              <kbd className="px-1 rounded bg-zinc-800 border border-zinc-700">↑↓</kbd> navigate
            </span>
          </div>
          <span className="font-mono text-zinc-600">COMMAND PALETTE</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
