import { Lightbulb, LightbulbOff, Send, Square } from "lucide-react";
import { type KeyboardEvent, useRef, useState } from "react";
import { ModelDropdownMenu } from "@/components/organisms/ai-sidebar/components/ModelDropdownMenu";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface StudioPromptInputProps {
  readonly isLoading: boolean;
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
  readonly onSendMessage: (message: string) => void;
  readonly onStopStream: () => void;
}

export function StudioPromptInput({
  isLoading,
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
  onSendMessage,
  onStopStream,
}: Readonly<StudioPromptInputProps>) {
  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = () => {
    if (!input.trim() || isLoading) {
      return;
    }
    onSendMessage(input.trim());
    setInput("");
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="p-4 border-t border-border/50 bg-bg-surface/40 backdrop-blur-md">
      <div className="max-w-4xl mx-auto flex flex-col gap-2.5">
        <div className="relative rounded-2xl border border-border-subtle bg-bg-app shadow-inner focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/20 transition-all">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask telemetry questions, query anomalies, or request live charts (Enter to send, Shift+Enter for newline)..."
            disabled={isLoading}
            className="min-h-[72px] max-h-48 border-0 bg-transparent resize-none text-sm text-text-primary placeholder:text-text-muted/60 focus-visible:ring-0 p-4 leading-relaxed font-sans"
          />

          <div className="flex items-center justify-between px-3.5 pb-3 pt-1 border-t border-border-subtle/30">
            <div className="flex items-center gap-2">
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

              <Button
                variant="ghost"
                size="sm"
                onClick={onToggleReasoning}
                className="h-8 gap-1.5 text-xs font-mono text-text-muted hover:text-text-primary"
                title={isReasoningEnabled ? "Deep Reasoning On" : "Deep Reasoning Off"}
              >
                {isReasoningEnabled ? (
                  <Lightbulb className="size-3.5 text-amber-400" />
                ) : (
                  <LightbulbOff className="size-3.5 text-text-muted/60" />
                )}
                <span>{isReasoningEnabled ? "Reasoning" : "Direct"}</span>
              </Button>
            </div>

            <div className="flex items-center gap-2">
              {isLoading ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onStopStream}
                  className="h-8 border-rose-500/30 text-rose-400 hover:bg-rose-500/10 gap-1.5 text-xs font-mono"
                >
                  <Square className="size-3 fill-rose-400" />
                  <span>Stop</span>
                </Button>
              ) : (
                <Button
                  size="sm"
                  onClick={handleSend}
                  disabled={!input.trim()}
                  className="h-8 bg-primary hover:bg-primary-hover text-black font-bold px-3.5 gap-1.5 text-xs rounded-lg transition-transform active:scale-95 disabled:opacity-40"
                >
                  <span>Send</span>
                  <Send className="size-3" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
