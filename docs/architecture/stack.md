# 🛠️ Technology Stack Specification

> **Init Selector** — Check your technology choices per layer. The AI uses this as the authoritative source for all `import` statements, library usage, and architectural patterns.

<!-- AI_PROMPT: If no options are checked in a section, ask the user what type of project this 
     is (desktop, web, API, CLI). Based on the answer, propose the top 3 stack options for 
     each unchecked layer. Present as a numbered list with a 1-line rationale per option.
     Do not write any code until all mandatory layers are resolved. -->

---

## 🖥️ Application Shell

Select the primary application shell / delivery mechanism:

- [x] **Tauri v2** *(Recommended: Desktop app, uses Rust shell + web frontend)*
- [ ] **Electron** *(Desktop app, Node.js shell — heavier but more ecosystem)*
- [ ] **Next.js (Vercel)** *(Web app, SSR + API routes)*
- [ ] **Vite + React (SPA)** *(Web app, client-side only)*
- [ ] **FastAPI (Python API only)** *(Backend service / microservice, no frontend)*
- [ ] **Bun + Hono** *(Ultra-fast API service)*
- [ ] **CLI (Python / Click / Typer)** *(Command-line tool)*
- [ ] **Flutter (cross-platform)** *(Mobile + Desktop + Web)*

---

## 🎨 Frontend Framework

- [x] **React 19** *(default for Tauri/Vite/Next.js projects)*
- [ ] **Next.js 15** *(SSR, file-based routing, Server Components)*
- [ ] **Flutter / Dart** *(for Flutter shell projects)*
- [ ] **Vue 3 + Vite** *(alternative web framework)*
- [ ] **Svelte 5** *(minimal, compiler-based alternative)*
- [ ] **No frontend** *(API/CLI projects)*

---

## 💅 UI Component Library

- [x] **shadcn/ui** *(Recommended: copy-own components, Radix + Tailwind)*
- [x] **Radix UI (headless)** *(unstyled primitives, full control)*
- [ ] **Mantine** *(batteries-included, good DX)*
- [ ] **Ant Design** *(enterprise-grade, feature-rich)*
- [ ] **Lobe UI** *(AI-optimized components from LobeHub)*
- [ ] **Custom / No library** *(vanilla CSS or project-specific)*
- [ ] **Flutter native widgets** *(for Flutter projects)*

---

## 🎨 Styling System

- [x] **Tailwind CSS v4** *(Recommended for most React projects)*
- [ ] **Vanilla CSS + CSS Variables** *(recommended for maximum control)*
- [ ] **CSS Modules** *(scoped styles, good for large teams)*
- [ ] **Styled Components / Emotion** *(CSS-in-JS)*
- [ ] **Flutter Material / Cupertino** *(for Flutter projects)*

---

## 🗃️ State Management

> See also: `docs/architecture/state_management.md` for detailed patterns.

- [x] **Zustand** *(Recommended: React — minimal, hook-based)*
- [ ] **Jotai** *(atomic state — good for fine-grained reactivity)*
- [ ] **Redux Toolkit** *(large apps, strict data flow)*
- [ ] **React Context + useReducer** *(simple apps, no extra deps)*
- [ ] **TanStack Query** *(server-state management — works alongside Zustand)*
- [ ] **Bloc** *(Flutter projects)*
- [ ] **Riverpod** *(Flutter projects — alternative to Bloc)*

---

## ⚙️ Backend / Sidecar

- [x] **Python (uv) + JSON-RPC Sidecar** *(Recommended for Tauri + AI apps)*
- [ ] **Python (uv) + FastAPI** *(Recommended for standalone web APIs)*
- [ ] **Bun + Hono** *(TypeScript-native, ultra-fast API)*
- [ ] **Node.js + Express** *(standard JS backend)*
- [ ] **Go + Chi/Gin** *(high-performance stateless services)*
- [ ] **No backend** *(frontend-only, static)*

---

## 🗄️ Database & Persistence

> See also: `docs/architecture/database.md` for schema and migration patterns.

- [x] **DuckDB** *(Recommended for Sidecar apps — analytical, embedded, thread-safe)*
- [ ] **SQLite + Drizzle ORM** *(Recommended for Tauri — file-based, type-safe)*
- [ ] **PostgreSQL + Prisma** *(Recommended for web apps with complex relations)*
- [ ] **MongoDB** *(document store — good for flexible schemas)*
- [ ] **Redis** *(caching / pub-sub only)*
- [ ] **Supabase** *(managed Postgres + Auth + Storage)*
- [ ] **No database** *(stateless / file-based)*

---

## 🤖 AI / LLM Integration

- [x] **Ollama (local)** *(Recommended: Gemma 4 / offline-first)*
- [x] **Google Gemini API** *(cloud, multimodal)*
- [x] **OpenAI API** *(GPT-4o / cloud)*
- [ ] **Anthropic Claude API** *(cloud, long context)*
- [x] **Google ADK 2.0** *(agentic workflows + tool use)*
- [x] **Pydantic AI** *(type-safe agent framework)*
- [x] **LangGraph** *(stateful multi-actor workflows)*
- [ ] **No AI integration**

---

## 📦 Package Management

| Layer | Tool | Version |
|-------|------|---------|
| **Python** | `uv` | `>=0.5.0` |
| **JavaScript / TypeScript** | `bun` | `>=1.0.0` |

---

## 🔧 Quality Toolchain

| Tool | Purpose | Config File |
|------|---------|-------------|
| `ruff` | Python lint + format | `pyproject.toml` |
| `biome` | JS/TS lint + format | `biome.json` |
| `lefthook` | Git hooks orchestration | `lefthook.yml` |

---

## 🔗 References

- **Tool Rules**: `AGENTS.md` → Core Tooling & Runtime table
- **Architecture Law**: `.agents/rules/System/Architecture.md`
- **Stack for DB**: `docs/architecture/database.md`
- **Stack for State**: `docs/architecture/state_management.md`
