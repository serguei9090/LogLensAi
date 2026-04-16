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
  let thoughtText = isStreaming ? "thinking…" : "thought process";
  if (!isStreaming) {
    if (durationMs) {
      thoughtText = `thought for ${(durationMs / 1000).toFixed(1)} seconds`;
    } else if (activeDuration > 0) {
      thoughtText = `thought for ${(activeDuration / 1000).toFixed(1)} seconds`;
    }
  }

  return (
    <div className="mb-6">
      <button
        type="button"
        onClick={() => setIsExpanded((prev) => !prev)}
        className="flex items-center gap-2.5 py-1 text-left transition-colors focus-visible:outline-none group select-none"
      >
        <span className="text-[#a1a1aa] group-hover:text-[#d4d4d8] transition-colors">
          {isExpanded ? (
            <ChevronDown className="size-3.5 stroke-[2.5px]" />
          ) : (
            <ChevronRight className="size-3.5 stroke-[2.5px]" />
          )}
        </span>
        <span
          className={cn(
            "text-[13px] font-medium text-[#a1a1aa] group-hover:text-[#d4d4d8] transition-colors lowercase",
            isStreaming && "animate-pulse",
          )}
        >
          {thoughtText}
        </span>
      </button>

      {/* Expanded full thinking — animated height */}
      <div
        className="overflow-hidden transition-all duration-500 cubic-bezier(0.4, 0, 0.2, 1)"
        style={{
          maxHeight: isExpanded ? `${Math.min(contentHeight + 32, 600)}px` : "0px",
          opacity: isExpanded ? 1 : 0,
        }}
      >
        <div ref={contentRef} className="pl-6 pr-2 py-3 border-l-2 border-[#27272a] ml-1.5 mt-1">
          {/* Subtle internal header like in the screenshot */}
          <div className="text-[11px] font-bold tracking-wider text-[#a1a1aa]/40 uppercase mb-3 select-none">
            reasoning chain
          </div>
          <div className="text-[14px] text-[#d4d4d8]/80 whitespace-pre-wrap font-sans leading-relaxed break-words">
            {content}
          </div>
        </div>
      </div>
    </div>
  );
}
