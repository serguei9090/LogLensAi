import { cn } from "@/lib/utils";
import { Bot, User } from "lucide-react";
import { parseThinking } from "../utils/parseThinking";
import { MessageContentBubble } from "./MessageContentBubble";

export interface AIMessageRowProps {
  readonly message: {
    id: string | number;
    role: string;
    content: string;
    timestamp: string | number | Date;
    context_logs?: (string | number)[] | null;
    a2ui_payload?: any;
    laya_routed?: boolean;
    laya_intent?: string;
    evaluation_notice?: string;
    steps?: { title: string; done?: boolean }[];
  };
  readonly prevMessage: { role: string } | null;
  readonly isLoading: boolean;
  readonly isLastMessage: boolean;
  readonly onA2UIAction: (action: unknown) => void;
}

export function AIMessageRow({
  message,
  prevMessage,
  isLoading,
  isLastMessage,
  onA2UIAction,
}: Readonly<AIMessageRowProps>) {
  const isUser = message.role === "user";
  const isSameRoleAsPrev = prevMessage?.role === message.role;

  const { thinking, response, isStreamingThink } = isUser
    ? { thinking: null, response: message.content, isStreamingThink: false }
    : parseThinking(message.content);

  const isAssistantAndEmpty = !isUser && !thinking && !response;

  // If assistant is empty and we're loading, show the typing indicator
  const showTypingIndicator = isAssistantAndEmpty && isLoading && isLastMessage;

  // Only hold the 'streaming' pulse state if the global store is actually still loading
  const isPulseActive = isStreamingThink && isLoading && isLastMessage;

  return (
    <div
      className={cn(
        "flex gap-3 group",
        isUser ? "flex-row-reverse" : "flex-row",
        isSameRoleAsPrev ? "mt-1" : "mt-6",
      )}
    >
      <div
        className={cn(
          "w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 border transition-all duration-200 group-hover:scale-105 relative",
          isUser
            ? "bg-bg-surface-bright border-border-subtle"
            : "bg-emerald-500/15 border-emerald-500/30 shadow-[0_0_12px_rgba(34,197,94,0.2)]",
          isSameRoleAsPrev && "opacity-0 pointer-events-none", // Hide redundant avatars
        )}
      >
        {isUser ? (
          <User className="size-4 text-text-muted" />
        ) : (
          <Bot className="size-4 text-emerald-400" />
        )}
      </div>
      <div
        className={cn(
          "flex flex-col min-w-0 space-y-2 overflow-hidden",
          isUser ? "items-end max-w-[85%]" : "items-start max-w-[90%]",
        )}
      >
        {message.context_logs && message.context_logs.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-1">
            <span className="bg-primary/10 px-2 py-0.5 rounded text-xs text-primary border border-primary/20 font-medium">
              {message.context_logs.length} logs attached
            </span>
          </div>
        )}
        <MessageContentBubble
          isUser={isUser}
          showTypingIndicator={showTypingIndicator}
          thinking={thinking}
          isPulseActive={isPulseActive}
          isStreaming={isLoading && isLastMessage}
          content={message.content}
          response={response}
          a2uiPayload={message.a2ui_payload}
          evaluationNotice={message.evaluation_notice}
          steps={message.steps}
          onA2UIAction={onA2UIAction}
        />
        {/* Active streaming / multi-step investigation indicator */}
        {!isUser && isLoading && isLastMessage && !showTypingIndicator && (
          <div className="flex items-center gap-2 px-2 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium animate-pulse">
            <span className="size-1.5 rounded-full bg-emerald-400 animate-ping" />
            <span>Investigating and executing steps…</span>
          </div>
        )}
        {!isSameRoleAsPrev && (
          <div className="flex items-center gap-1.5 px-1">
            <span className="text-xs text-text-muted font-medium tracking-tight">
              {(() => {
                const tsStr = String(message.timestamp);
                const safeTs =
                  tsStr && !tsStr.endsWith("Z") && !tsStr.includes("+") && !tsStr.includes("-", 10)
                    ? `${tsStr.replace(" ", "T")}Z`
                    : tsStr;
                return new Date(safeTs).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                });
              })()}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
