import type { NavTab } from "@/App";
import { type DiagnosticData, DiagnosticSidebar } from "@/components/organisms/DiagnosticSidebar";
import { Sidebar } from "@/components/organisms/Sidebar";
import type { Workspace } from "@/store/workspaceStore";
import { useWorkspaceStore } from "@/store/workspaceStore";
import {
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { restrictToWindowEdges } from "@dnd-kit/modifiers";
import type { ReactNode } from "react";

interface AppLayoutProps {
  readonly workspaces: readonly Workspace[];
  readonly activeWorkspaceId: string;
  readonly onWorkspaceSelect: (id: string) => void;
  readonly onWorkspaceCreate: (name: string) => void;
  readonly onWorkspaceRename?: (id: string, name: string) => void;
  readonly onWorkspaceDelete?: (id: string) => void;
  readonly activeNav: NavTab;
  readonly onNavSelect: (nav: NavTab) => void;
  readonly children: ReactNode;
  readonly diagnosticOpen: boolean;
  readonly onDiagnosticClose: () => void;
  readonly diagnosticData: DiagnosticData | null;
  readonly diagnosticLoading: boolean;
  readonly activeFolderId?: string | null;
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
  activeFolderId,
}: AppLayoutProps) {
  const moveSource = useWorkspaceStore((state) => state.moveSource);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 8px movement required to start dragging, fixes click issues
      },
    }),
    useSensor(KeyboardSensor),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over) {
      const sourceId = active.id as string;
      const targetFolderId = over.id === "root" ? null : (over.id as string);
      moveSource(sourceId, targetFolderId);
    }
  };

  return (
    <DndContext sensors={sensors} modifiers={[restrictToWindowEdges]} onDragEnd={handleDragEnd}>
      <div className="flex h-screen w-full bg-bg-app overflow-hidden relative font-sans">
        <Sidebar
          workspaces={workspaces}
          activeWorkspaceId={activeWorkspaceId}
          onWorkspaceSelect={onWorkspaceSelect}
          onWorkspaceCreate={onWorkspaceCreate}
          onWorkspaceRename={onWorkspaceRename}
          onWorkspaceDelete={onWorkspaceDelete}
          activeNav={activeNav}
          onNavSelect={onNavSelect}
          activeFolderId={activeFolderId}
        />
        <main className="flex-1 flex flex-col min-w-0 relative h-full bg-bg-base">{children}</main>
        <DiagnosticSidebar
          open={diagnosticOpen}
          onClose={onDiagnosticClose}
          data={diagnosticData}
          loading={diagnosticLoading}
        />
      </div>
    </DndContext>
  );
}
