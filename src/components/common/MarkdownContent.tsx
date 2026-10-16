import { cn } from "@/lib/utils";
import { Check, Copy } from "lucide-react";
import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface MarkdownContentProps {
  /** The raw text content to render with markdown support. */
  readonly content: string;
  /** Optional extra className for the root container. */
  readonly className?: string;
  /** Whether the message is actively streaming. */
  readonly isStreaming?: boolean;
}

function CodeBlockWithCopy({
  code,
  language,
}: {
  readonly code: string;
  readonly language?: string;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative group/code my-2 rounded-xl overflow-hidden border border-zinc-800/80 bg-zinc-950/90 shadow-sm">
      <div className="flex items-center justify-between px-3 py-1.5 bg-zinc-900/60 border-b border-zinc-800/60 text-xs text-zinc-400 font-mono">
        <span>{language || "code"}</span>
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1.5 text-zinc-400 hover:text-zinc-200 transition-colors px-1.5 py-0.5 rounded hover:bg-zinc-800/60 cursor-pointer"
          title="Copy code"
        >
          {copied ? (
            <>
              <Check className="size-3 text-emerald-400" />
              <span className="text-emerald-400 text-xs">Copied!</span>
            </>
          ) : (
            <>
              <Copy className="size-3" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
      <pre className="px-3.5 py-3 overflow-x-auto custom-scrollbar">
        <code className="text-xs font-mono text-emerald-300/90 leading-relaxed whitespace-pre">
          {code}
        </code>
      </pre>
    </div>
  );
}

/**
 * Robust markdown renderer for AI chat responses powered by react-markdown and remark-gfm.
 * Supports GFM tables, strikethrough, autolinks, custom code blocks with copy, and blockquotes.
 */
export function MarkdownContent({ content, className, isStreaming = false }: MarkdownContentProps) {
  return (
    <div
      className={cn(
        "prose prose-invert prose-sm max-w-none text-text-primary leading-relaxed break-words space-y-2",
        className,
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          table({ children }) {
            return (
              <div className="my-3 overflow-x-auto rounded-xl border border-border-subtle bg-bg-surface/50 shadow-sm">
                <table className="w-full text-left text-xs border-collapse">{children}</table>
              </div>
            );
          },
          thead({ children }) {
            return (
              <thead className="bg-bg-surface-bright/70 border-b border-border-subtle text-text-secondary font-semibold uppercase tracking-wider text-xs">
                {children}
              </thead>
            );
          },
          tbody({ children }) {
            return <tbody className="divide-y divide-border-subtle/50">{children}</tbody>;
          },
          tr({ children }) {
            return <tr className="hover:bg-primary/[0.03] transition-colors">{children}</tr>;
          },
          th({ children }) {
            return <th className="px-3 py-2 text-text-primary font-semibold">{children}</th>;
          },
          td({ children }) {
            return <td className="px-3 py-2 text-text-secondary">{children}</td>;
          },
          ul({ children }) {
            return (
              <ul className="space-y-1 pl-4 my-2 list-disc list-outside marker:text-emerald-500/50">
                {children}
              </ul>
            );
          },
          ol({ children }) {
            return (
              <ol className="space-y-1 pl-4 my-2 list-decimal list-outside marker:text-emerald-500/50">
                {children}
              </ol>
            );
          },
          li({ children }) {
            return <li className="text-sm leading-relaxed text-text-primary">{children}</li>;
          },
          p({ children }) {
            return <p className="text-sm leading-relaxed my-1.5">{children}</p>;
          },
          blockquote({ children }) {
            return (
              <blockquote className="border-l-2 border-emerald-500/40 pl-3 my-2 text-text-muted italic text-xs bg-emerald-500/[0.03] py-1 rounded-r">
                {children}
              </blockquote>
            );
          },
          strong({ children }) {
            return <strong className="font-semibold text-zinc-100">{children}</strong>;
          },
          code({ className: codeClassName, children, ...props }) {
            const match = /language-(\w+)/.exec(codeClassName || "");
            const rawCode = String(children).replace(/\n$/, "");

            // If it's a multiline or language-annotated code block, use CodeBlockWithCopy
            if (match || rawCode.includes("\n")) {
              return <CodeBlockWithCopy code={rawCode} language={match ? match[1] : undefined} />;
            }

            // Inline code
            return (
              <code
                className="px-1.5 py-0.5 rounded bg-zinc-800/80 text-emerald-400/90 text-xs font-mono border border-zinc-700/40"
                {...props}
              >
                {children}
              </code>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
      {isStreaming && (
        <span className="inline-block w-1.5 h-3.5 bg-emerald-400 ml-0.5 animate-pulse align-middle" />
      )}
    </div>
  );
}
