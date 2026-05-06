# 🎨 Frontend Architecture

> **Init File** — Populate this file when the frontend is scaffolded. The AI uses this as the source of truth for all component creation, routing, state management, and styling decisions.

<!-- AI_PROMPT: Before creating any new component, page, or hook, read this file.
     Register every new Organism and Page here as it is built.
     Do not create components that duplicate existing ones listed below.
     Cross-reference `state_management.md` for store shapes. -->

---

## 🏗️ Component Hierarchy (Atomic Design)

> Register components as they are created. Follow the strict hierarchy — never put business logic in Atoms.

### ⚛️ Atoms *(pure, stateless, no store access)*

| Component | File Path | Props Summary |
|-----------|-----------|---------------|
| `Button` | `src/components/atoms/Button.tsx` | `variant, size, onClick, disabled` |
| *(fill)* | *(fill)* | *(fill)* |

### 🧬 Molecules *(composed atoms, minimal logic)*

| Component | File Path | Props Summary |
|-----------|-----------|---------------|
| *(fill)* | *(fill)* | *(fill)* |

### 🦠 Organisms *(data-bound, may access stores)*

| Component | File Path | Store(s) Used | Description |
|-----------|-----------|--------------|-------------|
| *(fill)* | *(fill)* | *(fill)* | *(fill)* |

### 📄 Templates & Pages

| Page | Route | Auth Required | Description |
|------|-------|--------------|-------------|
| *(fill)* | `/` | No | *(fill)* |

---

## 🗃️ State Management

> See `docs/architecture/state_management.md` for the full strategy and store schemas.

### Active Stores

| Store | File Path | Domain | Persisted |
|-------|-----------|--------|-----------|
| *(fill)* | `src/store/*.store.ts` | *(fill)* | No |

---

## 🧭 Routing

- **Router**: *(e.g., React Router v7 / TanStack Router / Next.js App Router / Flutter Navigator 2.0)*
- **Route Guard**: *(fill — how auth routes are protected)*

### Route Map

```
/              → HomePage
/settings      → SettingsPage
*(fill)*
```

---

## 🔌 Bridge Hook (Frontend ↔ Backend)

> All backend calls go through this hook. Never call `invoke()` directly.

```typescript
// src/hooks/useSidecarBridge.ts
export function useSidecarBridge() {
  async function callSidecar<T>(method: string, params: Record<string, unknown>): Promise<T> {
    // implementation — see communication.md for protocol
  }
  return { callSidecar };
}
```

**Registered usages:**

| Hook Call | Method | Used In |
|-----------|--------|---------|
| *(fill)* | *(fill)* | *(fill)* |

---

## 🎨 Design System Tokens

> Token source: `DESIGN.md` (or local `DESIGN.template.md` customized for this project).

| Token | CSS Variable | Value |
|-------|-------------|-------|
| Primary | `--color-primary` | *(from DESIGN.md)* |
| Background | `--color-bg-base` | *(from DESIGN.md)* |
| Font Sans | `--font-sans` | *(from DESIGN.md)* |

**Rule**: Hardcoded hex values are strictly forbidden. Always use CSS variables derived from `DESIGN.md` tokens.

---

## 📜 Frontend Rules

> From `.agents/rules/System/Architecture.md` and `CodeQuality.md`

1. **Atoms are stateless** — No store access, no async calls, no side effects.
2. **Organisms own data** — Organisms connect to stores and call `useSidecarBridge`.
3. **No nested interactive elements** — Use `role="button"` for custom containers.
4. **Motion always** — No element appears/disappears without a transition (Fade/Slide/Scale).
5. **Token adherence** — No hardcoded hex/px. CSS variables only.
6. **Focus rings** — All interactive elements must have visible `focus-visible` styles.
7. **JSDoc** — All exported components and hooks must have JSDoc comments.

---

## 🔗 References

- **State Strategy**: `docs/architecture/state_management.md`
- **Communication**: `docs/architecture/communication.md`
- **Design Tokens**: `DESIGN.md`
- **Stack**: `docs/architecture/stack.md` → Frontend + UI Library sections
- **Testing**: `docs/architecture/testing_strategy.md` → Component Testing section
