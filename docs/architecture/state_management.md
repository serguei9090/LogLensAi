# 🗃️ State Management Strategy

> **Init Selector** — Check the state management approach for this project. The AI will enforce the selected pattern in all React/Flutter components and never mix patterns.

<!-- AI_PROMPT: If no option is checked, check `stack.md` for the frontend framework and 
     propose the 3 best-fit state managers. Ask the user if they prefer local-first, 
     server-state-first, or atomic patterns before suggesting. -->

---

## ⚙️ Strategy Selection

### React / Web

- [ ] **Zustand** *(Recommended: minimal boilerplate, hook-based, co-located stores)*
- [ ] **Jotai** *(atomic, fine-grained reactivity, derived state)*
- [ ] **Redux Toolkit (RTK)** *(structured, DevTools, time-travel debug)*
- [ ] **TanStack Query + Zustand** *(server state via Query, client state via Zustand)*
- [ ] **React Context + useReducer** *(small apps, zero dependencies)*
- [ ] **Valtio** *(proxy-based, mutable-feeling, simple)*

### Flutter

- [ ] **Bloc** *(Recommended: event-driven, testable, explicit state transitions)*
- [ ] **Riverpod** *(provider-based, compile-time safety, async support)*
- [ ] **GetX** *(reactive, minimal boilerplate, built-in DI)*
- [ ] **MobX** *(observable-based, reactive)*

---

## 📐 Store Schema Definitions

> Fill after selecting your strategy. One entry per store/slice/provider.

<!-- AI_PROMPT: For every new store added, register it here with its shape and the 
     components that consume it. Keep in sync with `layers/frontend.md`. -->

### Store: `[StoreNameStore]`

```typescript
// Zustand example
interface ExampleState {
  items: Item[];
  isLoading: boolean;
  // actions
  fetchItems: () => Promise<void>;
  reset: () => void;
}
```

**Consumers**: *(list components/pages that use this store)*
**Persisted**: *(Yes / No — if yes, what persistence adapter)*

---

## 📜 State Management Rules

> These rules are auto-enforced by the `react` skill and the `Architecture.md` rule.

1. **No business logic in components** — Components only call store actions; logic lives in the store.
2. **No global state for local UI** — Use `useState`/`useLocalState` for ephemeral UI state (modal open, hover, etc.).
3. **Server state ≠ client state** — Use TanStack Query for cached server responses; Zustand for app state.
4. **Single store per domain** — One Zustand store per business domain (auth, logs, settings). Never combine unrelated state.
5. **Immutability** — Never mutate state directly. Use the store's setter or Immer-based patterns.

---

## 🔗 References

- **Stack Choice**: `docs/architecture/stack.md` → State Management section
- **Frontend Layer**: `docs/architecture/layers/frontend.md`
- **Architecture Rule**: `.agents/rules/System/Architecture.md` (UI Structure & Lifecycle)
