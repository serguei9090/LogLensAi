// Assume Role: Frontend Engineer (@frontend)

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
import type { NavTab } from "@/App";
import { type DiagnosticData, DiagnosticSidebar } from "@/components/organisms/DiagnosticSidebar";
import { Sidebar } from "@/components/organisms/Sidebar";
import type { Workspace } from "@/store/workspaceStore";
import { useWorkspaceStore } from "@/store/workspaceStore";

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

class CustomPointerSensor extends PointerSensor {
  static activators = [
    {
      eventName: "onPointerDown" as const,
      handler: ({ nativeEvent }: { nativeEvent: PointerEvent }) => {
        let target = nativeEvent.target as HTMLElement | null;
        while (target) {
          if (["BUTTON", "INPUT", "TEXTAREA", "SELECT", "OPTION"].includes(target.tagName)) {
            return false;
          }
          target = target.parentElement;
        }
        return true;
      },
    },
  ];
}

const POINTER_SENSOR_OPTIONS = {
  activationConstraint: {
    distance: 10,
  },
};

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

  const pointerSensor = useSensor(CustomPointerSensor, POINTER_SENSOR_OPTIONS);
  const keyboardSensor = useSensor(KeyboardSensor);
  const sensors = useSensors(pointerSensor, keyboardSensor);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over) {
      const sourceId = (active.id as string).replace(/^(sidebar-source-|explorer-source-)/, "");
      const rawOverId = over.id as string;
      const targetFolderId =
        rawOverId === "root" || rawOverId === "sidebar-folder-root"
          ? null
          : rawOverId.replace(/^(sidebar-folder-|explorer-folder-)/, "");

      moveSource(sourceId, targetFolderId);
    }
  };

  return (
    <DndContext sensors={sensors} modifiers={[restrictToWindowEdges]} onDragEnd={handleDragEnd}>
      {/* OPTIMIZATION 1: Force Hardware acceleration context across the application frame */}
      <div 
        className="flex h-screen w-full bg-bg-app overflow-hidden relative font-sans"
        style={{
          transform: "translate3d(0,0,0)",
          backfaceVisibility: "hidden",
          willChange: "transform"
        }}
      >
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
        
        {/* OPTIMIZATION 2: Apply layout boundaries specifically targeting sub-renders (Charts & Logs) */}
        <main 
          className="flex-1 flex flex-col min-w-0 relative h-full bg-bg-base"
          style={{
            transform: "translate3d(0,0,0)",
            backfaceVisibility: "hidden",
            contain: "strict" // Prevents child chart calculations from forcing tree-wide paint updates
          }}
        >
          {children}
        </main>

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