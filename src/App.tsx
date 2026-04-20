import { useEffect, useRef, useState } from "react";
import DashboardPage from "@/components/pages/DashboardPage";
import { InvestigationPage } from "@/components/pages/InvestigationPage";
import { SettingsPage } from "@/components/pages/SettingsPage";
import { AppLayout } from "@/components/templates/AppLayout";
import { Toaster } from "@/components/ui/sonner";
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
  const [activeNav, setActiveNav] = useState<NavTab>("investigation");
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

  return (
    <>
      <Toaster theme="dark" position="top-center" />
      <AppLayout
        workspaces={workspaces}
        activeWorkspaceId={activeWorkspaceId}
        onWorkspaceSelect={(id) => {
          setActive(id);
          setActiveNav("investigation");
        }}
        onWorkspaceCreate={(name) => addWorkspace({ id: `ws-${Date.now()}`, name })}
        onWorkspaceRename={renameWorkspace}
        onWorkspaceDelete={removeWorkspace}
        activeNav={activeNav}
        onNavSelect={setActiveNav}
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
