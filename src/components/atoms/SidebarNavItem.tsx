import type React from "react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export interface SidebarNavItemProps {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  collapsed: boolean;
  onClick?: () => void;
  disabled?: boolean;
  badge?: string;
  className?: string;
}

export function SidebarNavItem({
  icon,
  label,
  active,
  collapsed,
  onClick,
  disabled,
  badge,
  className,
}: Readonly<SidebarNavItemProps>) {
  const navContent = (
    <Button
      type="button"
      variant="ghost"
      disabled={disabled || active}
      onClick={disabled ? undefined : onClick}
      className={cn(
        "flex items-center px-3 py-2.5 text-[13px] rounded-md transition-all text-left outline-none overflow-hidden border-none bg-transparent w-full h-auto",
        active
          ? "bg-primary/10 text-primary font-medium border border-primary/20 cursor-default"
          : "text-text-secondary hover:bg-bg-hover hover:text-text-primary cursor-pointer",
        disabled && "opacity-40 cursor-not-allowed",
        collapsed ? "justify-center" : "gap-3",
        className,
      )}
    >
      <span className="shrink-0">{icon}</span>
      {!collapsed && <span className="flex-1 whitespace-nowrap truncate">{label}</span>}
      {!collapsed && badge && (
        <span className="ml-auto text-[8px] bg-bg-surface-bright text-text-muted border border-border px-1 rounded">
          {badge}
        </span>
      )}
    </Button>
  );

  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger className="w-full">{navContent}</TooltipTrigger>
        <TooltipContent
          side="right"
          className="bg-bg-surface-bright border-border text-text-primary"
        >
          {label} {badge && `(${badge})`}
        </TooltipContent>
      </Tooltip>
    );
  }

  return navContent;
}
