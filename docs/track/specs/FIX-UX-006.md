# Task: Chat Scroll & Context Persistence (FIX-UX-006)

## 📌 Problem
- When switching to a historical session with many messages, the view mounts at the top, forcing the user to manualy scroll down to see the last answer.
- When sending a message or during AI streaming, the view does not automatically scroll down to follow the tokens.

## 🛠️ Implementation Logic

### Goal 1: Auto-Scroll on Arrival
We need to trigger a scroll-to-bottom as soon as a session is loaded or the component mounts with existing messages.
- **Hook**: `useEffect`
- **Dependencies**: `[currentSessionId, messages.length]`
- **Ref**: `scrollRef` (attached to a spacer at the end of the list).

### Goal 2: Streaming Follow-Through
We need a more reactive scroll that follows the assistant as it speaks.
- **Strategy**: Watch the `isLoading` state and the content of the `lastMessage`.
- **Constraint**: If the user has manually scrolled up (detected by checking `scrollTop` vs `scrollHeight`), we should optionally pause auto-scroll to avoid jarring the user.

## 🧪 Testing
1. Load a workspace with 10+ AI sessions.
2. Select a long session from the dropdown.
3. Observe if it immediately jumps/scrolls to the bottom.
4. Ask a question and verify the tokens stay visible in the viewport.
