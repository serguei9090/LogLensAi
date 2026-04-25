# TODO(shortcut_crash_001): Fix Keyboard Shortcut Crash

## [WHAT] 
The application crashes with `Uncaught TypeError: Cannot read properties of undefined (reading 'toLowerCase')` in `useKeyboardShortcuts.ts`.

## [WHY]
1. `useKeyboardShortcuts` does not verify that `shortcut.key` exists before calling `.toLowerCase()`.
2. `settingsStore.ts` does not properly parse the `ui_command_palette_shortcut` object from the backend (which returns it as a string). This leads to `settings.ui_command_palette_shortcut` being a string (or invalid object) instead of the expected `KeyboardShortcut` type, causing `key` to be undefined when spread.

## [EXPECTATION]
1. `useKeyboardShortcuts.ts` should gracefully handle missing `key` properties in shortcuts.
2. `settingsStore.ts` should correctly deserialize the keyboard shortcut configuration from the backend.

## [CONTEXT]
Ref: i:\01-Master_Code\Apps\LogLensAi\src\lib\hooks\useKeyboardShortcuts.ts
Ref: i:\01-Master_Code\Apps\LogLensAi\src\store\settingsStore.ts
