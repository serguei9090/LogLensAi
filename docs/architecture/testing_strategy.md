# 🧪 Testing Strategy

> **Init Selector** — Check the testing types and frameworks for this project. The AI will generate tests that match the checked strategy and will never suggest unchecked test types without asking.

<!-- AI_PROMPT: If no option is checked, review `stack.md` for the frontend framework and backend.
     Propose a testing pyramid suited to the project:
     - Unit tests (always)
     - Integration tests (if API / DB exists)
     - E2E tests (if UI exists)
     Present top 3 framework combos and ask user to confirm. -->

---

## ⚙️ Testing Strategy Selection

### Unit Testing

- [ ] **pytest** *(Recommended for Python backend/sidecar)*
- [ ] **Bun test** *(Fast built-in test runner for JS/TS)*
- [ ] **Vitest** *(Vite-native, Jest-compatible for React)*
- [ ] **flutter_test** *(Dart unit tests — built-in)*

### Integration Testing

- [ ] **pytest + httpx** *(API integration tests — Python)*
- [ ] **Vitest + MSW** *(Mock Service Worker — frontend integration)*
- [ ] **Supertest + Bun** *(HTTP API integration)*

### Component Testing (UI)

- [ ] **React Testing Library** *(DOM-based component tests)*
- [ ] **Storybook** *(visual component isolation and testing)*
- [ ] **flutter_test WidgetTest** *(Flutter widget tests)*

### End-to-End (E2E)

- [ ] **Playwright** *(Recommended for web — cross-browser, auto-wait)*
- [ ] **Cypress** *(Web — alternative, more opinionated DX)*
- [ ] **Patrol** *(Recommended for Flutter — native E2E)*
- [ ] **Tauri WebDriver** *(Desktop E2E via WebDriver for Tauri)*

### AI / Agentic Testing

- [ ] **Headless sidecar tests** *(pytest tests against JSON-RPC sidecar without UI)*
- [ ] **LLM output assertions** *(compare LLM responses to expected schemas)*
- [ ] **Tool call verification** *(assert correct tool is called with correct params)*

---

## 📐 Test Configuration

### Coverage Targets

| Layer | Min Coverage |
|-------|-------------|
| Python Sidecar / Backend | 80% |
| Frontend Components | 60% |
| E2E Critical Paths | 100% of happy paths |

### Test Commands

```bash
# Python
uv run pytest tests/ -v --cov=sidecar/src --cov-report=term-missing

# JavaScript / TypeScript
bun test
bun test --coverage

# Flutter
flutter test
flutter test integration_test/

# E2E
bunx playwright test
```

### CI Gate

> All checked test suites MUST pass before any `git push` or `bd close`.

- [ ] Unit tests must pass
- [ ] Integration tests must pass
- [ ] E2E smoke tests must pass (at least 1 critical path)
- [ ] Coverage thresholds enforced

---

## 🧱 Test File Conventions

```
project/
├── tests/                    # Python unit + integration
│   ├── unit/
│   └── integration/
├── src/
│   └── __tests__/           # Co-located JS/TS unit tests
├── e2e/                      # Playwright / Cypress E2E
│   └── *.spec.ts
└── integration_test/         # Flutter E2E (Patrol)
    └── app_test.dart
```

---

## 📜 Testing Rules

> Enforced by `code-quality` skill and `CodeQuality.md` rule.

1. **Red-Green-Refactor**: Write a failing test before implementing any feature.
2. **No Implementation Without Test**: A `bd close` is blocked if the feature has zero test coverage.
3. **Headless Mandate**: 100% of sidecar/backend logic must be testable via pytest without launching the UI.
4. **Mock at the Boundary**: Mock only at the infrastructure boundary (HTTP, DB, filesystem), never inside domain logic.
5. **No `// TODO: test later`**: Missing tests get a `bd create "Test: [feature]"` task immediately.

---

## 🔗 References

- **Quality Rule**: `.agents/rules/System/CodeQuality.md`
- **Testing Rules**: `.agents/rules/Testing/`
- **CI Config**: `docs/architecture/deployment.md` → CI/CD Pipeline section
- **Backend Headless Tests**: `sidecar/tests/`
