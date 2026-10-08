# Refactoring Plan: `backend-go/internal/app/app.go`

> **Target**: `backend-go/internal/app/app.go` (575 lines)  
> **Goal**: Split `app.go` within `package app` into focused modules adhering to the backend <400–500 line ceiling. Clean Go package structure with zero external breakage.

---

## 1. Problem & Architecture Overview

`app.go` acts as the composition root for the Go sidecar backend, but currently combines:
1. **Core Lifecycle & Subsystems**: `App` struct definition, `NewApp`, `Close`, `ReloadLayaEngine`, `resolveDataDir`, data directory accessors.
2. **Drain3 Mining Cache & Masking**: `GetDrainParser`, `drainStatePath`, `parseMaskingInstructions`, masking rule deserialization.
3. **Settings & Metadata Config Resolution**: `metadataConfigResolver` implementation, facet rules parsing, parser configuration loading, `Settings` and `getSettings`.

---

## 2. Target File Structure (`backend-go/internal/app/`)

All files remain in `package app` (direct sibling files, no extra package layer):

```text
backend-go/internal/app/
├── app.go             (~220 lines) - App struct definition, NewApp constructor, Close lifecycle, DataDir, ReloadLayaEngine
├── app_drain.go       (~115 lines) - GetDrainParser, cache map, drainStatePath, parseMaskingInstructions & maskRuleJSON
└── app_metadata.go    (~160 lines) - metadataConfigResolver, parserConfigJSON, facetRuleJSON, getSettings, deleteLogs, helper utilities
```

---

## 3. Verification Plan

1. Verify Go compilation and test suite: `go vet ./... && go test ./...` in `backend-go/`.
