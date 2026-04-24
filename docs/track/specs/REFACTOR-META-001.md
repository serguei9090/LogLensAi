# REFACTOR-META-001: Decompose `extract_log_metadata()` God Function

## Problem

`sidecar/src/metadata_extractor.py::extract_log_metadata()` has a **cyclomatic complexity
of 39** (threshold: 10). It handles 6 distinct responsibilities in a single monolithic
function, making it impossible to test individual extraction paths in isolation.

This directly causes the module's low coverage (58%) since the branching paths are
extremely hard to reach individually.

## Responsibilities to Separate

| New Function | Responsibility |
|---|---|
| `_extract_network_metadata(raw_line)` | IP addresses, ports, hostnames |
| `_extract_http_metadata(raw_line)` | HTTP method, status code, URL path |
| `_extract_log_level(raw_line)` | Severity: ERROR, WARN, INFO, DEBUG |
| `_extract_timestamps(raw_line)` | ISO8601, epoch, common log formats |
| `_apply_custom_rules(raw_line, rules)` | User-defined regex patterns |

## Refactoring Strategy

1. Extract each sub-extractor as a **pure function** (no side effects).
2. `extract_log_metadata()` becomes an **orchestrator** that calls each sub-function
   and merges the results.
3. Each sub-function gets its own test section in `test_metadata.py`.

## Coverage Impact

Expected: `metadata_extractor.py` coverage from **58% → 80%+** after decomposition.

## Files

- `sidecar/src/metadata_extractor.py`
- `sidecar/tests/test_metadata.py`

## Status

- [ ] Refactoring implemented
- [ ] Coverage ≥ 80% verified
- [ ] Complexity ≤ 10 per function verified
