import { CommandPalette } from "@/components/organisms/CommandPalette";
import DashboardPage from "@/components/pages/DashboardPage";
import { InvestigationPage } from "@/components/pages/InvestigationPage";
import { SettingsPage } from "@/components/pages/SettingsPage";
import { AppLayout } from "@/components/templates/AppLayout";
import { Toaster } from "@/components/ui/sonner";
import { useKeyboardShortcuts } from "@/lib/hooks/useKeyboardShortcuts";
import { useAiStore } from "@/store/aiStore";
import { useUIStore } from "@/store/uiStore";
import { useWorkspaceStore } from "@/store/workspaceStore";
import { useCallback, useEffect, useRef, useState } from "react";

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
  const [activeNav, setActiveNav] = useState<NavTab>("investigation");
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);

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

  const handleNavSelect = useCallback((nav: NavTab) => {
    setActiveNav(nav);
  }, []);

  // Register Global Shortcuts
  useKeyboardShortcuts([
    {
      key: "k",
      ctrl: true,
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

  return (
    <>
      <Toaster theme="dark" position="top-center" />
      <CommandPalette
        open={commandPaletteOpen}
        onOpenChange={setCommandPaletteOpen}
        onNavSelect={handleNavSelect}
      />
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
