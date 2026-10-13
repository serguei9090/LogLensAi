import { A2UIRenderer } from "@/components/atoms/A2UIRenderer";
import { MarkdownContent } from "@/components/atoms/MarkdownContent";
import { ThinkingBlock } from "@/components/atoms/ThinkingBlock";
import { TypingIndicator } from "@/components/atoms/TypingIndicator";
import { cn } from "@/lib/utils";
import { Check, Copy, Loader2, Sparkles, Wrench } from "lucide-react";
import { useState } from "react";

export interface MessageContentBubbleProps {
  readonly isUser: boolean;
  readonly showTypingIndicator: boolean;
  readonly thinking: string | null;
  readonly isPulseActive: boolean;
  readonly isStreaming: boolean;
  readonly content: string;
  readonly response: string;
  readonly a2uiPayload?: any;
  readonly evaluationNotice?: string;
  readonly steps?: { title: string; done?: boolean }[];
  readonly onA2UIAction: (action: unknown) => void;
}

export function MessageContentBubble({
  isUser,
  showTypingIndicator,
  thinking,
  isPulseActive,
  isStreaming,
  content,
  response,
  a2uiPayload,
  evaluationNotice,
  steps,
  onA2UIAction,
}: Readonly<MessageContentBubbleProps>) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(isUser ? content : response);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className={cn(
        "px-4 py-3 rounded-2xl text-sm leading-relaxed shadow-sm overflow-hidden w-full break-words transition-all duration-300 relative group/bubble",
        isUser
          ? "bg-bg-surface text-text-primary border border-border-subtle rounded-tr-none"
          : "bg-bg-app text-text-secondary border border-border-subtle rounded-tl-none",
      )}
    >
      {/* Floating Copy Action on Hover */}
      {!showTypingIndicator && (
        <button
          type="button"
          onClick={handleCopy}
          className="absolute top-2.5 right-2.5 opacity-0 group-hover/bubble:opacity-100 transition-opacity p-1.5 rounded-lg bg-bg-surface/80 hover:bg-bg-surface border border-border-subtle text-text-muted hover:text-text-primary shadow-sm"
          title="Copy text"
        >
          {copied ? <Check className="size-3 text-emerald-400" /> : <Copy className="size-3" />}
        </button>
      )}

      {showTypingIndicator ? (
        <div className="flex flex-col gap-2.5">
          <div className="flex items-center gap-3">
            <TypingIndicator />
            <span className="text-xs font-medium text-zinc-500 animate-pulse lowercase">
              {steps && steps.length > 0 ? "investigating…" : "thinking…"}
            </span>
          </div>
          {evaluationNotice && (
            <div className="flex items-center gap-1.5 text-xs text-amber-400/90 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20 w-fit animate-in fade-in">
              <Sparkles className="size-2.5 text-amber-400 animate-spin" />
              <span>{evaluationNotice}</span>
            </div>
          )}
          {steps && steps.length > 0 && (
            <div className="flex flex-col gap-1.5 p-2 rounded-xl bg-bg-surface/50 border border-border-subtle/80 text-xs">
              <div className="flex items-center gap-1.5 font-medium text-text-muted mb-0.5 px-1">
                <Wrench className="size-3 text-emerald-400" />
                <span>
                  Execution Steps ({steps.filter((s) => s.done).length}/{steps.length})
                </span>
              </div>
              <div className="flex flex-col gap-1">
                {steps.map((st, idx) => (
                  <div
                    key={`${st.title}-${idx}`}
                    className={cn(
                      "flex items-center gap-2 px-2 py-1 rounded-md transition-colors",
                      st.done
                        ? "text-text-secondary bg-emerald-500/5 border border-emerald-500/10"
                        : "text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 font-medium",
                    )}
                  >
                    {st.done ? (
                      <Check className="size-3 text-emerald-400 flex-shrink-0" />
                    ) : (
                      <Loader2 className="size-3 text-emerald-400 animate-spin flex-shrink-0" />
                    )}
                    <span className="truncate">{st.title}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <>
          {evaluationNotice && !isUser && (
            <div className="mb-2 flex items-center gap-1.5 text-xs text-amber-400/90 bg-amber-500/10 px-2.5 py-1 rounded-lg border border-amber-500/20 w-fit">
              <Sparkles className="size-2.5 text-amber-400" />
              <span>{evaluationNotice}</span>
            </div>
          )}
          {!isUser && (thinking !== null || isPulseActive) && (
            <ThinkingBlock content={thinking ?? ""} isStreaming={isPulseActive} />
          )}
          {/* Step-by-step progress cards */}
          {!isUser && steps && steps.length > 0 && (
            <div className="mb-3 flex flex-col gap-1.5 p-2 rounded-xl bg-bg-surface/50 border border-border-subtle/80 text-xs">
              <div className="flex items-center gap-1.5 font-medium text-text-muted mb-0.5 px-1">
                <Wrench className="size-3 text-emerald-400" />
                <span>
                  Execution Steps ({steps.filter((s) => s.done).length}/{steps.length})
                </span>
              </div>
              <div className="flex flex-col gap-1">
                {steps.map((st, idx) => (
                  <div
                    key={`${st.title}-${idx}`}
                    className={cn(
                      "flex items-center gap-2 px-2 py-1 rounded-md transition-colors",
                      st.done
                        ? "text-text-secondary bg-emerald-500/5 border border-emerald-500/10"
                        : "text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 font-medium",
                    )}
                  >
                    {st.done ? (
                      <Check className="size-3 text-emerald-400 flex-shrink-0" />
                    ) : (
                      <Loader2 className="size-3 text-emerald-400 animate-spin flex-shrink-0" />
                    )}
                    <span className="truncate">{st.title}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className={cn("prose prose-invert prose-sm max-w-none", isUser && "text-right")}>
            {isUser ? (
              <p className="whitespace-pre-wrap">{content}</p>
            ) : (
              <>
                <MarkdownContent
                  content={
                    response ||
                    (steps && steps.length > 0
                      ? "Completed multi-step investigation."
                      : "No response content received.")
                  }
                  className="text-text-primary"
                  isStreaming={!isUser && isStreaming}
                />
                {a2uiPayload && <A2UIRenderer payload={a2uiPayload} onAction={onA2UIAction} />}
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
