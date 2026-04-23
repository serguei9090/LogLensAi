import { cn } from "@/lib/utils";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import type { ReactNode } from "react";

interface DraggableItemProps {
  readonly id: string;
  readonly children: ReactNode;
  readonly className?: string;
  readonly style?: React.CSSProperties;
  readonly disabled?: boolean;
}

export function DraggableItem({
  id,
  children,
  className,
  style: customStyle,
  disabled,
}: DraggableItemProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id,
    disabled,
  });

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
        zIndex: 100,
        ...customStyle,
      }
    : customStyle;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={cn("touch-none", isDragging && "opacity-50 grayscale", className)}
    >
      {children}
    </div>
  );
}

interface DroppableAreaProps {
  readonly id: string;
  readonly children: ReactNode;
  readonly className?: string;
  readonly activeClassName?: string;
}

export function DroppableArea({ id, children, className, activeClassName }: DroppableAreaProps) {
  const { isOver, setNodeRef } = useDroppable({
    id,
  });

  return (
    <div ref={setNodeRef} className={cn(className, isOver && activeClassName)}>
      {children}
    </div>
  );
}
