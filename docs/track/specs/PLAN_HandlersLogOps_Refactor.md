# Specification & Plan: Refactoring `handlers_logops.go`

## 1. Problem Statement
`backend-go/internal/app/handlers_logops.go` is **1,146 lines long**, which violates the backend limit (**400–500 lines** max). It accumulates multiple distinct domains into a single file:
- Log Deletion & File Export (CSV/JSON generation)
- Source Parsers & Fusion Interleaving (`GetFusionConfig`, `UpdateFusionConfig`, `GetFusedLogs`)
- Sampling, Log Comments & Raw File Reading (`GetSampleLines`, `GetSampleLogs`, `UpdateLogComment`, `ReadFile`)
- Ingestion Jobs, SSH & Trace Logging (`StartSSHTail`, `LogTrace`, `GetIngestionJobs`, `CleanupIngestionJobs`)
- Distribution Timeline & Bucketing (`GetLogDistribution` and helper slot algorithms)

## 2. Decomposition Target Architecture
Since all these files belong to `package app`, splitting them into focused domain files within `backend-go/internal/app/` is completely idiomatic in Go and maintains 100% method compatibility on `*App`:

```text
backend-go/internal/app/
├── handlers_logops_export.go       (~250 lines) - DeleteLogs, ExportLogs, writeLogsCSV, writeLogsJSON, csvFieldValue
├── handlers_logops_fusion.go       (~180 lines) - UpdateSourceParser, GetFusionConfig, UpdateFusionConfig, GetFusedLogs, shiftFusionTimestamp
├── handlers_logops_sampling.go     (~170 lines) - GetSampleLines, GetSampleLogs, UpdateLogComment, ReadFile, decodeUTF8Replace
├── handlers_logops_jobs.go         (~260 lines) - StartSSHTail, registerSSHIngestor, sshIngestor, LogTrace, GetIngestionJobs, CleanupIngestionJobs, pyIsoFormat
└── handlers_logops_distribution.go (~310 lines) - GetLogDistribution, buildDistributionSlots, buildDistributionWhereClause, determineDistributionBounds, floorToBucket, parseFlexibleTs, parseStrictTs19
```

The original `handlers_logops.go` (1,146 lines) will be removed once its contents are partitioned across these 5 focused files (each well under the 400-line ceiling).

## 3. Verification Plan
1. Run `go test ./...` in `backend-go/`.
2. Run `go vet ./...` in `backend-go/`.
3. Update `docs/track/CodeDebt_Monolith_Refactor.md`.
