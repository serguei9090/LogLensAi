import { type DiagnosticData, DiagnosticSidebar } from "@/components/organisms/DiagnosticSidebar";
import { Sidebar } from "@/components/organisms/Sidebar";
import type { Workspace } from "@/store/workspaceStore";
import type { ReactNode } from "react";

interface AppLayoutProps {
  readonly workspaces: readonly Workspace[];
  readonly activeWorkspaceId: string;
  readonly onWorkspaceSelect: (id: string) => void;
  readonly onWorkspaceCreate: (name: string) => void;
  readonly onWorkspaceRename?: (id: string, name: string) => void;
  readonly onWorkspaceDelete?: (id: string) => void;
  readonly activeNav: "investigation" | "settings";
  readonly onNavSelect: (nav: "investigation" | "settings") => void;
  readonly children: ReactNode;
  readonly diagnosticOpen: boolean;
  readonly onDiagnosticClose: () => void;
  readonly diagnosticData: DiagnosticData | null;
  readonly diagnosticLoading: boolean;
}

import { useUIStore } from "@/store/uiStore";
import { useEffect } from "react";

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
  const { toggleSidebar } = useUIStore();

  // Keyboard shortcut: Ctrl + \
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === "\\") {
        e.preventDefault();
        toggleSidebar();
      }
    };
    globalThis.addEventListener("keydown", handleKeyDown);
    return () => globalThis.removeEventListener("keydown", handleKeyDown);
  }, [toggleSidebar]);

  return (
    <div className="flex h-screen w-full bg-[#0a0c0b] overflow-hidden relative font-sans">
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
      <main className="flex-1 flex flex-col min-w-0 relative h-full bg-[#0d0f0e]">
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
