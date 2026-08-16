# 🏗️ Architecture Layers

This folder defines the **per-project, per-layer architectural configuration** for both the Backend (Go Sidecar) and Frontend (Flutter). Each file is an **init selector** — populate it at project start to give the AI precise context for every implementation decision.

> **Migration note (2026-08)**: this project was originally Python Sidecar + React/Tauri; both `backend.md` and `frontend.md` have been rewritten for the current Go + Flutter stack. See `docs/migration/STATUS.md`.

---

## 📂 File Index

| File | Layer | Populated By |
|------|-------|-------------|
| [`backend.md`](./backend.md) | Go Sidecar / RPC API | Developer during `/init` workflow |
| [`frontend.md`](./frontend.md) | Flutter UI | Developer during `/init` workflow |

---

## 🔁 Relationship to Other Docs

```
docs/architecture/
├── communication.md   ← Protocol between these two layers
├── layers/
│   ├── backend.md     ← THIS FILE: RPC methods, DB schema, backend-go packages
│   └── frontend.md    ← THIS FILE: Widget tree, state, routing
└── stack.md           ← Technology choices that drive what goes here
```

---

## ✏️ How to Fill These Files

### At Project Init (`/init` workflow)

1. Run the `/init` workflow → it asks you questions about your stack
2. The AI populates `backend.md` with your chosen DB, ORM, API pattern
3. The AI populates `frontend.md` with your chosen framework, state manager, component library

### During Development

- **Backend**: Add every new RPC method as it's registered in `backend-go/internal/rpc/`
- **Frontend**: Add new Organisms and Pages as they're built in `flutter_app/lib/widgets/` and `flutter_app/lib/pages/`

> **AI Prompt**: Before implementing any new backend method or frontend widget, read the corresponding layer file to ensure consistency with the established patterns. Never register a method in `internal/rpc/` without noting it in `communication.md`.
