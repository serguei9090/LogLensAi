import json
import os
import sys
import time
from concurrent.futures import ProcessPoolExecutor, as_completed

import duckdb

# Add sidecar/src to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "sidecar", "src")))

import contextlib

from drain3.template_miner import TemplateMiner
from metadata_extractor import extract_log_metadata

LOG_FILE = "apache_logs.log"

def read_logs():
    with open(LOG_FILE, encoding='utf-8') as f:
        return [line.strip() for line in f if line.strip()]

def time_it(name, func, *args, **kwargs):
    print(f"--- Running: {name} ---")
    start = time.time()
    result = func(*args, **kwargs)
    end = time.time()
    elapsed = end - start
    print(f"Time taken: {elapsed:.4f} seconds")
    if hasattr(result, '__len__'):
        print(f"Processed items: {len(result)}")
        if elapsed > 0:
            print(f"Speed: {len(result) / elapsed:.2f} items/sec")
    print()
    return result

def step1_baseline_read():
    return read_logs()

def step2_metadata_extraction(lines):
    results = []
    for line in lines:
        meta = extract_log_metadata(line, custom_rules=[], parser_config={}, tz_offset=0)
        results.append(meta)
    return results

def step3_drain3_match(metas):
    miner = TemplateMiner()
    # Train on first 200
    for meta in metas[:200]:
        miner.add_log_message(meta["message"])

    results = []
    for meta in metas[200:]:
        match = miner.match(meta["message"])
        results.append(match)
    return results

def step4_drain3_match_and_extract(metas):
    miner = TemplateMiner()
    # Train on first 200
    for meta in metas[:200]:
        miner.add_log_message(meta["message"])

    results = []
    for meta in metas[200:]:
        match = miner.match(meta["message"])
        if match:
            # this simulates what we do
            template = match.get_template()
            with contextlib.suppress(Exception):
                miner.extract_parameters(template, meta["message"], exact_matching=False)
        results.append(match)
    return results

def step5_duckdb_insert(metas):
    conn = duckdb.connect(':memory:')
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE logs (
            id BIGINT,
            workspace_id VARCHAR,
            source_id VARCHAR,
            line_id BIGINT,
            raw_text VARCHAR,
            timestamp VARCHAR,
            level VARCHAR,
            cluster_id VARCHAR,
            has_comment BOOLEAN,
            comment VARCHAR,
            facets VARCHAR,
            processed BOOLEAN
        )
    """)

    miner = TemplateMiner()
    for meta in metas[:200]:
        miner.add_log_message(meta["message"])

    batch = []
    for i, meta in enumerate(metas):
        match = miner.match(meta["message"])
        cluster_id = str(match.cluster_id) if match else None

        batch.append((
            i, 'ws1', 'src1', i, meta["message"], meta["timestamp"], meta["level"], cluster_id, False, '', '{}', True
        ))

    t0 = time.time()  # noqa: F841
    cursor.executemany(
        "INSERT INTO logs (id, workspace_id, source_id, line_id, raw_text, timestamp, level, cluster_id, has_comment, comment, facets, processed) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        batch
    )
    conn.commit()
    return batch


# --- Helper for multiprocess ---
def _worker_task(chunk, config, cluster_map_data):
    # reconstruct miner
    miner = TemplateMiner(config=config)
    for c in cluster_map_data:
        miner.drain.id_to_cluster[c.cluster_id] = c
        miner.drain.add_seq_to_prefix_tree(miner.drain.root_node, c)

    results = []
    for meta in chunk:
        match = miner.match(meta["message"])
        facets = {}
        if match:
            template = match.get_template()
            try:
                params = miner.extract_parameters(template, meta["message"], exact_matching=False)
                if params:
                    for p in params:
                        facets[p.mask_name] = p.value
            except Exception:
                pass
        results.append((match.cluster_id if match else None, json.dumps(facets)))
    return results

def step6_multiprocess_tagging(metas):
    miner = TemplateMiner()
    for meta in metas[:200]:
        miner.add_log_message(meta["message"])

    cluster_map_data = list(miner.drain.clusters)
    config = miner.config

    chunks = []
    chunk_size = 1000
    for i in range(200, len(metas), chunk_size):
        chunks.append(metas[i:i+chunk_size])

    results = []
    with ProcessPoolExecutor(max_workers=6) as executor:
        futures = []
        for chunk in chunks:
            futures.append(executor.submit(_worker_task, chunk, config, cluster_map_data))

        for fut in as_completed(futures):
            results.extend(fut.result())

    return results

if __name__ == "__main__":
    print("Starting Incremental Pipeline Benchmark...")

    # 1. Base Read
    lines = time_it("1. Read File", step1_baseline_read)

    if not lines:
        print("No lines read. Exiting.")
        sys.exit(1)

    # 2. Metadata Extraction
    metas = time_it("2. Metadata Extraction (Regex)", step2_metadata_extraction, lines)

    # 3. Drain3 Tagging
    time_it("3. Drain3 Tagging (Single Thread)", step3_drain3_match, metas)

    # 4. Drain3 Tagging + Param Extraction
    time_it("4. Drain3 Tagging + Param Extract (Single Thread)", step4_drain3_match_and_extract, metas)

    # 5. Full flow + DuckDB Insert
    time_it("5. Drain3 + DuckDB Bulk Insert", step5_duckdb_insert, metas)

    # 6. Multiprocess Tagging
    time_it("6. Multiprocess Tagging (ProcessPoolExecutor)", step6_multiprocess_tagging, metas)

    print("Benchmark complete.")
