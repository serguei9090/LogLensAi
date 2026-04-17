import { cn } from "@/lib/utils";
import { Fragment } from "react";

interface MarkdownContentProps {
  /** The raw text content to render with lightweight markdown support. */
  readonly content: string;
  /** Optional extra className for the root container. */
  readonly className?: string;
}

/**
 * Lightweight markdown renderer for AI chat responses.
 *
 * Supports a minimal subset of markdown without external dependencies:
 * - **bold** text
 * - `inline code`
 * - ```code blocks```
 * - - bullet lists
 * - Line breaks
 *
 * @purpose Render AI assistant responses with basic formatting without
 *          pulling in heavy markdown libraries like react-markdown + remark.
 */
export function MarkdownContent({ content, className }: MarkdownContentProps) {
  const elements = parseMarkdown(content);

  return (
    <div className={cn("space-y-2 overflow-hidden", className)}>
      {elements.map((el, i) => {
        const key = typeof el === "string" ? `${i}-${el.length}` : `md-${i}`;
        return <Fragment key={key}>{el}</Fragment>;
      })}
    </div>
  );
}

/** Parses markdown text into React elements. */
function parseMarkdown(text: string): React.ReactNode[] {
  const elements: React.ReactNode[] = [];
  const lines = text.split("\n");
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Code block: ```...```
    if (line.trimStart().startsWith("```")) {
      const { element, nextIndex } = parseCodeBlock(lines, i, elements.length);
      elements.push(element);
      i = nextIndex;
      continue;
    }

    // Bullet list: - item or * item
    if (/^\s*[-*]\s+/.test(line)) {
      const { element, nextIndex } = parseBulletList(lines, i, elements.length);
      elements.push(element);
      i = nextIndex;
      continue;
    }

    // Numbered list: 1. item
    if (/^\s*\d+[.)]\s+/.test(line)) {
      const { element, nextIndex } = parseOrderedList(lines, i, elements.length);
      elements.push(element);
      i = nextIndex;
      continue;
    }

    // Empty line = paragraph separator
    if (line.trim() === "") {
      i++;
      continue;
    }

    // Regular paragraph
    const { element, nextIndex } = parseParagraph(lines, i, elements.length);
    elements.push(element);
    i = nextIndex;
  }

  return elements;
}

function parseCodeBlock(lines: string[], startIndex: number, elIndex: number) {
  const codeLines: string[] = [];
  let i = startIndex + 1;
  while (i < lines.length && !lines[i].trimStart().startsWith("```")) {
    codeLines.push(lines[i]);
    i++;
  }
  return {
    element: (
      <pre
        key={`code-${elIndex}-${codeLines.length}`}
        className="bg-zinc-900/80 border border-zinc-800/60 rounded-lg px-3 py-2.5 overflow-x-auto custom-scrollbar"
      >
        <code className="text-[11px] font-mono text-emerald-300/90 leading-relaxed whitespace-pre">
          {codeLines.join("\n")}
        </code>
      </pre>
    ),
    nextIndex: i + 1,
  };
}

function parseBulletList(lines: string[], startIndex: number, elIndex: number) {
  const listItems: string[] = [];
  let i = startIndex;
  while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
    listItems.push(lines[i].replace(/^\s*[-*]\s+/, ""));
    i++;
  }
  return {
    element: (
      <ul key={`list-${elIndex}`} className="space-y-1 pl-3">
        {listItems.map((item, li) => (
          <li
            key={`li-${elIndex}-${li}`}
            className="text-[13px] leading-relaxed flex items-start gap-2"
          >
            <span className="text-emerald-500/40 mt-1.5 shrink-0">•</span>
            <span>{renderInline(item)}</span>
          </li>
        ))}
      </ul>
    ),
    nextIndex: i,
  };
}

function parseOrderedList(lines: string[], startIndex: number, elIndex: number) {
  const listItems: string[] = [];
  let i = startIndex;
  while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i])) {
    listItems.push(lines[i].replace(/^\s*\d+[.)]\s+/, ""));
    i++;
  }
  return {
    element: (
      <ol key={`ol-${elIndex}`} className="space-y-1 pl-3 list-decimal list-inside">
        {listItems.map((item, li) => (
          <li key={`oli-${elIndex}-${li}`} className="text-[13px] leading-relaxed">
            {renderInline(item)}
          </li>
        ))}
      </ol>
    ),
    nextIndex: i,
  };
}

function parseParagraph(lines: string[], startIndex: number, elIndex: number) {
  const paraLines: string[] = [];
  let i = startIndex;
  while (
    i < lines.length &&
    lines[i].trim() !== "" &&
    !lines[i].trimStart().startsWith("```") &&
    !/^\s*[-*]\s+/.test(lines[i]) &&
    !/^\s*\d+[.)]\s+/.test(lines[i])
  ) {
    paraLines.push(lines[i]);
    i++;
  }
  return {
    element: (
      <p key={`p-${elIndex}`} className="text-[13px] leading-relaxed">
        {renderInline(paraLines.join("\n"))}
      </p>
    ),
    nextIndex: i,
  };
}

/** Renders inline markdown: **bold**, `code`, and line breaks. */
function renderInline(text: string): React.ReactNode {
  // Split by inline patterns in order: bold, code, text
  const parts: React.ReactNode[] = [];
  // Combined regex for bold (**text**) and inline code (`text`)
  const regex = /(\*\*[^*]+\*\*|`[^`]+`)/g;
  let lastIndex = 0;

  for (const match of text.matchAll(regex)) {
    const before = text.slice(lastIndex, match.index);
    if (before) {
      parts.push(renderLineBreaks(before));
    }

    const token = match[0];
    if (token.startsWith("**")) {
      parts.push(
        <strong key={`b-${match.index}`} className="font-bold text-zinc-100">
          {token.slice(2, -2)}
        </strong>,
      );
    } else if (token.startsWith("`")) {
      parts.push(
        <code
          key={`c-${match.index}`}
          className="px-1.5 py-0.5 rounded bg-zinc-800/80 text-emerald-400/90 text-[11px] font-mono border border-zinc-700/40"
        >
          {token.slice(1, -1)}
        </code>,
      );
    }

    lastIndex = (match.index ?? 0) + token.length;
  }

  const remaining = text.slice(lastIndex);
  if (remaining) {
    parts.push(renderLineBreaks(remaining));
  }

  return parts.length === 1 ? parts[0] : <>{parts}</>;
}

/** Converts \n to <br /> within inline text. */
function renderLineBreaks(text: string): React.ReactNode {
  const lines = text.split("\n");
  if (lines.length === 1) {
    return text;
  }
  return lines.map((line, i) => (
    <Fragment key={`br-${i}-${line.length}`}>
      {line}
      {i < lines.length - 1 && <br />}
    </Fragment>
  ));
}
