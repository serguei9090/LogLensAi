// Assume Role: Frontend Engineer (@frontend)
"use client";

import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";

interface DecryptedTextProps {
  text: string;
  speed?: number;
  maxIterations?: number;
  characters?: string;
  className?: string;
  parentClassName?: string;
  animateOn?: "view" | "hover" | "always";
}

const DEFAULT_CHARS = "!<>-_\\/[]{}—=+*^?#0123456789";

/**
 * DecryptedText - React-bits inspired cyber text decoding animation.
 * Scrambles and decrypts characters in place. Respects prefers-reduced-motion.
 */
export function DecryptedText({
  text,
  speed = 40,
  maxIterations = 10,
  characters = DEFAULT_CHARS,
  className,
  parentClassName,
  animateOn = "always",
}: Readonly<DecryptedTextProps>) {
  const [displayText, setDisplayText] = useState(text);
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    // Respect accessibility settings
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (mediaQuery.matches) {
      setDisplayText(text);
      return;
    }

    if (animateOn === "hover" && !isHovered) {
      setDisplayText(text);
      return;
    }

    let iteration = 0;
    let interval: NodeJS.Timeout | null = null;

    interval = setInterval(() => {
      setDisplayText(
        text
          .split("")
          .map((char, index) => {
            if (char === " " || char === "\n") {
              return char;
            }
            if (index < iteration) {
              return text[index];
            }
            return characters[Math.floor(Math.random() * characters.length)];
          })
          .join(""),
      );

      iteration += 1;

      if (iteration > text.length + maxIterations) {
        if (interval) {
          clearInterval(interval);
        }
        setDisplayText(text);
      }
    }, speed);

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [text, speed, maxIterations, characters, animateOn, isHovered]);

  return (
    <span
      className={cn("inline-block", parentClassName)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <span className={cn("font-mono", className)}>{displayText}</span>
    </span>
  );
}
