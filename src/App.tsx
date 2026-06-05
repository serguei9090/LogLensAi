import { useCallback, useEffect, useRef, useState } from "react";
import { CommandPalette } from "@/components/organisms/CommandPalette";
import { SystemDiagnosticConsole } from "@/components/organisms/SystemDiagnosticConsole";
import DashboardPage from "@/components/pages/DashboardPage";
import { InvestigationPage } from "@/components/pages/InvestigationPage";
import { SettingsPage } from "@/components/pages/SettingsPage";
import { AppLayout } from "@/components/templates/AppLayout";
import { Toaster } from "@/components/ui/sonner";
import { useHealthStatus } from "@/lib/hooks/useHealthStatus";
import { useKeyboardShortcuts } from "@/lib/hooks/useKeyboardShortcuts";
import { useAiStore } from "@/store/aiStore";
import { useDebugStore } from "@/store/debugStore";
import { useSettingsStore } from "@/store/settingsStore";
import { useUIStore } from "@/store/uiStore";
import { useWorkspaceStore } from "@/store/workspaceStore";

export type NavTab = "investigation" | "settings" | "dashboard";

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
        {activeNav === "dashboard" && <DashboardPage />}
        {activeNav === "investigation" && <InvestigationPage />}
        {activeNav === "settings" && <SettingsPage />}
      </AppLayout>
    </>
  );
}
