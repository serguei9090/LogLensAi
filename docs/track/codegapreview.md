# LogLensAi - Code Gap Review

> **Audit Date**: 2026-03-27
> **Reviewer**: Antigravity
> **Focus**: Sprint 01 Stabilization

This review identifies the delta between the **Master AI Context (`AGENTS.md`)** and the actual codebase implementation.

## 1. Architectural Gaps

| Gap ID | Issue | Location | Impact | Remediation |
|---|---|---|---|---|
| **GAP-ARCH-001** | Missing Per-Method Pydantic Validation | `sidecar/src/api.py` | `AGENTS.md` (L114) mandates strict input/output models. Current `dispatch` uses raw `**kwargs`. | Define `GetLogsRequest`, `TailingResponse`, etc., and validate before logic. |
| **GAP-ARCH-002** | SSH Remote Tailing missing from API | `sidecar/src/api.py` | UI has an "SSH Remote" tab, but the RPC method `start_ssh_tail` is not implemented in the API. | Connect `SSHLoader` to a new `method_start_ssh_tail` in `api.py`. |
| **GAP-ARCH-003** | Missing TODO(ID) Detail Files | Multiple | `Quality.md` mandates `docs/TODOC/<ID>.md` for every TODO. Several exist without "brains." | Audit `api.py`, `parser.py`, and `db.py` for ID consistency. |

## 2. Specification & Contract Drift

| Drift ID | Issue | Location | Impact | Remediation |
|---|---|---|---|---|
| **DRIFT-Contract-001** | `get_logs` Params Outdated | `AGENTS.md` (L99) | The spec doesn't mention the `filters` array or multi-stage logic implemented in `api.py`. | Update `AGENTS.md` table to include `filters: FilterEntry[]`. |
| **DRIFT-Types-001** | Port Conflict Detection Lack | `src/lib/hooks/useSidecarBridge.ts` | The bridge doesn't explicitly handle `ECONNREFUSED` or port 5173/5000 collisions gracefully. | Add specific error mapping for "Sidecar Offline." |

## 3. Implementation Gaps (Logic/UI)

| Gap ID | Issue | Location | Impact | Remediation |
|---|---|---|---|---|
| **GAP-IMPL-001** | Cluster List Refresh | `InvestigationPage.tsx` | Clusters are parsed but the "Cluster Sidebar" or filter list doesn't auto-refresh when new logs are ingested. | Implement `get_clusters` polling or refresh on ingest finish. |
| **GAP-IMPL-002** | Environment Badge Inconsistency | `ImportFeedModal.tsx` | Hot-reloading Vite can cause `isTauri` detection to lag, showing "Browser Mode" temporarily. | Improve detection persistence or remove badges entirely. |

## 4. Remediation Backlog

- [ ] Fix **GAP-ARCH-001**: Implement strict Pydantic models for all `api.py` internal methods.
- [ ] Fix **GAP-ARCH-002**: Implement `method_start_ssh_tail`.
- [ ] Fix **DRIFT-Contract-001**: Sync `AGENTS.md` with implementation reality.

---
*End of Review*
