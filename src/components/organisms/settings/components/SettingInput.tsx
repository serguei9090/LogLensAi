import { cn } from "@/lib/utils";
import * as React from "react";

export function SettingInput(
  props: Readonly<React.InputHTMLAttributes<HTMLInputElement>>,
) {
  return (
    <input
      {...props}
      className={cn(
        "w-full h-10 px-4 rounded-xl text-sm bg-bg-surface border border-border text-text-primary placeholder:text-text-muted/30",
        "focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all",
        props.className,
      )}
    />
  );
}
