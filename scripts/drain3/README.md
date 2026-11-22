# Drain3 Benchmarks (`scripts/drain3`)

## Overview
Standalone Python benchmarking scripts for evaluating Drain3 log template mining, parameter/facet extraction, metadata parsing, multiprocess tagging, and DuckDB batch insertion throughput against the bundled `apache_logs.log` sample dataset (with sample output archived in `bench_results_pro.json`).

## Interface
- `[bench_drain3.py:process_apache_logs]`: Runs a single-pass Drain3 ingestion benchmark (`drain3.TemplateMiner`) over `apache_logs.log` and prints line throughput and cluster count.
- `[bench_drain3_pro.py:process_apache_logs_pro]`: Runs a three-phase benchmark (training on the first 5,000 lines, inference/match-rate tagging on lines 5,000–10,000, and parameter/facet extraction via `extract_parameters`) and writes JSON metrics to `bench_results_pro.json`.
- `[bench_pipeline.py:LOG_FILE]`: Constant `"apache_logs.log"` specifying the input log file path relative to the current working directory.
- `[bench_pipeline.py:read_logs]`: Reads and strips non-empty lines from `LOG_FILE`.
- `[bench_pipeline.py:time_it]`: Measures elapsed wall-clock execution time and item throughput for a benchmark step callable.
- `[bench_pipeline.py:step1_baseline_read]`: Benchmarks reading `LOG_FILE` into memory via `read_logs()`.
- `[bench_pipeline.py:step2_metadata_extraction]`: Benchmarks `metadata_extractor.extract_log_metadata` across all log lines.
- `[bench_pipeline.py:step3_drain3_match]`: Pre-trains `TemplateMiner` on the first 200 metadata records and benchmarks `miner.match` over the remainder.
- `[bench_pipeline.py:step4_drain3_match_and_extract]`: Benchmarks `miner.match` combined with `miner.extract_parameters(..., exact_matching=False)`.
- `[bench_pipeline.py:step5_duckdb_insert]`: Benchmarks single-process Drain3 matching plus `executemany` bulk insertion into an in-memory DuckDB `logs` table.
- `[bench_pipeline.py:_worker_task]`: Reconstructs a `TemplateMiner` prefix tree in a child worker process and performs template matching and parameter extraction on a metadata chunk.
- `[bench_pipeline.py:step6_multiprocess_tagging]`: Benchmarks parallel Drain3 matching and parameter extraction across 1,000-line chunks using `ProcessPoolExecutor(max_workers=6)`.
- `[bench_db_inserts.py:LOG_FILE]`: Constant `"apache_logs.log"` specifying the input log file path relative to the current working directory.
- `[bench_db_inserts.py:DURATION_SECONDS]`: Benchmark duration limit (`10` seconds per insertion strategy).
- `[bench_db_inserts.py:BATCH_SIZE]`: Batch flush threshold (`5000` rows) for DuckDB insertion benchmarks.
- `[bench_db_inserts.py:read_logs]`: Reads and strips non-empty lines from `LOG_FILE`.
- `[bench_db_inserts.py:setup_db]`: Removes any existing database at `db_path`, opens a DuckDB connection, and creates `logs` and `clusters` (`PRIMARY KEY (workspace_id, cluster_id)`) tables.
- `[bench_db_inserts.py:run_benchmark]`: Pre-trains `TemplateMiner` on `logs[:200]`, loops for `DURATION_SECONDS` extracting metadata/parameters and batching rows, and delegates persistence to `insert_func`.
- `[bench_db_inserts.py:insert_executemany]`: Inserts `batch_data` into `logs` via `cursor.executemany` and upserts `clusters` via `ON CONFLICT (workspace_id, cluster_id) DO UPDATE`.
- `[bench_db_inserts.py:insert_pandas]`: Inserts `batch_data` into `logs` via `pandas.DataFrame` and upserts `clusters` through `CREATE TEMP TABLE temp_clusters`.
- `[bench_db_inserts.py:insert_arrow]`: Inserts `batch_data` into `logs` via `pyarrow.Table` and upserts `clusters` through `CREATE TEMP TABLE temp_clusters`.

## Invariants
- `[bench_drain3.py:process_apache_logs]`: Requires `apache_logs.log` in the current working directory (returns early if absent) and configures `TemplateMinerConfig` with `drain_sim_th = 0.4`, `drain_max_children = 100`, and `drain_max_clusters = 1000`.
- `[bench_drain3_pro.py:process_apache_logs_pro]`: Searches for `apache_logs.log` in the current working directory before falling back to the script directory; caps buffered input at 10,000 lines and fixes `train_sample_size = 5000` and `parameter_extraction_cache_capacity = 1000`.
- `[bench_pipeline.py:step3_drain3_match]`, `[bench_pipeline.py:step4_drain3_match_and_extract]`, `[bench_pipeline.py:step5_duckdb_insert]`, `[bench_pipeline.py:step6_multiprocess_tagging]`: Pre-train `TemplateMiner` strictly on the first 200 log records (`metas[:200]`) before evaluating matching or insertion; `[bench_pipeline.py:step6_multiprocess_tagging]` partitions `metas[200:]` into chunks of `1000` across `max_workers=6`.
- `[bench_pipeline.py]`, `[bench_db_inserts.py]`: Prepend `../../sidecar/src` to `sys.path` at import time to load `drain3.template_miner.TemplateMiner` and `metadata_extractor.extract_log_metadata`; `[bench_db_inserts.py]` exits with status `1` if `pandas`, `pyarrow`, or input logs are missing.
- `[bench_db_inserts.py:setup_db]`, `[bench_db_inserts.py:insert_executemany]`, `[bench_db_inserts.py:insert_pandas]`, `[bench_db_inserts.py:insert_arrow]`: Require the 9-column `logs` table and `(workspace_id, cluster_id)` primary-keyed `clusters` table created in `setup_db`; each `insert_*` function executes `logs` insertion and `clusters` upsert inside an explicit `BEGIN TRANSACTION` / `COMMIT` block.

## Side Effects
- `[bench_drain3.py:process_apache_logs]`, `[bench_drain3_pro.py:process_apache_logs_pro]`, `[bench_pipeline.py:read_logs]`, `[bench_db_inserts.py:read_logs]`: Read `apache_logs.log` from disk and write benchmark progress/metrics to stdout.
- `[bench_drain3_pro.py:process_apache_logs_pro]`: Overwrites `bench_results_pro.json` in the current working directory.
- `[bench_pipeline.py:step5_duckdb_insert]`: Creates and populates an in-memory DuckDB (`:memory:`) database.
- `[bench_pipeline.py:step6_multiprocess_tagging]`: Spawns up to 6 worker OS processes via `concurrent.futures.ProcessPoolExecutor`.
- `[bench_db_inserts.py:setup_db]`, `[bench_db_inserts.py:__main__]`: Deletes and recreates `test_executemany.duckdb`, `test_pandas.duckdb`, and `test_arrow.duckdb` on disk in the current working directory.

## Verification
- Run: `N/A` (standalone benchmark scripts; verify syntax or run manually from `scripts/drain3/` via `uv run python bench_drain3.py`, `uv run python bench_drain3_pro.py`, `uv run python bench_pipeline.py`, or `uv run python bench_db_inserts.py`).
