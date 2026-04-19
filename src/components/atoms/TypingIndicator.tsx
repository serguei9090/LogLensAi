
/**
 * Professional pulsing dots to indicate AI is working.
 */
export function TypingIndicator() {
  return (
    <div className="flex items-center gap-1.5 px-1 py-2">
      <div className="size-1.5 bg-violet-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
      <div className="size-1.5 bg-violet-400/70 rounded-full animate-bounce [animation-delay:-0.15s]" />
      <div className="size-1.5 bg-violet-400/40 rounded-full animate-bounce" />
    </div>
  );
}
