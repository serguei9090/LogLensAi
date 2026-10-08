import type { HighlightEntry } from "@/components/molecules/HighlightBuilder";
import { Fragment } from "react";

export function getHighlightedElements(text: string, highlights: HighlightEntry[]) {
  if (!highlights || highlights.length === 0 || !text) {
    return <>{text}</>;
  }

  const terms: string[] = [];
  for (const h of highlights) {
    if (h.term) {
      terms.push(h.term.replaceAll(/[-[\]{}()*+?.,\\^$|#\s]/g, String.raw`\$&`));
    }
  }

  if (terms.length === 0) {
    return <>{text}</>;
  }

  const regex = new RegExp(`(${terms.join("|")})`, "gi");
  const parts = text.split(regex);

  let currentPos = 0;
  return (
    <>
      {parts.map((part) => {
        const startPos = currentPos;
        currentPos += part.length;

        const match = highlights.find(
          (h) => h.term?.toLowerCase() === part.toLowerCase(),
        );

        if (match) {
          return (
            <mark
              key={`${match.id}-${startPos}`}
              className="px-0.5 rounded-sm font-bold transition-all transition-duration-300"
              style={{
                backgroundColor: `${match.color}25`,
                color: match.color,
                border: `1px solid ${match.color}40`,
                boxShadow: `0 0 8px ${match.color}15`,
              }}
            >
              {part}
            </mark>
          );
        }
        return <Fragment key={`text-${startPos}`}>{part}</Fragment>;
      })}
    </>
  );
}
