import { cn } from "@/lib/utils";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";

interface ThinkingBlockProps {
  /** The raw thinking content extracted from <think> tags. */
  readonly content: string;
  /** Whether the model is still actively generating (streams thinking live). */
  readonly isStreaming?: boolean;
  /** Optional time it took to think (in ms) */
  readonly durationMs?: number;
}

/**
 * Collapsible thinking/reasoning preview — Antigravity-style.
 *
 * - Collapsed (default): Shows a compact pill with a subtle 2-line preview.
 * - Expanded: Smoothly animates open to reveal the full reasoning chain.
 * - Auto-retracts when `isStreaming` transitions from true → false.
 * - Always preserved in the message so users can re-expand at any time.
 */
export function ThinkingBlock({
  content,
  isStreaming = false,
  durationMs,
}: Readonly<ThinkingBlockProps>) {
  const [isExpanded, setIsExpanded] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const [contentHeight, setContentHeight] = useState(0);
  const wasStreamingRef = useRef(isStreaming);
  const [activeDuration, setActiveDuration] = useState(0);

  // Time counting for active streaming
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isStreaming) {
      setIsExpanded(true); // Auto-expand when streaming starts
      interval = setInterval(() => {
        setActiveDuration((prev) => prev + 100);
      }, 100);
    }
    return () => clearInterval(interval);
  }, [isStreaming]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: Re-measure height when content or expanded state changes
  useEffect(() => {
    if (contentRef.current) {
      setContentHeight(contentRef.current.scrollHeight);
    }
  }, [content, isExpanded]);

  // Auto-retract when streaming finishes (was streaming -> no longer streaming)
  useEffect(() => {
    if (wasStreamingRef.current && !isStreaming) {
      // Small delay before auto-collapsing so the user can see it finished
      const timer = setTimeout(() => {
        setIsExpanded(false);
      }, 2000);
      return () => clearTimeout(timer);
    }
    wasStreamingRef.current = isStreaming;
  }, [isStreaming]);

  if (!content && !isStreaming) {
    return null;
  }

  // Format the text label
  let thoughtText = isStreaming ? "Thinking…" : "Thought process";
  if (!isStreaming) {
    if (durationMs) {
      thoughtText = `Thought for ${(durationMs / 1000).toFixed(1)} seconds`;
    } else if (activeDuration > 0) {
      thoughtText = `Thought for ${(activeDuration / 1000).toFixed(1)} seconds`;
    }
  }

  return (
    <div className="mb-4">
      <button
        type="button"
        onClick={() => setIsExpanded((prev) => !prev)}
        className="flex items-center gap-2 py-1 text-left transition-colors focus-visible:outline-none group"
      >
        <span className="text-text-muted group-hover:text-text-secondary transition-colors">
          {isExpanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
        </span>
        <span
          className={cn(
            "text-sm font-medium text-text-muted group-hover:text-text-secondary transition-colors selection:bg-transparent",
            isStreaming && "animate-pulse",
          )}
        >
          {thoughtText}
        </span>
      </button>

      {/* Expanded full thinking — animated height */}
      <div
        className="overflow-hidden transition-all duration-300 ease-in-out"
        style={{
          maxHeight: isExpanded ? `${Math.min(contentHeight + 16, 500)}px` : "0px",
          opacity: isExpanded ? 1 : 0,
        }}
      >
        <div
          ref={contentRef}
          className="pl-6 pr-2 pb-2 mt-2 max-h-[480px] overflow-y-auto custom-scrollbar"
        >
          <p className="text-[13px] text-text-muted/80 whitespace-pre-wrap leading-relaxed break-words">
            {content}
          </p>
        </div>
      </div>
    </div>
  );
}
