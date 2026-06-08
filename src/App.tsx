import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { CommandPalette } from "@/components/organisms/CommandPalette";
import { SystemDiagnosticConsole } from "@/components/organisms/SystemDiagnosticConsole";
import { AppLayout } from "@/components/templates/AppLayout";

const DashboardPage = lazy(() => import("@/components/pages/DashboardPage"));
const InvestigationPage = lazy(() =>
  import("@/components/pages/InvestigationPage").then((module) => ({
    default: module.InvestigationPage,
  })),
);
const SettingsPage = lazy(() =>
  import("@/components/pages/SettingsPage").then((module) => ({
    default: module.SettingsPage,
  })),
);

import { Toaster } from "@/components/ui/sonner";
import { useHealthStatus } from "@/lib/hooks/useHealthStatus";
import { useKeyboardShortcuts } from "@/lib/hooks/useKeyboardShortcuts";
import { useAiStore } from "@/store/aiStore";
import { useDebugStore } from "@/store/debugStore";
import { useSettingsStore } from "@/store/settingsStore";
import { useUIStore } from "@/store/uiStore";
import { useWorkspaceStore } from "@/store/workspaceStore";

export type NavTab = "investigation" | "settings" | "dashboard";

function PageLoader() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center min-h-[400px] h-full w-full bg-bg-base/20 backdrop-blur-sm select-none animate-in fade-in duration-500">
      <div className="relative flex flex-col items-center gap-4 p-8 rounded-2xl bg-bg-surface/50 border border-border-muted/50 max-w-sm w-full shadow-2xl">
        <div className="relative">
          <div className="absolute -inset-2 bg-primary/20 rounded-full blur-xl animate-pulse" />
          <div className="relative w-10 h-10 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
        </div>
        <div className="space-y-1 text-center">
          <h3 className="text-xs font-bold font-mono tracking-widest text-primary uppercase animate-pulse-slow">
            Initializing Module
          </h3>
          <p className="text-[11px] text-text-muted">Loading dependencies...</p>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const {
    workspaces,
    activeWorkspaceId,
    setActive,
    addWorkspace,
    renameWorkspace,
    removeWorkspace,
  } = useWorkspaceStore();
  const { toggleSidebar, toggleFacetSidebar } = useUIStore();
  const { setSidebarOpen: setAiSidebarOpen } = useAiStore();
  const { settings, fetchSettings } = useSettingsStore();
  const [activeNav, setActiveNav] = useState<NavTab>("dashboard");
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);

  // Global Health Monitoring
  useHealthStatus();

  // Load settings on mount
  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  // Global resize listener to temporarily disable all animations/transitions during window resizing
  useEffect(() => {
    let resizeTimer: any;
    const handleResize = () => {
      document.body.classList.add("is-resizing");
      globalThis.clearTimeout(resizeTimer);
      resizeTimer = globalThis.setTimeout(() => {
        document.body.classList.remove("is-resizing");
      }, 150);
    };

    globalThis.addEventListener("resize", handleResize);
    return () => {
      globalThis.removeEventListener("resize", handleResize);
      globalThis.clearTimeout(resizeTimer);
    };
  }, []);

  // Guard against StrictMode double-fire adding two default workspaces
  const seededRef = useRef(false);

  useEffect(() => {
    if (seededRef.current) {
      return;
    }
    if (workspaces.length === 0) {
      seededRef.current = true;
      addWorkspace({ id: "default-ws", name: "Default Workspace" });
    } else {
      seededRef.current = true;
    }
  }, [workspaces.length, addWorkspace]);

  const handleNavSelect = useCallback(
    (nav: NavTab) => {
      setActiveNav(nav);
      if (nav !== "investigation") {
        setActive("");
      }
    },
    [setActive],
  );

  // Register Global Shortcuts
  useKeyboardShortcuts([
    {
      ...settings.ui_command_palette_shortcut,
      description: "Open Command Palette",
      handler: () => setCommandPaletteOpen(true),
    },
    {
      key: "b",
      ctrl: true,
      description: "Toggle Main Sidebar",
      handler: () => toggleSidebar(),
    },
    {
      key: "j",
      ctrl: true,
      description: "Toggle AI Investigation",
      handler: () => setAiSidebarOpen(true),
    },
    {
      key: "f",
      ctrl: true,
      description: "Toggle Facet Sidebar",
      handler: () => toggleFacetSidebar(),
    },
  ]);

  const activeWorkspace = workspaces.find((w) => w.id === activeWorkspaceId);

  // Global Tauri Event Listener for Debugging
  useEffect(() => {
    if (import.meta.env.VITE_DEBUG_GUI !== "true") {
      return;
    }

    let unlisten: (() => void) | undefined;

    async function setupListeners() {
      try {
        const { listen } = await import("@tauri-apps/api/event");
        // Fix: Use a valid event name (alphanumeric and :/_-)
        unlisten = await listen("sidecar_log", (event) => {
          useDebugStore.getState().addLog({
            level: "info",
            source: "sidecar",
            message: String(event.payload),
          });
        });

        useDebugStore.getState().addLog({
          level: "info",
          source: "system",
          message: "Tauri Event Listeners initialized",
        });
      } catch (err) {
        console.error("Failed to setup Tauri listeners:", err);
      }
    }

    setupListeners();
    return () => {
      if (unlisten) {
        unlisten();
      }
    };
  }, []);

  return (
    <>
      <Toaster theme="dark" position="top-center" />
      <CommandPalette
        open={commandPaletteOpen}
        onOpenChange={setCommandPaletteOpen}
        onNavSelect={handleNavSelect}
      />
      <SystemDiagnosticConsole />
      <AppLayout
        workspaces={workspaces}
        activeWorkspaceId={activeWorkspaceId}
        activeFolderId={activeWorkspace?.activeFolderId}
        onWorkspaceSelect={(id) => {
          setActive(id);
          setActiveNav("investigation");
        }}
        onWorkspaceCreate={(name) => addWorkspace({ id: `ws-${Date.now()}`, name })}
        onWorkspaceRename={renameWorkspace}
        onWorkspaceDelete={removeWorkspace}
        activeNav={activeNav}
        onNavSelect={handleNavSelect}
        diagnosticOpen={false}
        onDiagnosticClose={() => {}}
        diagnosticData={null}
        diagnosticLoading={false}
      >
        <Suspense fallback={<PageLoader />}>
          {activeNav === "dashboard" && <DashboardPage />}
          {activeNav === "investigation" && <InvestigationPage />}
          {activeNav === "settings" && <SettingsPage />}
        </Suspense>
      </AppLayout>
    </>
  );
}
