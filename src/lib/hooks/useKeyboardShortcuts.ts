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
      const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;

      for (const shortcut of shortcuts) {
        const keyMatch = e.key.toLowerCase() === shortcut.key.toLowerCase();

        // On Mac, we often want Cmd to act as Ctrl, but since we are providing full
        // customization, we should ideally match what the user recorded.
        // However, to keep it intuitive for Mac users, we'll maintain the Meta/Ctrl mapping
        // if ONLY one of them is specified, or just do exact matching if both are potentially used.

        // For simplicity and to follow the user's "any combination" request, we'll do exact matching.
        const ctrlMatch = !!shortcut.ctrl === e.ctrlKey;
        const metaMatch = !!shortcut.meta === e.metaKey;
        const altMatch = !!shortcut.alt === e.altKey;
        const shiftMatch = !!shortcut.shift === e.shiftKey;

        if (keyMatch && ctrlMatch && metaMatch && altMatch && shiftMatch) {
          e.preventDefault();
          shortcut.handler(e);
          break;
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [shortcuts]);
}
