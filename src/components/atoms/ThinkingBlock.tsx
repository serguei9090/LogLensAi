import { Brain, ChevronRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";

interface ThinkingBlockProps {
  /** The raw thinking content extracted from <think> tags. */
  readonly content: string;
  /** Whether the model is still actively generating (streams thinking live). */
  readonly isStreaming?: boolean;
}

/**
 * Collapsible thinking/reasoning preview — Antigravity-style.
 *
 * - Collapsed (default): Shows a compact pill with a subtle 2-line preview.
 * - Expanded: Smoothly animates open to reveal the full reasoning chain.
 * - Auto-retracts when `isStreaming` transitions from true → false.
 * - Always preserved in the message so users can re-expand at any time.
 */
export function ThinkingBlock({ content, isStreaming = false }: Readonly<ThinkingBlockProps>) {
  const [isExpanded, setIsExpanded] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const [contentHeight, setContentHeight] = useState(0);
  const wasStreamingRef = useRef(isStreaming);

  // Measure inner content height for smooth CSS transitions
  useEffect(() => {
    if (contentRef.current) {
      setContentHeight(contentRef.current.scrollHeight);
    }
  }, [content, isExpanded]);

  // Auto-retract when streaming finishes (was streaming → no longer streaming)
  useEffect(() => {
    if (wasStreamingRef.current && !isStreaming) {
      setIsExpanded(false);
    }
    wasStreamingRef.current = isStreaming;
  }, [isStreaming]);

  if (!content) {
    return null;
  }

  // Extract first ~120 chars of thinking for the preview line
  const preview = content.length > 120 ? `${content.slice(0, 120)}…` : content;

  return (
    <div className="mb-2 group/think">
      <button
        type="button"
        onClick={() => setIsExpanded((prev) => !prev)}
        className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left transition-colors hover:bg-violet-500/5 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-violet-500/30"
      >
        {/* Animated thinking indicator while streaming */}
        {isStreaming ? (
          <span className="relative flex size-3.5 shrink-0">
            <span className="animate-ping absolute inset-0 rounded-full bg-violet-400/30" />
            <Brain className="relative size-3.5 text-violet-400/80" />
          </span>
        ) : (
          <Brain className="size-3.5 text-violet-400/40 shrink-0" />
        )}

        <span className="text-[10px] font-semibold text-violet-400/60 uppercase tracking-wider">
          {isStreaming ? "Thinking…" : "Thought process"}
        </span>

        <ChevronRight
          className={`size-3 text-violet-400/40 ml-auto transition-transform duration-200 ${isExpanded ? "rotate-90" : ""}`}
        />
      </button>

      {/* Collapsed 2-line preview — always visible when not expanded */}
      {!isExpanded && (
        <p className="px-2.5 pb-1.5 text-[11px] text-zinc-500/70 italic leading-snug line-clamp-2 select-none">
          {preview}
        </p>
      )}

      {/* Expanded full thinking — animated height */}
      <div
        className="overflow-hidden transition-[max-height,opacity] duration-300 ease-in-out"
        style={{
          maxHeight: isExpanded ? `${Math.min(contentHeight + 16, 320)}px` : "0px",
          opacity: isExpanded ? 1 : 0,
        }}
      >
        <div
          ref={contentRef}
          className="px-2.5 pb-2 max-h-[300px] overflow-y-auto custom-scrollbar"
        >
          <p className="text-[11px] text-zinc-400/70 whitespace-pre-wrap leading-relaxed break-words">
            {content}
          </p>
        </div>
      </div>
    </div>
  );
}
