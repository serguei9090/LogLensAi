# Feature Spec: Chat Scroll & Context Persistence Resilience (FEAT-004)

## 🎯 Overview
Users have reported that long AI investigation sessions are difficult to navigate because the UI fails to stay focused on the latest activity. Specifically, the sidebar does not automatically scroll to the bottom when opening an existing session or when a new message/token arrives.

## 🚀 Objectives
1. **Auto-Scroll on Message**: Immediately scroll to the bottom when the user sends a message.
2. **Follow-the-Token**: Automatically scroll to follow the assistant's response as tokens stream in.
3. **Session Arrival**: Automatically scroll to the bottom when switching to a large historical session.
4. **User-Intent Preservation**: (Bonus) Do not force scroll if the user has manually scrolled up to read previous context.

## 🛠️ Implementation Plan

### 1. Frontend: `AIInvestigationSidebar.tsx`
- **Dependency Tracking**: Update the `useEffect` that handles scrolling to watch `[messages, currentSessionId]`.
- **Streaming Guard**: Ensure the scroll triggers even when `isLoading` is true and only the content of the last message is changing.
- **Scroll Behavior**: Use `scrollRef.current.scrollIntoView({ behavior: "smooth" })`.

### 2. State Management: `aiStore.ts`
- No changes needed to the store, but the component must react correctly to the `messages` array updates.

## ✅ Acceptance Criteria
1. **Scenario: Opening Historical Session**
   - User selects a session with 50+ messages from the history menu.
   - **Result**: The sidebar loads and immediately scrolls to the bottom-most message.

2. **Scenario: Streaming Response**
   - User sends a message and the AI begins streaming.
   - **Result**: The view follows the growth of the response, keeping the latest tokens visible.

3. **Scenario: Manual Scroll Override**
   - User scrolls 200px up while the AI is streaming to read a previous log.
   - **Result**: System should ideally pause auto-scroll if the user is significantly away from the bottom (to be implemented if possible with `ScrollArea` refs).

## 📅 Tracking
- **Feature ID**: `FEAT-004`
- **Task ID**: `FEAT-004-FRONTEND-001` (Implement Stateful Scroll Logic)
