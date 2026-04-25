import { useEffect } from "react";

type ShortcutHandler = (e: KeyboardEvent) => void;

interface Shortcut {
  key: string;
  ctrl?: boolean;
  meta?: boolean;
  alt?: boolean;
  shift?: boolean;
  handler: ShortcutHandler;
  description: string;
}

export function useKeyboardShortcuts(shortcuts: Shortcut[]) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const platform = (navigator as any).platform || "";
      const isMac = platform.toUpperCase().includes("MAC");

      for (const shortcut of shortcuts) {
        if (!shortcut.key) {
          continue;
        }

        const keyMatch = e.key.toLowerCase() === shortcut.key.toLowerCase();

        // On Mac, Command (metaKey) is often used instead of Control.
        // We allow metaKey to match ctrl requirement on Mac if meta is not explicitly required.
        const ctrlMatch = isMac
          ? !!shortcut.ctrl === (e.ctrlKey || e.metaKey)
          : !!shortcut.ctrl === e.ctrlKey;

        const metaMatch = isMac
          ? !!shortcut.meta === (e.ctrlKey && e.metaKey) // If both are required, both must be pressed
          : !!shortcut.meta === e.metaKey;
        const altMatch = !!shortcut.alt === e.altKey;
        const shiftMatch = !!shortcut.shift === e.shiftKey;

        if (keyMatch && ctrlMatch && metaMatch && altMatch && shiftMatch) {
          e.preventDefault();
          shortcut.handler(e);
          break;
        }
      }
    };

    globalThis.addEventListener("keydown", handleKeyDown);
    return () => globalThis.removeEventListener("keydown", handleKeyDown);
  }, [shortcuts]);
}
