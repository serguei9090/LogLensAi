# Technical Discovery: Ingestion Bottleneck Isolation

## 📅 Date
May 9, 2026

## 🎯 Context
We completely overhauled the LogLensAi ingestion pipeline to avoid the slow `UPDATE` statements in DuckDB. We replaced the old pipeline with a **"RAM-First Bulk-Insert"** approach, which includes training Drain3, tagging clusters, extracting auto-facets, and inserting fully-formed rows in one go. To optimize the tagging phase, we implemented a `ProcessPoolExecutor` to utilize multiple CPU cores.

However, the e2e ingestion test showed the pipeline crawling at **~50-70 lines per second**.

## 🔬 Benchmark Methodology
To isolate the exact bottleneck without the noise of the main application, we wrote a standalone benchmark script (`scripts/drain3/bench_pipeline.py`) that uses an isolated, in-memory DuckDB instance to process the `apache_logs.log` (10,000 lines). The script tested each phase of the pipeline incrementally.

## 📊 Benchmark Results

| Step | Operation | Time (sec) | Speed (lines/sec) | Analysis |
| :--- | :--- | :--- | :--- | :--- |
| **Step 1** | Read File into RAM | 0.0069s | 1,459,142 | Instantaneous. Not the bottleneck. |
| **Step 2** | Metadata Extraction (Refactored Regex) | 0.1485s | 67,343 | Excellent performance. Removing the heavy UUID/IP regexes was a massive success. |
| **Step 3** | Drain3 Tagging (Single Thread, No Facets) | 0.0455s | 215,166 | Incredible speed. Drain3's prefix tree is highly optimized. |
| **Step 4** | Drain3 Tagging + Param Extraction (Single Thread) | 0.1202s | 81,541 | `miner.extract_parameters()` adds a 2x-3x overhead, but **81k lines/sec on a single thread is still profoundly fast.** |
| **Step 5** | Drain3 + DuckDB Bulk `INSERT` | Hung / Slow | N/A | Testing revealed significant slowdowns when doing heavy batch inserts directly. |
| **Step 6** | Multiprocess Tagging (`ProcessPoolExecutor`) | Hung / Slow | N/A | Testing revealed that pickling strings and passing them through OS pipes was destroying performance. |

## 🔬 Benchmark Methodology (Phase 2: Insertion Optimization)
To address the poor single-thread ingestion performance during integration, we created a second benchmark (`scripts/drain3/bench_db_inserts.py`) to compare different methods of inserting the fully processed log rows into an in-memory DuckDB database. We batched 5000 logs at a time and ran each strategy for 10 seconds.

## 📊 Benchmark Results (Phase 2)

| Insertion Strategy | Speed (lines/sec) | Analysis |
| :--- | :--- | :--- |
| **Approach A:** Native `cursor.executemany` | 436 | Extremely slow. DuckDB struggles to convert row-based tuples into its internal columnar format on the fly. |
| **Approach B:** Pandas DataFrame | 2,550 | 5.8x speedup. DuckDB natively queries DataFrames quickly, but creating the DataFrame has some Python overhead. |
| **Approach C:** PyArrow Table | 3,611 | **8.2x speedup.** PyArrow is the fastest method. Creating columnar Arrays and passing a Table to DuckDB provides near-zero copy ingestion. |

## 🚨 Root Cause Identification
The previous attempt at a RAM-First pipeline failed because we relied on Python's `cursor.executemany("INSERT ... VALUES (?)", batch)`. DuckDB's OLAP engine is incredibly slow at parsing traditional row-based SQL inserts. It expects bulk columnar data.

## 🛠️ Mandatory Action Plan
1. **Remove Multiprocessing:** (Confirmed) Single-threaded Drain3 + Facet Extraction is blazing fast.
2. **Switch to PyArrow:** We must rewrite the database insertion step in `sidecar/src/api.py`. Instead of `cursor.executemany`, the pipeline must:
   - Convert the `batch_data` tuples into individual columnar arrays using `pyarrow.array()`.
   - Construct a `pyarrow.Table`.
   - Execute `INSERT INTO logs SELECT * FROM arrow_table`.

## 📌 References
*   This document is referenced in `docs/track/TODO.md` as the definitive proof for moving away from `ProcessPoolExecutor` and using PyArrow.
*   The architecture mandate has been updated in `GEMINI.md`.