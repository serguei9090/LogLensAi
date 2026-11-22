# drain3

## Overview
Go port of the Drain3 online log template mining algorithm. Implements a fixed-depth prefix tree with regex masking, LRU cluster caching, template widening (`<*>`), template-based facet extraction, and JSON cluster-list persistence.

## Interface
- `[config.go:Config]`, `[config.go:DefaultConfig]`: Miner configuration (`SimTh`, `Depth`, `MaxChildren`, `MaxClusters`, `ExtraDelimiters`, `ParamStr`, `ParametrizeNumericTokens`, `MaskPrefix`, `MaskSuffix`, `MaskingInstructions`) and library defaults (`SimTh: 0.4`, `Depth: 4`, `MaxChildren: 100`, `MaxClusters: 1000`).
- `[masking.go:MaskRule]`, `[masking.go:MaskingInstruction]`, `[masking.go:BuildMaskingInstructions]`: Mask rule input, compiled RE2 pattern struct, and builder skipping disabled/invalid rules.
- `[cluster.go:LogCluster]`, `[cluster.go:LogCluster.Template]`: Mined template cluster (`Tokens`, `ID`, `Size`) and space-joined template formatter.
- `[tree.go:ChangeType]`, `[tree.go:ChangeNone]`, `[tree.go:ChangeClusterCreated]`, `[tree.go:ChangeTemplateChanged]`: Tree mutation outcomes during training.
- `[miner.go:Miner]`, `[miner.go:NewMiner]`, `[miner.go:Miner.Train]`, `[miner.go:Miner.Match]`, `[miner.go:Miner.Clusters]`, `[miner.go:Miner.ClusterCount]`, `[miner.go:Miner.Config]`: Thread-safe (`sync.RWMutex`) Drain3 template miner with exclusive `Train` and concurrent read-only `Match`.
- `[persistence.go:Miner.SaveToFile]`, `[persistence.go:Miner.LoadFromFile]`: JSON snapshot persistence storing `clusters_counter` and flat `clusters` metadata.

## Invariants
- `[miner.go:NewMiner]`: Requires `Depth >= 3` (defaulting `0` to `4`) and fills zero-value `ParamStr` (`"<*>"`), `MaskPrefix` (`"<"`), and `MaskSuffix` (`">"`).
- `[miner.go:Miner.Train]`, `[miner.go:Miner.Match]`, `[miner.go:Miner.Clusters]`: `Train` acquires exclusive write lock (`m.mu.Lock()`) to mutate the prefix tree/LRU cache; `Match`, `Clusters`, `ClusterCount`, `Config`, and `SaveToFile` take `m.mu.RLock()`; `Clusters` deep-copies returned `LogCluster` values.
- `[tree.go:tree.addLogMessage]`, `[tree.go:tree.match]`, `[tree.go:tree.treeSearch]`, `[tree.go:tree.addSeqToPrefixTree]`, `[tree.go:createTemplate]`: Keys prefix tree first by token count then up to `Depth-2` tokens (routing digit tokens when `ParametrizeNumericTokens` is true or branches past `MaxChildren` to `ParamStr`); `Train` matches against `simTh` (`includeParams=false`) and monotonically replaces diverging positions with `ParamStr`; `Match` uses read-only `"never"` search (`simTh=1.0`, `includeParams=true`, no linear fallback).
- `[cache.go:clusterCache]`: Bounded LRU cache when `MaxClusters > 0`; `Get` preserves recency while `Touch` and `Set` promote to front; evicted IDs remain in tree leaves until lazily pruned in `addSeqToPrefixTree`.
- `[masking.go:BuildMaskingInstructions]`, `[masking.go:masker.mask]`: Compiles Go RE2 regexes (unsupported PCRE lookarounds are silently skipped) and escapes `$` as `$$` during sequential replacement.
- `[facets.go:extractFacets]`: Implements `exact_matching=false` template regex reconstruction (`(.+?)` per `<LABEL>`) returning lowercased non-`*` label facets.
- `[persistence.go:Miner.SaveToFile]`, `[persistence.go:Miner.LoadFromFile]`: Persists only flat `snapshot` JSON (rebuilding the prefix tree on load); `LoadFromFile` is a no-op returning `nil` if the file does not exist.

## Side Effects
- `[persistence.go:Miner.SaveToFile]`: Creates parent directories via `os.MkdirAll` (`0o755`) and writes JSON snapshot to disk (`os.WriteFile`, `0o644`).
- `[persistence.go:Miner.LoadFromFile]`: Reads snapshot JSON from disk (`os.ReadFile`) and replaces `m.tree.root`, `m.tree.clusters`, and `m.tree.clustersCounter` under `m.mu.Lock()`.

## Verification
- Run: `go test ./...`
