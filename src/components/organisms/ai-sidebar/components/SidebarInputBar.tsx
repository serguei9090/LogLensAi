import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { FileText, Lightbulb, LightbulbOff, Send, Square, X } from "lucide-react";
import { useRef, useState } from "react";
import { AI_COMMANDS } from "../utils/models";
import { ModelDropdownMenu } from "./ModelDropdownMenu";

export interface SidebarInputBarProps {
  readonly isLoading: boolean;
  readonly selectedLogIds: readonly (string | number)[];
  readonly currentProvider: string;
  readonly currentModel: string;
  readonly isFetchingModels: boolean;
  readonly verifiedProviders: readonly string[];
  readonly providerModelsCache: Record<string, string[]>;
  readonly providerConfigs: {
    readonly ollamaHost?: string;
    readonly openaiKey?: string;
    readonly geminiKey?: string;
    readonly openrouterKey?: string;
    readonly openaiCompatKey?: string;
    readonly openaiHost?: string;
    readonly lmstudioHost?: string;
  };
  readonly isReasoningEnabled: boolean;
  readonly onToggleReasoning: () => void;
  readonly onFetchModels: (forceRefresh?: boolean, targetProvider?: string) => void;
  readonly onProviderChange: (provider: string) => void;
  readonly onModelChange: (model: string) => void;
  readonly onClearSelection: () => void;
  readonly onSendMessage: (message: string) => void;
  readonly onStopStream: () => void;
}

export function SidebarInputBar({
  isLoading,
  selectedLogIds,
  currentProvider,
  currentModel,
  isFetchingModels,
  verifiedProviders,
  providerModelsCache,
  providerConfigs,
  isReasoningEnabled,
  onToggleReasoning,
  onFetchModels,
  onProviderChange,
  onModelChange,
  onClearSelection,
  onSendMessage,
  onStopStream,
}: Readonly<SidebarInputBarProps>) {
  const [inputValue, setInputValue] = useState("");
  const [showCommands, setShowCommands] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = () => {
    if (!inputValue.trim()) {
      return;
    }
    const msg = inputValue;
    setInputValue("");
    onSendMessage(msg);
  };

  return (
    <div className="p-4 bg-bg-app/50 backdrop-blur-md border-t border-border-subtle space-y-3 shrink-0">
      <div className="relative group/input bg-bg-surface-bright/50 border border-border-subtle rounded-2xl focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary/30 transition-all p-3 flex flex-col gap-2">
        {showCommands && (
          <div className="absolute bottom-full left-0 mb-2 w-full bg-bg-surface border border-border-subtle rounded-xl overflow-hidden shadow-2xl z-50 animate-in fade-in slide-in-from-bottom-2">
            <div className="p-2 space-y-1">
              {AI_COMMANDS.filter((c) => c.cmd.startsWith(inputValue.toLowerCase())).map((cmd) => (
                <Button
                  key={cmd.cmd}
                  variant="ghost"
                  className="w-full flex flex-col items-start px-3 py-2 text-left rounded-lg bg-transparent hover:bg-primary/10 focus:bg-primary/10 outline-none transition-colors group h-auto"
                  onClick={() => {
                    setInputValue(`${cmd.cmd} `);
                    setShowCommands(false);
                    textareaRef.current?.focus();
                  }}
                >
                  <span className="text-xs font-bold text-emerald-400 font-mono">{cmd.cmd}</span>
                  <span className="text-xs text-text-muted group-hover:text-text-secondary mt-0.5">
                    {cmd.desc}
                  </span>
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* Inline Attached Context Tag */}
        {selectedLogIds.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger className="cursor-default">
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-bg-surface border border-border-subtle text-text-primary text-xs font-medium shadow-sm group/tag select-none hover:border-primary/40 transition-colors">
                    <FileText className="size-3 text-primary shrink-0" />
                    <span className="text-xs font-semibold tracking-tight">
                      {selectedLogIds.length} {selectedLogIds.length === 1 ? "log" : "logs"}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onClearSelection();
                      }}
                      className="ml-1 p-0.5 rounded hover:bg-white/10 text-text-muted hover:text-text-primary transition-colors cursor-pointer"
                      title="Remove context"
                    >
                      <X className="size-3" />
                    </button>
                  </div>
                </TooltipTrigger>
                <TooltipContent
                  side="top"
                  className="text-xs bg-bg-surface border border-border text-text-secondary py-1 px-2.5"
                >
                  {selectedLogIds.length} {selectedLogIds.length === 1 ? "log" : "logs"} selected as
                  context. Press Backspace to remove.
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        )}

        <Textarea
          ref={textareaRef}
          value={inputValue}
          onChange={(e) => {
            const val = e.target.value;
            setInputValue(val);
            if (val.startsWith("/")) {
              setShowCommands(true);
            } else {
              setShowCommands(false);
            }
          }}
          onKeyDown={(e) => {
            if (e.key === "Backspace" && inputValue === "" && selectedLogIds.length > 0) {
              onClearSelection();
              return;
            }
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              setShowCommands(false);
              handleSend();
            }
            if (e.key === "Escape") {
              setShowCommands(false);
            }
          }}
          placeholder="Search patterns or analyze errors..."
          className="w-full min-h-[56px] max-h-[260px] bg-transparent border-0 rounded-none p-0 focus:ring-0 focus-visible:ring-0 text-text-primary placeholder:text-text-muted transition-all resize-none leading-relaxed"
        />

        <div className="flex items-center justify-between pt-1 border-t border-border-subtle/40">
          <div className="flex items-center gap-1.5 overflow-hidden min-w-0 pr-1">
            <ModelDropdownMenu
              currentProvider={currentProvider}
              currentModel={currentModel}
              isFetchingModels={isFetchingModels}
              verifiedProviders={verifiedProviders}
              providerModelsCache={providerModelsCache}
              providerConfigs={providerConfigs}
              onFetchModels={onFetchModels}
              onProviderChange={onProviderChange}
              onModelChange={onModelChange}
            />

            {/* Thinking Icon-Only Toggle with Tooltip */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger
                  type="button"
                  onClick={onToggleReasoning}
                  className={cn(
                    "size-7 rounded-lg transition-all border flex items-center justify-center cursor-pointer shrink-0",
                    isReasoningEnabled
                      ? "bg-amber-500/10 border-amber-500/30 text-amber-300 hover:bg-amber-500/20 shadow-[0_0_12px_-3px_rgba(245,158,11,0.5)]"
                      : "bg-transparent border-border-subtle/60 text-text-muted hover:bg-bg-hover hover:text-text-primary",
                  )}
                  aria-label={isReasoningEnabled ? "Thinking on" : "Thinking off"}
                >
                  {isReasoningEnabled ? (
                    <Lightbulb className="size-3.5 text-amber-400 animate-pulse-slow" />
                  ) : (
                    <LightbulbOff className="size-3.5" />
                  )}
                </TooltipTrigger>
                <TooltipContent
                  side="top"
                  className="text-xs bg-bg-surface border border-border text-text-secondary py-1 px-2.5"
                >
                  {isReasoningEnabled ? "Thinking on" : "Thinking off"}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

          {isLoading ? (
            <Button
              size="icon"
              type="button"
              className="size-7 rounded-lg transition-all shadow-md bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 active:scale-95"
              onClick={onStopStream}
              title="Stop generating"
            >
              <Square className="size-3.5 fill-current" />
            </Button>
          ) : (
            <Button
              size="icon"
              type="button"
              className={cn(
                "size-7 rounded-lg transition-all shadow-md",
                inputValue.trim()
                  ? "bg-primary hover:bg-primary-hover text-bg-app"
                  : "bg-bg-surface text-text-muted opacity-50",
              )}
              disabled={!inputValue.trim()}
              onClick={handleSend}
              title="Send message"
            >
              <Send className="size-3.5" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
