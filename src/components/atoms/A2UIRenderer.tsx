import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type React from "react";

interface A2UIComponent {
  type: string;
  text?: string;
  label?: string;
  children?: A2UIComponent[];
  props?: Record<string, unknown>;
  action?: {
    type: string;
    [key: string]: unknown;
  };
}

interface A2UIRendererProps {
  payload: unknown;
  onAction?: (action: unknown) => void;
}

/**
 * Simple parser for A2UI Markup format (e.g. button label="Text" action={...})
 * Returns a JSON object compatible with the standard renderer.
 */
function parseA2UIMarkup(raw: string): A2UIComponent | null {
  const trimmed = raw.trim();

  // Handle Button Tag: button label="Text" action={...}
  if (trimmed.startsWith("button")) {
    const labelMatch = /label=["']([^"']+)["']/.exec(trimmed);
    const actionMatch = /action=\{([^}]+)\}/.exec(trimmed);

    if (labelMatch) {
      let action: { type: string; [key: string]: unknown } | undefined;
      if (actionMatch) {
        try {
          // Wrapped in {} to make it valid JSON
          action = JSON.parse(`{${actionMatch[1]}}`);
        } catch (e) {
          console.warn("Failed to parse action JSON in A2UI markup:", e);
        }
      }

      return {
        type: "button",
        label: labelMatch[1],
        action,
      };
    }
  }

  // Handle Text Tag: text value="..."
  if (trimmed.startsWith("text")) {
    const textMatch = /value=["']([^"']+)["']/.exec(trimmed);
    if (textMatch) {
      return {
        type: "text",
        text: textMatch[1],
      };
    }
  }

  return null;
}

/**
 * A2UIRenderer maps A2UI v0.9 specific primitives to project-standard shadcn/ui components.
 * Supports both standard JSON payloads and the compact Markup format.
 */
export const A2UIRenderer: React.FC<A2UIRendererProps> = ({ payload, onAction }) => {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  // Handle the "markup" wrapper sent by the sidecar
  let resolvedPayload = payload as Record<string, unknown>;
  if (
    typeof payload === "object" &&
    payload !== null &&
    (payload as Record<string, unknown>).type === "markup" &&
    (payload as Record<string, unknown>).raw
  ) {
    const parsed = parseA2UIMarkup((payload as { raw: string }).raw);
    if (!parsed) {
      return (
        <div className="text-[10px] text-zinc-500 italic opacity-50 p-2 border border-zinc-800 rounded bg-zinc-900/30">
          [Malformed A2UI Blueprint]
        </div>
      );
    }
    resolvedPayload = parsed as unknown as A2UIComponent;
  } else {
    resolvedPayload = payload as A2UIComponent;
  }

  const renderComponent = (comp: A2UIComponent, index: number): React.ReactNode => {
    switch (comp.type) {
      case "text":
        return (
          <p key={index} className="text-zinc-300 text-[13px] leading-relaxed mb-2">
            {comp.text}
          </p>
        );

      case "button":
        return (
          <Button
            key={index}
            variant="outline"
            size="sm"
            className="h-8 border-emerald-500/20 bg-emerald-500/5 text-emerald-400 hover:bg-emerald-500/10 hover:text-emerald-300 text-[11px] font-bold uppercase tracking-wider mb-2 mr-2"
            onClick={() => onAction?.(comp.action)}
          >
            {comp.label}
          </Button>
        );

      case "card":
        return (
          <Card key={index} className="bg-zinc-900/50 border-zinc-800/60 mb-4 overflow-hidden">
            {comp.label && (
              <CardHeader className="py-3 px-4 border-b border-zinc-800/60">
                <CardTitle className="text-[11px] font-bold text-zinc-100 uppercase tracking-widest">
                  {comp.label}
                </CardTitle>
              </CardHeader>
            )}
            <CardContent className="p-4">
              {comp.children?.map((child, i) => renderComponent(child, i))}
            </CardContent>
          </Card>
        );

      case "stack_v":
        return (
          <div key={index} className="flex flex-col gap-2 mb-4">
            {comp.children?.map((child, i) => renderComponent(child, i))}
          </div>
        );

      case "stack_h":
        return (
          <div key={index} className="flex flex-row flex-wrap gap-2 mb-4">
            {comp.children?.map((child, i) => renderComponent(child, i))}
          </div>
        );

      case "surface":
      case "root":
        return (
          <div
            key={index}
            className="a2ui-surface w-full animate-in fade-in slide-in-from-bottom-2"
          >
            {comp.children?.map((child, i) => renderComponent(child, i))}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="a2ui-renderer w-full mt-2">
      {renderComponent(resolvedPayload as A2UIComponent, 0)}
    </div>
  );
};
