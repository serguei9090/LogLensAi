# Refactoring Plan: Decompose `backend-go/internal/ai/graph/tools.go` (717 lines)

## 1. Context & Motivation
- **File**: `backend-go/internal/ai/graph/tools.go` (717 lines)
- **Goal**: Decompose into cohesive domain modules under `backend-go/internal/ai/graph/` adhering to the Backend 400–500 line limit.
- **Problem**: `tools.go` bundles multiple independent tool implementations in a single file:
  1. Registry core (`ToolFunc`, `ToolRegistry`, registration lifecycle, `Execute`, `Schemas`, `RouteWithLaya`).
  2. Log & hierarchy querying tools (`searchLogs`, `getClusters`, `getFacets`, `getHierarchy`).
  3. Memory & rule manipulation tools (`searchMemory`, `createColumn`, `createFacet`, `updateLayaRules`, settings persistence).

---

## 2. Target File Structure (`backend-go/internal/ai/graph/`)

```
backend-go/internal/ai/graph/
├── tools.go            (~220 lines) - ToolFunc, ToolRegistry, schemas registration, Execute, RouteWithLaya
├── tools_query.go      (~220 lines) - searchLogs, getClusters, getFacets, getHierarchy
└── tools_rules.go      (~240 lines) - searchMemory, createColumn, createFacet, updateLayaRules, read/write settings
```

---

## 3. Sub-Module Responsibilities
1. **`tools.go`**:
   - `ToolFunc`, `ToolRegistry` struct, `NewToolRegistry`, `App`, `Register`, `Schemas`, `Execute`, `Has`.
   - `registerBuiltins()` defining schemas for all registered functions.
   - `RouteWithLaya()` router.
2. **`tools_query.go`**:
   - `searchLogs` & `searchLogsParams`.
   - `getClusters` & `getClustersParams`.
   - `getFacets` & `getFacetsParams`.
   - `getHierarchy` & `getHierarchyParams`, `hierarchyFolder`, `hierarchySource`.
3. **`tools_rules.go`**:
   - `searchMemory` & `searchMemoryParams`.
   - `createColumn` & `createColumnParams`, `mustJSONString`.
   - `createFacet` & `createFacetParams`, `maskRule`, `readDrainMasksSetting`, `writeDrainMasksSetting`.
   - `updateLayaRules` & `updateLayaRulesParams`.

---

## 4. Verification Plan
1. Ensure all methods stay in `package graph`.
2. Run `go vet ./...` in `backend-go/`.
3. Run `go test ./...` in `backend-go/`.
4. Update `docs/track/CodeDebt_Monolith_Refactor.md`.
