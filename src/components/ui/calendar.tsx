"use client";

import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import type * as React from "react";
import { DayPicker, getDefaultClassNames } from "react-day-picker";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

/**
 * shadcn/ui Calendar built on react-day-picker v9.
 *
 * Supports `captionLayout="dropdown"` for the modern Month | Year selector
 * pattern. Dropdowns are styled to respect the LogLensAi dark theme CSS tokens
 * and do NOT use native <select> elements (see UIReviewProtocol §4).
 */
function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  captionLayout = "label",
  ...props
}: CalendarProps) {
  const defaultClassNames = getDefaultClassNames();

  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      captionLayout={captionLayout}
      className={cn("p-3 [--cell-size:2.25rem]", className)}
      classNames={{
        root: cn("w-fit", defaultClassNames.root),
        months: cn("flex flex-col", defaultClassNames.months),
        month: cn("flex flex-col gap-4", defaultClassNames.month),
        month_caption: cn(
          "relative flex h-[--cell-size] items-center justify-center px-[--cell-size]",
          defaultClassNames.month_caption,
        ),
        nav: cn(
          "absolute inset-x-0 top-0 flex w-full items-center justify-between",
          defaultClassNames.nav,
        ),
        button_previous: cn(
          buttonVariants({ variant: "ghost" }),
          "size-[--cell-size] p-0 opacity-60 hover:opacity-100 aria-disabled:opacity-30",
          defaultClassNames.button_previous,
        ),
        button_next: cn(
          buttonVariants({ variant: "ghost" }),
          "size-[--cell-size] p-0 opacity-60 hover:opacity-100 aria-disabled:opacity-30",
          defaultClassNames.button_next,
        ),
        // Dropdown caption layout
        dropdowns: cn(
          "flex h-[--cell-size] w-full items-center justify-center gap-1 text-sm font-semibold",
          defaultClassNames.dropdowns,
        ),
        dropdown_root: cn("relative rounded-md", defaultClassNames.dropdown_root),
        // The native <select> is made invisible; the visual is rendered via caption_label
        dropdown: cn("absolute inset-0 cursor-pointer opacity-0", defaultClassNames.dropdown),
        caption_label: cn(
          captionLayout === "label"
            ? "text-sm font-semibold"
            : // Dropdown mode: looks like a styled button
              [
                "flex h-8 cursor-pointer items-center gap-1 rounded-md px-2 py-1 text-sm font-semibold",
                "text-text-primary hover:bg-white/10 hover:text-primary transition-colors",
                "[&>svg]:size-3 [&>svg]:text-text-muted",
              ].join(" "),
          defaultClassNames.caption_label,
        ),
        // Day grid
        month_grid: cn("w-full border-collapse", defaultClassNames.month_grid),
        weekdays: cn("flex", defaultClassNames.weekdays),
        weekday: cn(
          "w-[--cell-size] text-center font-normal text-[0.75rem] text-text-muted uppercase tracking-wider select-none",
          defaultClassNames.weekday,
        ),
        week: cn("mt-1 flex w-full", defaultClassNames.week),
        day: cn(
          "group/day relative aspect-square h-full w-full p-0 text-center select-none",
          defaultClassNames.day,
        ),
        day_button: cn(
          buttonVariants({ variant: "ghost" }),
          "size-[--cell-size] p-0 font-normal aria-selected:opacity-100",
          defaultClassNames.day_button,
        ),
        range_start: cn("rounded-l-full bg-primary/20", defaultClassNames.range_start),
        range_end: cn("rounded-r-full bg-primary/20", defaultClassNames.range_end),
        range_middle: cn(
          "bg-primary/10 [&>button]:rounded-none [&>button]:text-primary",
          defaultClassNames.range_middle,
        ),
        selected: cn(
          "[&>button]:bg-primary [&>button]:text-text-inverse [&>button]:rounded-full [&>button]:font-bold",
          defaultClassNames.selected,
        ),
        today: cn("[&>button]:ring-1 [&>button]:ring-primary/50", defaultClassNames.today),
        outside: cn("opacity-30", defaultClassNames.outside),
        disabled: cn("opacity-20 cursor-not-allowed", defaultClassNames.disabled),
        hidden: "invisible",
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation, className: cls, ...rest }) => {
          if (orientation === "left") {
            return <ChevronLeft className={cn("size-4", cls)} {...rest} />;
          }
          if (orientation === "right") {
            return <ChevronRight className={cn("size-4", cls)} {...rest} />;
          }
          // Used inside the dropdown caption_label
          return <ChevronDown className={cn("size-3.5", cls)} {...rest} />;
        },
      }}
      {...props}
    />
  );
}
Calendar.displayName = "Calendar";

export { Calendar };
