# 📡 Communication Protocol & Bridge Logic

> **Init Selector** — Check one protocol at project start. The AI will use the checked protocol as the source of truth for all backend↔frontend communication code.

<!-- AI_PROMPT: If no protocol is checked below, analyze the project stack from `stack.md` 
     and propose the top 3 options that best fit. Present them as a numbered list with 
     a 1-sentence rationale for each. Wait for user confirmation before checking the box.
     Once confirmed, populate the "Registered Methods" section with the project's actual methods. -->

---

## ⚙️ Protocol Selection

Select the communication protocol for this project:

- [ ] **JSON-RPC 2.0 over Tauri IPC** *(Recommended for Tauri desktop apps)*
  — Direct Rust↔Python Sidecar via `invoke()`. Zero network overhead, typed by Pydantic.
- [ ] **JSON-RPC 2.0 over WebSocket** *(Recommended for web apps with real-time needs)*
  — Full-duplex channel. Supports streaming responses and event push.
- [ ] **REST/HTTP (FastAPI)** *(Recommended for standalone web backends or microservices)*
  — Standard HTTP verbs + OpenAPI docs auto-generation.
- [ ] **gRPC / Protocol Buffers** *(Recommended for high-performance multi-service systems)*
  — Binary protocol. Best for internal service-to-service communication at scale.
- [ ] **tRPC** *(Recommended for TypeScript-only full-stack apps — Next.js, Bun)*
  — End-to-end type safety without a schema. Auto-inferred client from server router.
- [ ] **GraphQL (Apollo / Strawberry)** *(Recommended for flexible client-driven data fetching)*
  — Single endpoint. Clients request exactly what they need.

---

## 📐 Protocol Specification

> Fill the section matching your checked protocol above. Remove or collapse the others.

---

### JSON-RPC 2.0 (Tauri IPC or WebSocket)

**Standard Request Format:**
```json
{
  "jsonrpc": "2.0",
  "method": "METHOD_NAME",
  "params": { },
  "id": "UNIQUE_ID"
}
```

**Standard Response Format:**
```json
{
  "jsonrpc": "2.0",
  "result": { },
  "id": "UNIQUE_ID"
}
```

**Error Format:**
```json
{
  "jsonrpc": "2.0",
  "error": { "code": -32600, "message": "Invalid Request" },
  "id": "UNIQUE_ID"
}
```

**Bridge Hook (Frontend):**
```typescript
// hooks/useSidecarBridge.ts
async function callSidecar<T>(method: string, params: Record<string, unknown>): Promise<T> {
  // Tauri IPC variant:
  return await invoke<T>("plugin:jsonrpc|call", { method, params });
  // WebSocket variant: send via ws and await reply by id
}
```

**Server Class (Backend — api.py):**
```python
class App:
    async def method_example(self, req: ExampleRequest) -> ExampleResponse:
        ...
```

---

### REST/HTTP (FastAPI)

**Base URL:** `http://localhost:{PORT}/api/v1`

**Standard Response Envelope:**
```json
{ "data": {}, "error": null, "meta": { "timestamp": "ISO8601" } }
```

**Router Registration:**
```python
router = APIRouter(prefix="/api/v1")
app.include_router(router)
```

---

### tRPC

**Router Definition:**
```typescript
export const appRouter = router({
  exampleProcedure: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => { ... }),
});
export type AppRouter = typeof appRouter;
```

---

## 📋 Registered Methods

> Add every API method / endpoint here as it is implemented. Keep this list synchronized with `layers/backend.md`.

<!-- AI_PROMPT: Every time a new method is added to api.py or a new route to the backend router,
     append it to this table immediately. Never leave a method undocumented here. -->

| Method / Endpoint | Protocol | Request Schema | Response Schema | Description |
|---|---|---|---|---|
| *(none yet — populate during /init)* | — | — | — | — |

---

## 🔗 References

- **Bridge Rule**: `.agents/rules/Architecture.md` — The Bridge Protocol (Law #1)
- **Backend Layer**: `docs/architecture/layers/backend.md`
- **Frontend Layer**: `docs/architecture/layers/frontend.md`
- **Stack**: `docs/architecture/stack.md`
