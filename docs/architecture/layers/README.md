# 🏗️ Architecture Layers

This folder defines the **per-project, per-layer architectural configuration** for both the Backend (Python Sidecar) and Frontend (React/Tauri). Each file is an **init selector** — populate it at project start to give the AI precise context for every implementation decision.

---

## 📂 File Index

| File | Layer | Populated By |
|------|-------|-------------|
| [`backend.md`](./backend.md) | Python Sidecar / API | Developer during `/init` workflow |
| [`frontend.md`](./frontend.md) | React / Tauri UI | Developer during `/init` workflow |

---

## 🔁 Relationship to Other Docs

```
docs/architecture/
├── communication.md   ← Protocol between these two layers
├── layers/
│   ├── backend.md     ← THIS FILE: API methods, DB schema, sidecar modules
│   └── frontend.md    ← THIS FILE: Component tree, state, routing
└── stack.md           ← Technology choices that drive what goes here
```

---

## ✏️ How to Fill These Files

### At Project Init (`/init` workflow)

1. Run the `/init` workflow → it asks you questions about your stack
2. The AI populates `backend.md` with your chosen DB, ORM, API pattern
3. The AI populates `frontend.md` with your chosen framework, state manager, component library

### During Development

- **Backend**: Add every new `method_` as it's created in `api.py`
- **Frontend**: Add new Organisms and Pages as they're built

> **AI Prompt**: Before implementing any new backend method or frontend component, read the corresponding layer file to ensure consistency with the established patterns. Never add a method to `api.py` without registering it in `communication.md`.
