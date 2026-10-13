import { A2UIRenderer } from "@/components/atoms/A2UIRenderer";
import { MarkdownContent } from "@/components/atoms/MarkdownContent";
import { ThinkingBlock } from "@/components/atoms/ThinkingBlock";
import { TypingIndicator } from "@/components/atoms/TypingIndicator";
import { stripA2UITags } from "@/components/organisms/ai-sidebar/utils/parseThinking";
import { cn } from "@/lib/utils";
import { Check, Copy, Loader2, Sparkles, Wrench } from "lucide-react";
import { useState } from "react";

export interface StudioMessageCardProps {
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
  readonly onA2UIAction?: (action: unknown) => void;
}

export function StudioMessageCard({
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
}: Readonly<StudioMessageCardProps>) {
  const cleanResponse = stripA2UITags(response || "");
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(isUser ? content : cleanResponse);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className={cn(
        "w-full rounded-2xl p-5 transition-all duration-300 relative group/msg shadow-sm border",
        isUser
          ? "bg-bg-surface/70 border-border-subtle/80 max-w-2xl ml-auto text-text-primary"
          : "bg-bg-app/90 border-border-subtle/60 text-text-secondary",
      )}
    >
      {!showTypingIndicator && (
        <button
          type="button"
          onClick={handleCopy}
          className="absolute top-4 right-4 opacity-0 group-hover/msg:opacity-100 transition-opacity p-1.5 rounded-lg bg-bg-surface/90 hover:bg-bg-surface border border-border-subtle text-text-muted hover:text-text-primary shadow-sm"
          title="Copy response"
        >
          {copied ? <Check className="size-3.5 text-emerald-400" /> : <Copy className="size-3.5" />}
        </button>
      )}

      {showTypingIndicator ? (
        <div className="flex flex-col gap-3 py-1">
          <div className="flex items-center gap-3">
            <TypingIndicator />
            <span className="text-xs font-mono font-medium text-text-muted animate-pulse">
              {steps && steps.length > 0 ? "Analyzing telemetry..." : "Synthesizing insights..."}
            </span>
          </div>
          {evaluationNotice && (
            <div className="flex items-center gap-1.5 text-xs text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-full border border-amber-500/20 w-fit">
              <Sparkles className="size-3 text-amber-400 animate-spin" />
              <span>{evaluationNotice}</span>
            </div>
          )}
        </div>
      ) : (
        <>
          {evaluationNotice && !isUser && (
            <div className="mb-3 flex items-center gap-1.5 text-xs text-amber-400 bg-amber-500/10 px-3 py-1 rounded-lg border border-amber-500/20 w-fit font-mono">
              <Sparkles className="size-3 text-amber-400" />
              <span>{evaluationNotice}</span>
            </div>
          )}

          {!isUser && (thinking !== null || isPulseActive) && (
            <div className="mb-4">
              <ThinkingBlock content={thinking ?? ""} isStreaming={isPulseActive} />
            </div>
          )}

          {!isUser && steps && steps.length > 0 && (
            <div className="mb-4 flex flex-col gap-1.5 p-3 rounded-xl bg-bg-surface/40 border border-border-subtle/70 text-xs">
              <div className="flex items-center gap-2 font-mono font-bold text-text-muted uppercase tracking-wider mb-1">
                <Wrench className="size-3.5 text-emerald-400" />
                <span>
                  Telemetry Pipeline ({steps.filter((s) => s.done).length}/{steps.length})
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {steps.map((st, idx) => (
                  <div
                    key={`${st.title}-${idx}`}
                    className={cn(
                      "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-mono transition-colors",
                      st.done
                        ? "text-text-secondary bg-emerald-500/5 border border-emerald-500/15"
                        : "text-emerald-400 bg-emerald-500/10 border border-emerald-500/30",
                    )}
                  >
                    {st.done ? (
                      <Check className="size-3.5 text-emerald-400 flex-shrink-0" />
                    ) : (
                      <Loader2 className="size-3.5 text-emerald-400 animate-spin flex-shrink-0" />
                    )}
                    <span className="truncate">{st.title}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {isUser ? (
            (() => {
              // Check for attached scopes in prefix
              const targetScopeMatch = content.match(/^\[TARGET CATALOGS?: (.*?)\]\s*(.*)$/s);
              if (targetScopeMatch) {
                const scopeRaw = targetScopeMatch[1];
                const userQuestion = targetScopeMatch[2];
                // Extract names from e.g. "server2.log (source_id: ...), test.log (source_id: ...)"
                const scopeItems = scopeRaw.split("),").map((part) => {
                  const trimmed = part.trim();
                  const nameMatch = trimmed.match(/^(.*?)\s*\(source_id:/);
                  return nameMatch ? nameMatch[1].trim() : trimmed;
                });

                return (
                  <div className="prose prose-invert max-w-none text-right flex flex-wrap items-center justify-end gap-2">
                    <span className="whitespace-pre-wrap font-sans text-sm text-text-primary leading-relaxed">
                      {userQuestion}
                    </span>
                    {scopeItems.map((name, i) => (
                      <span
                        key={`${name}-${i}`}
                        className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-cyan-500/15 border border-cyan-500/30 text-xs font-mono text-cyan-300 shadow-sm align-middle select-none"
                      >
                        <span className="text-cyan-400 font-bold">∞</span>
                        <span className="font-semibold">{name}</span>
                      </span>
                    ))}
                  </div>
                );
              }

              return (
                <div className="prose prose-invert max-w-none text-right">
                  <p className="whitespace-pre-wrap font-sans text-sm text-text-primary leading-relaxed">
                    {content}
                  </p>
                </div>
              );
            })()
          ) : (
            <div className="space-y-4">
              <div className="prose prose-invert max-w-none">
                <MarkdownContent
                  content={cleanResponse || "Analysis complete."}
                  className="text-text-primary text-sm leading-relaxed"
                  isStreaming={isStreaming}
                />
              </div>
              {a2uiPayload && (
                <div className="pt-2 border-t border-border-subtle/40">
                  <A2UIRenderer payload={a2uiPayload} onAction={onA2UIAction} />
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
