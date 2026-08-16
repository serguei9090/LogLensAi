# 🛠️ Technology Stack Specification

> **Init Selector** — Check your technology choices per layer. The AI uses this as the authoritative source for all `import` statements, library usage, and architectural patterns.

<!-- AI_PROMPT: If no options are checked in a section, ask the user what type of project this 
     is (desktop, web, API, CLI). Based on the answer, propose the top 3 stack options for 
     each unchecked layer. Present as a numbered list with a 1-line rationale per option.
     Do not write any code until all mandatory layers are resolved. -->

---

> **Migration note (2026-08)**: this app moved from Tauri v2 + React 19 + a Python sidecar to Flutter (desktop) + a Go sidecar. The checkboxes below reflect the **current** (post-migration) stack. See `docs/migration/STATUS.md` for the full record, including what changed and why.

## 🖥️ Application Shell

Select the primary application shell / delivery mechanism:

- [ ] **Tauri v2** *(superseded — Desktop app, uses Rust shell + web frontend)*
- [ ] **Electron** *(Desktop app, Node.js shell — heavier but more ecosystem)*
- [ ] **Next.js (Vercel)** *(Web app, SSR + API routes)*
- [ ] **Vite + React (SPA)** *(Web app, client-side only)*
- [ ] **FastAPI (Python API only)** *(Backend service / microservice, no frontend)*
- [ ] **Bun + Hono** *(Ultra-fast API service)*
- [ ] **CLI (Python / Click / Typer)** *(Command-line tool)*
- [x] **Flutter (cross-platform)** *(Desktop targets: Windows/macOS/Linux — uses Flutter's own native runner, no separate shell process)*

---

## 🎨 Frontend Framework

- [ ] **React 19** *(superseded — default for Tauri/Vite/Next.js projects)*
- [ ] **Next.js 15** *(SSR, file-based routing, Server Components)*
- [x] **Flutter / Dart** *(for Flutter shell projects — this project)*
- [ ] **Vue 3 + Vite** *(alternative web framework)*
- [ ] **Svelte 5** *(minimal, compiler-based alternative)*
- [ ] **No frontend** *(API/CLI projects)*

---

## 💅 UI Component Library

- [ ] **shadcn/ui** *(superseded — copy-own components, Radix + Tailwind)*
- [ ] **Radix UI (headless)** *(unstyled primitives, full control)*
- [ ] **Mantine** *(batteries-included, good DX)*
- [ ] **Ant Design** *(enterprise-grade, feature-rich)*
- [ ] **Lobe UI** *(AI-optimized components from LobeHub)*
- [ ] **Custom / No library** *(vanilla CSS or project-specific)*
- [x] **Flutter native widgets** *(Material-based, hand-built atoms/molecules/organisms in `flutter_app/lib/widgets/`, no third-party component kit)*

---

## 🎨 Styling System

- [ ] **Tailwind CSS v4** *(superseded — Recommended for most React projects)*
- [ ] **Vanilla CSS + CSS Variables** *(recommended for maximum control)*
- [ ] **CSS Modules** *(scoped styles, good for large teams)*
- [ ] **Styled Components / Emotion** *(CSS-in-JS)*
- [x] **Flutter Material / Cupertino** *(dark-only `ThemeData` + custom `ThemeExtension` for glow/glass tokens, built from `DESIGN.md` in `flutter_app/lib/theme/`)*

---

## 🗃️ State Management

> See also: `docs/architecture/state_management.md` for detailed patterns (note: that file still describes the old Zustand-based approach — see its deprecation note).

- [ ] **Zustand** *(superseded — React — minimal, hook-based)*
- [ ] **Jotai** *(atomic state — good for fine-grained reactivity)*
- [ ] **Redux Toolkit** *(large apps, strict data flow)*
- [ ] **React Context + useReducer** *(simple apps, no extra deps)*
- [ ] **TanStack Query** *(server-state management — works alongside Zustand)*
- [ ] **Bloc** *(Flutter projects)*
- [x] **Riverpod** *(this project — `flutter_riverpod` `StateNotifier`s in `flutter_app/lib/providers/`, one per domain, mirroring the old Zustand store shapes)*

---

## ⚙️ Backend / Sidecar

- [ ] **Python (uv) + JSON-RPC Sidecar** *(superseded — Recommended for Tauri + AI apps)*
- [ ] **Python (uv) + FastAPI** *(Recommended for standalone web APIs)*
- [ ] **Bun + Hono** *(TypeScript-native, ultra-fast API)*
- [ ] **Node.js + Express** *(standard JS backend)*
- [x] **Go + JSON-RPC Sidecar** *(this project — `backend-go/`, `net/http` for the dev HTTP transport + stdio for prod, same JSON-RPC 2.0 contract as the old Python sidecar)*
- [ ] **No backend** *(frontend-only, static)*

---

## 🗄️ Database & Persistence

> See also: `docs/architecture/database.md` for schema and migration patterns.

- [x] **DuckDB** *(Recommended for Sidecar apps — analytical, embedded, thread-safe. Driver: `github.com/marcboeker/go-duckdb` v1.8.5)*
- [ ] **SQLite + Drizzle ORM** *(Recommended for Tauri — file-based, type-safe)*
- [ ] **PostgreSQL + Prisma** *(Recommended for web apps with complex relations)*
- [ ] **MongoDB** *(document store — good for flexible schemas)*
- [ ] **Redis** *(caching / pub-sub only)*
- [ ] **Supabase** *(managed Postgres + Auth + Storage)*
- [ ] **No database** *(stateless / file-based)*

---

## 🤖 AI / LLM Integration

- [x] **Ollama (local)** *(offline-first, via `backend-go/internal/ai/providers`)*
- [x] **Google Gemini API** *(cloud, multimodal, via `backend-go/internal/ai/providers`)*
- [x] **OpenAI-compatible API** *(cloud, via `backend-go/internal/ai/providers`)*
- [ ] **Anthropic Claude API** *(cloud, long context)*
- [ ] **Google ADK 2.0** *(superseded — agentic workflows + tool use)*
- [ ] **Pydantic AI** *(superseded — type-safe agent framework)*
- [ ] **LangGraph** *(superseded — stateful multi-actor workflows)*
- [x] **Hand-written Go state machine** *(`backend-go/internal/ai/graph` — reasoning/tool_execution/final_answer states + a 7-tool registry, replaces LangGraph + PydanticAI)*

---

## 📦 Package Management

| Layer | Tool | Version |
|-------|------|---------|
| **Go** | `go mod` | Go `1.26.4` |
| **Dart / Flutter** | `flutter pub` | Flutter `3.44.4` stable, Dart SDK `^3.12.2` |

---

## 🔧 Quality Toolchain

| Tool | Purpose | Config File |
|------|---------|-------------|
| `go vet` / `gofmt` | Go lint + format | — (stdlib toolchain) |
| `flutter analyze` / `dart format` | Dart/Flutter lint + format | `flutter_app/analysis_options.yaml` |
| `lefthook` | Git hooks orchestration | `lefthook.yml` |

---

## 🔗 References

- **Tool Rules**: `AGENTS.md` → Core Tooling & Runtime table
- **Architecture Law**: `.agents/rules/System/Architecture.md`
- **Stack for DB**: `docs/architecture/database.md`
- **Stack for State**: `docs/architecture/state_management.md`
