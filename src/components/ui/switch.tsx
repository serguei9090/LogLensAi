"use client";

import { Switch as SwitchPrimitive } from "@base-ui/react/switch";

import { cn } from "@/lib/utils";

function Switch({
  className,
  size = "default",
  ...props
}: SwitchPrimitive.Root.Props & {
  size?: "sm" | "default";
}) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      data-size={size}
      className={cn(
        "peer group/switch relative inline-flex shrink-0 items-center rounded-full border border-transparent transition-all outline-none after:absolute after:-inset-x-3 after:-inset-y-2 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 active:scale-95",
        "h-[18.4px] w-[32px]", // Default size as fallback
        size === "sm" && "h-[14px] w-[24px]",
        "bg-white/10 data-[checked]:bg-primary", // Standard Base UI data attributes
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          "pointer-events-none block rounded-full bg-white ring-0 transition-transform",
          "size-4 group-data-[checked]/switch:translate-x-[14px]", // Manual translate for 32px width
          size === "sm" && "size-3 group-data-[checked]/switch:translate-x-[10px]",
        )}
      />
    </SwitchPrimitive.Root>
  );
}

export { Switch };
