# Specification & Plan: Refactoring `AIInvestigationSidebar.tsx`

## 1. Problem Statement
`src/components/organisms/AIInvestigationSidebar.tsx` currently stands at **1,373 lines**, severely violating:
- **Global Engineering Standard Section 10**: Component and file scope limits (<300–400 lines ceiling).
- **Anti-Monolith Standard**: String parsers, streaming tag extractors, model catalogs, and secondary message bubble/row widgets are all crammed into a single monolith file with the sidebar coordinator shell.

## 2. Decomposition Target Architecture
We will decompose `AIInvestigationSidebar.tsx` into a modular feature package located at `src/components/organisms/ai-sidebar/`:

```text
src/components/organisms/ai-sidebar/
├── utils/
│   ├── parseThinking.ts         (~130 lines) - Extracts <think>, channel tags, A2UI stripping
│   └── models.ts                (~45 lines)  - OPENROUTER_QUICK_FREE_MODELS & AI_COMMANDS
├── components/
│   ├── MessageContentBubble.tsx (~160 lines) - Copy actions, thinking block, A2UI, multi-step execution steps
│   ├── AIMessageRow.tsx         (~120 lines) - Message row container, role avatar, timestamp, streaming tags
│   ├── ModelDropdownMenu.tsx    (~220 lines) - VS Code-style provider/model picker, free chips, search
│   └── SidebarInputBar.tsx      (~190 lines) - Slash command popup, attached logs chip, textarea, reasoning & send buttons
├── AIInvestigationSidebar.tsx   (~260 lines) - Coordinator shell (resizing, sessions, store bindings, header)
└── index.ts                     (~15 lines)  - Clean exports
```

A proxy file will remain at `src/components/organisms/AIInvestigationSidebar.tsx` re-exporting `AIInvestigationSidebar` and `parseThinking` for 100% backward-compatibility.

## 3. Detailed Component Responsibilities

1. **`utils/parseThinking.ts`**:
   - `CHANNEL_TAGS`, `stripChannelTags`
   - `A2UI_REGEX`, `stripA2UITags`
   - `findFirstTagIndex`
   - `parseThinking(content: string)`: Returns `{ thinking, response, isStreamingThink }`

2. **`utils/models.ts`**:
   - `OPENROUTER_QUICK_FREE_MODELS`
   - `AI_COMMANDS` (slash commands list)

3. **`components/MessageContentBubble.tsx`**:
   - Renders markdown content, thinking block accordion, multi-step execution steps, A2UIRenderer, copy button.

4. **`components/AIMessageRow.tsx`**:
   - Renders role avatar (`Bot` vs `User`), attached log pills, message content bubble, streaming indicator, timestamp.

5. **`components/ModelDropdownMenu.tsx`**:
   - Renders provider submenu, model list search, free model chips, refresh button.

6. **`components/SidebarInputBar.tsx`**:
   - Renders slash commands suggestion overlay, attached log tag, expandable textarea, thinking toggle, stop stream / send button.

7. **`AIInvestigationSidebar.tsx`**:
   - Session management (switching, renaming, default name generator), sidebar resizing (`handleMouseMove`, `startResizing`), empty state with recent investigation cards, scroll ref management.

## 4. Verification Plan
1. Check that all types and props match exactly.
2. Ensure no unused imports exist (avoid TS6133).
3. Run `bun run build` to guarantee 0 TypeScript/Vite errors.
4. Update `docs/track/CodeDebt_Monolith_Refactor.md`.
