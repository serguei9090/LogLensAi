# Enterprise Motion System (v2)

## 1. Core Principles (Invariants)
*   **Intent-Based:** No random durations. Animations must mean something (Instant, Fast, Deliberate).
*   **Reduced Motion:** If user requests `reduce`, all durations MUST be 0ms.
*   **Non-Blocking:** Interface must remain interactive during animation.

## 2. Workflow (Selection)
1.  **Analyze Interaction:**
    *   Micro (Hover/Click)? -> `Instant` (100ms).
    *   Auxiliary (Tooltip)? -> `Fast` (200ms).
    *   Navigation (Modal)? -> `Deliberate` (400ms).
2.  **Select Meaning:** Don't just pick a speed, pick the Semantic Token.
3.  **Apply:** Use CSS Variable or Framer Variant.

## 3. Tokens (Strict)
| Token | Duration | Use Case |
| :--- | :--- | :--- |
| `--motion-instant` | 100ms | Hover, toggle, active. |
| `--motion-fast` | 200ms | Tooltips, lists. |
| `--motion-deliberate` | 400ms | Modals, Page changes. |

## 4. Forbidden Patterns (Strict)
1.  **Magic Numbers:** `transition: all 0.3s`. **STOP.** Use `var(--motion-fast)`.
2.  **Jank:** Animating `width`, `height`, `top`. Only animate `transform` and `opacity`.
3.  **Unending:** Loops that never stop (Distracting).

## 5. Golden Example (Framer Token Map)
```typescript
// packages/ui/src/tokens/motion.ts (Shared Logic)

export const motionTokens = {
  // 1. Instant (Micro)
  hover: { scale: 1.05, transition: { duration: 0.1 } },
  
  // 2. Fast (Aux)
  fadeIn: { 
    initial: { opacity: 0 },
    animate: { opacity: 1, transition: { duration: 0.2 } }
  },
  
  // 3. Deliberate (Nav)
  modal: {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" } }
  }
};

// Usage
// <motion.div {...motionTokens.modal} />
```
