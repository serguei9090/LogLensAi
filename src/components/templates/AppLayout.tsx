import { type DiagnosticData, DiagnosticSidebar } from "@/components/organisms/DiagnosticSidebar";
import { Sidebar } from "@/components/organisms/Sidebar";
import type { Workspace } from "@/store/workspaceStore";
import type { ReactNode } from "react";

interface AppLayoutProps {
  workspaces: Workspace[];
  activeWorkspaceId: string;
  onWorkspaceSelect: (id: string) => void;
  onWorkspaceCreate: (name: string) => void;
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
      <main className="flex-1 flex flex-col min-w-0 relative h-full">{children}</main>
      <DiagnosticSidebar
        open={diagnosticOpen}
        onClose={onDiagnosticClose}
        data={diagnosticData}
        loading={diagnosticLoading}
      />
    </div>
  );
}
