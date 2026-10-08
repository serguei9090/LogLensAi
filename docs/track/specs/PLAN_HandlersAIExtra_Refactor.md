# Specification & Plan: Refactoring `handlers_ai_extra.go`

## 1. Problem Statement
`backend-go/internal/app/handlers_ai_extra.go` stands at **1,023 lines**, violating the 400–500 line backend ceiling. It mixes three separate concerns:
1. **AI Session Management**: `GetAISessions`, `GetAIMessages`, `RenameAISession`, `DeleteAISession`, `GetAIMapping` (~180 lines)
2. **Anomaly Detection & Persisted Reads**: `GetAnomalies`, `detectAnomalies`, `parseAnomalyRefTime`, anomaly rate throttle (~250 lines)
3. **Dashboard Aggregate Statistics & Timeseries**: `GetDashboardStats`, sub-aggregations (`fetchTotalLogs`, `fetchLevelCounts`, `fetchTopClusters`, `fetchSourceHeatmap`, `fetchTimeSeries`, etc.), time interval bucketing algorithms (~590 lines)

## 2. Decomposition Target Architecture
We will split `handlers_ai_extra.go` into 3 clean, focused files in `backend-go/internal/app/`:

```text
backend-go/internal/app/
├── handlers_ai_sessions.go     (~180 lines) - AI session and chat message persistence handlers
├── handlers_anomalies.go       (~240 lines) - Anomaly read API and Z-score background detection algorithm
└── handlers_dashboard.go       (~520 lines) - Dashboard aggregate queries, timeseries pivot & heatmap (below/at ceiling)
```

Shared formatting utilities (`nullStringOrNil`, `formatAnyTimestamp`, `derefStr`) can be colocated in a small helper file or placed in `handlers_ai_sessions.go` / `handlers_dashboard.go`.

## 3. Verification Plan
1. `go vet ./...` in `backend-go/`.
2. `go test ./internal/app/...` in `backend-go/`.
3. Update `docs/track/CodeDebt_Monolith_Refactor.md`.
