import { InvestigationPage } from "@/components/pages/InvestigationPage";
import { SettingsPage } from "@/components/pages/SettingsPage";
import { AppLayout } from "@/components/templates/AppLayout";
import { Toaster } from "@/components/ui/sonner";
import { useWorkspaceStore } from "@/store/workspaceStore";
import { useEffect, useRef, useState } from "react";

export default function App() {
  const {
    workspaces,
    activeWorkspaceId,
    setActive,
    addWorkspace,
    renameWorkspace,
    removeWorkspace,
  } = useWorkspaceStore();
  const [activeNav, setActiveNav] = useState<"investigation" | "settings">("investigation");
  // Guard against StrictMode double-fire adding two default workspaces
  const seededRef = useRef(false);

  useEffect(() => {
    if (seededRef.current) return;
    if (workspaces.length === 0) {
      seededRef.current = true;
      addWorkspace({ id: "default-ws", name: "Default Workspace" });
    } else {
      seededRef.current = true;
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <Toaster theme="dark" position="top-center" />
      <AppLayout
        workspaces={workspaces}
        activeWorkspaceId={activeWorkspaceId}
        onWorkspaceSelect={setActive}
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
        {activeNav === "investigation" && <InvestigationPage />}
        {activeNav === "settings" && <SettingsPage />}
      </AppLayout>
    </>
  );
}
