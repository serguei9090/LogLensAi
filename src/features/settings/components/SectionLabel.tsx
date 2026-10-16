import type * as React from "react";

export function SectionLabel({
  children,
  htmlFor,
}: {
  readonly children: React.ReactNode;
  readonly htmlFor?: string;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className="block text-xs font-bold uppercase tracking-widest text-text-muted mb-2 ml-0.5 select-none"
    >
      {children}
    </label>
  );
}
