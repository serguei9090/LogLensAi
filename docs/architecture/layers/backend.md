# ⚙️ Backend Architecture

> **Init File** — Populate this file when the backend/sidecar is set up. The AI uses this as the source of truth for all Python module creation, DB queries, and API method registration.

<!-- AI_PROMPT: Before implementing any new backend method or DB query, read this file.
     Every new `method_` in api.py MUST be registered in the "Registered Methods" table.
     Every new DB table MUST be registered in the "Data Store" section.
     Do not write code that contradicts the patterns defined here. -->

---

## 🧩 Core Modules (Python Sidecar)

> Register each module as it is created. One row per Python file in `sidecar/src/`.

| Module | Path | Responsibility |
|--------|------|---------------|
| `App` (API Router) | `sidecar/src/api.py` | JSON-RPC dispatcher — all `method_*` live here |
| `Database` | `sidecar/src/db.py` | DuckDB connection manager, `get_cursor()` provider |
| *(fill)* | *(fill)* | *(fill)* |

---

## 🤖 AI / Agent Modules

| Module | Path | Framework | Responsibility |
|--------|------|-----------|---------------|
| *(fill — e.g., `LlmAgent`)* | `sidecar/src/ai/agent.py` | *(ADK / Pydantic AI / LangGraph)* | *(fill)* |

---

## 🗄️ Data Store (DuckDB / SQLite)

> See `docs/architecture/database.md` for the full engine selection and schema registry.

### Active Schema Summary

| Table | Description | Key Columns |
|-------|-------------|-------------|
| *(fill)* | *(fill)* | *(fill)* |

### Connection Pattern (MANDATORY)

```python
# Always use get_cursor() — never share cursors across async boundaries
async def method_example(self, req: ExampleRequest) -> ExampleResponse:
    with self.db.get_cursor() as cur:
        result = cur.execute("SELECT ...", [req.param]).fetchall()
    return ExampleResponse(data=result)
```

---

## 📋 Registered API Methods

> Every method in `api.py` MUST appear here. Keep in sync with `communication.md` "Registered Methods" table.

<!-- AI_PROMPT: Whenever you add a new method_ to api.py, immediately add a row here 
     AND in communication.md. Missing entries are a protocol violation. -->

| Method Name | Request Model | Response Model | Description |
|-------------|--------------|----------------|-------------|
| *(none yet)* | — | — | — |

---

## 🔒 Sidecar Architecture Rules

> From `.agents/rules/System/Architecture.md` — Bridge Protocol (Law #1)

1. **All methods return serialized data** — No raw `datetime` objects. Stringify timestamps.
2. **Every method has a Pydantic request model** — No free `dict` params.
3. **Cursor isolation** — `get_cursor()` within every method, never shared.
4. **No direct `invoke` calls from frontend** — All calls go through `callSidecar()` bridge hook.
5. **100% pytest coverage** — Every method has a corresponding test in `sidecar/tests/`.

---

## 🔗 References

- **Communication Protocol**: `docs/architecture/communication.md`
- **Database Schema**: `docs/architecture/database.md`
- **Testing**: `docs/architecture/testing_strategy.md` → Unit + Headless sections
- **Architecture Rule**: `.agents/rules/System/Architecture.md`
