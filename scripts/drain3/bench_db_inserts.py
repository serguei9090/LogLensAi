import json
import os
import sys
import time

import duckdb

# Ensure pandas and pyarrow are available, or catch ImportError
try:
    import pandas as pd
    import pyarrow as pa
except ImportError:
    print("Please install pandas and pyarrow for the benchmark: uv pip install pandas pyarrow")
    sys.exit(1)

# Add sidecar/src to path
sys.path.insert(
    0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "sidecar", "src"))
)

from drain3.template_miner import TemplateMiner
from metadata_extractor import extract_log_metadata

LOG_FILE = "apache_logs.log"
DURATION_SECONDS = 10
BATCH_SIZE = 5000


def read_logs():
    with open(LOG_FILE, encoding="utf-8") as f:
        return [line.strip() for line in f if line.strip()]


def setup_db(db_path):
    if os.path.exists(db_path):
        os.remove(db_path)
    conn = duckdb.connect(db_path)
    conn.execute("""
        CREATE TABLE logs (
            workspace_id VARCHAR,
            source_id VARCHAR,
            line_id BIGINT,
            raw_text VARCHAR,
            timestamp VARCHAR,
            level VARCHAR,
            cluster_id VARCHAR,
            facets VARCHAR,
            processed BOOLEAN
        )
    """)
    conn.execute("""
        CREATE TABLE clusters (
            workspace_id VARCHAR,
            cluster_id VARCHAR,
            template VARCHAR,
            count BIGINT,
            PRIMARY KEY (workspace_id, cluster_id)
        )
    """)
    return conn


def run_benchmark(name, db_path, insert_func, logs):
    print(f"--- Starting: {name} ---")
    conn = setup_db(db_path)
    miner = TemplateMiner()

    # Train on first 200 logs
    print("Pre-training Drain3 on 200 lines...")
    for log in logs[:200]:
        meta = extract_log_metadata(log)
        miner.add_log_message(meta["message"])

    print(f"Running for exactly {DURATION_SECONDS} seconds...")
    start_time = time.time()
    total_processed = 0

    log_count = len(logs)
    batch_data = []
    cluster_increments = {}

    while time.time() - start_time < DURATION_SECONDS:
        # Pick the next log (looping over the 10k file indefinitely)
        raw_text = logs[total_processed % log_count]

        # 1. Extract & Tag
        meta = extract_log_metadata(raw_text)
        match = miner.match(meta["message"])

        cluster_id = None
        template = None
        facets = {}

        if match:
            cluster_id = str(match.cluster_id)
            template = match.get_template()
            try:
                params = miner.extract_parameters(template, meta["message"], exact_matching=False)
                if params:
                    for p in params:
                        facets[p.mask_name.strip("<>").lower()] = p.value
            except Exception:
                pass

            key = ("ws1", cluster_id, template)
            cluster_increments[key] = cluster_increments.get(key, 0) + 1

        # 2. Append to batch
        batch_data.append(
            (
                "ws1",
                "src1",
                total_processed,
                raw_text,
                meta["timestamp"],
                meta["level"],
                cluster_id,
                json.dumps(facets),
                True,
            )
        )

        total_processed += 1

        # 3. Insert Batch if full
        if len(batch_data) >= BATCH_SIZE:
            insert_func(conn, batch_data, cluster_increments)
            batch_data = []
            cluster_increments = {}

    # Final insert
    if batch_data:
        insert_func(conn, batch_data, cluster_increments)

    conn.close()

    actual_time = time.time() - start_time
    speed = total_processed / actual_time

    print(f"Total lines processed: {total_processed}")
    print(f"Time elapsed: {actual_time:.2f} seconds")
    print(f"Speed: {speed:.2f} lines/sec")
    print(f"File Size: {os.path.getsize(db_path) / (1024 * 1024):.2f} MB")
    print()


# --- Insertion Strategies ---


def insert_executemany(conn, batch_data, cluster_increments):
    cursor = conn.cursor()
    cursor.execute("BEGIN TRANSACTION")
    cursor.executemany(
        "INSERT INTO logs (workspace_id, source_id, line_id, raw_text, timestamp, level, cluster_id, facets, processed) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        batch_data,
    )
    for (ws_id, cluster_id, template), count in cluster_increments.items():
        cursor.execute(
            """
            INSERT INTO clusters (workspace_id, cluster_id, template, count)
            VALUES (?, ?, ?, ?)
            ON CONFLICT (workspace_id, cluster_id)
            DO UPDATE SET count = clusters.count + excluded.count, template = excluded.template
            """,
            (ws_id, cluster_id, template, count),
        )
    cursor.execute("COMMIT")


def insert_pandas(conn, batch_data, cluster_increments):
    df_logs = pd.DataFrame(  # noqa: F841
        batch_data,
        columns=[
            "workspace_id",
            "source_id",
            "line_id",
            "raw_text",
            "timestamp",
            "level",
            "cluster_id",
            "facets",
            "processed",
        ],
    )

    cluster_data = [(w, c, t, count) for (w, c, t), count in cluster_increments.items()]
    df_clusters = pd.DataFrame(
        cluster_data, columns=["workspace_id", "cluster_id", "template", "count"]
    )

    cursor = conn.cursor()
    cursor.execute("BEGIN TRANSACTION")
    cursor.execute("INSERT INTO logs SELECT * FROM df_logs")

    if not df_clusters.empty:
        # UPSERT is slightly tricky with dataframes, we can create a temp table and UPSERT from it
        cursor.execute("CREATE TEMP TABLE temp_clusters AS SELECT * FROM df_clusters")
        cursor.execute("""
            INSERT INTO clusters (workspace_id, cluster_id, template, count)
            SELECT workspace_id, cluster_id, template, count FROM temp_clusters
            ON CONFLICT (workspace_id, cluster_id)
            DO UPDATE SET count = clusters.count + excluded.count, template = excluded.template
        """)
        cursor.execute("DROP TABLE temp_clusters")

    cursor.execute("COMMIT")


def insert_arrow(conn, batch_data, cluster_increments):
    # PyArrow is generally the fastest for DuckDB
    # Convert list of tuples to list of columns
    cols = list(zip(*batch_data, strict=False))

    arrow_logs = pa.Table.from_arrays(  # noqa: F841
        [pa.array(c) for c in cols],
        names=[
            "workspace_id",
            "source_id",
            "line_id",
            "raw_text",
            "timestamp",
            "level",
            "cluster_id",
            "facets",
            "processed",
        ],
    )

    cluster_data = [(w, c, t, count) for (w, c, t), count in cluster_increments.items()]
    if cluster_data:
        c_cols = list(zip(*cluster_data, strict=False))
        arrow_clusters = pa.Table.from_arrays(
            [pa.array(c) for c in c_cols], names=["workspace_id", "cluster_id", "template", "count"]
        )
    else:
        arrow_clusters = None

    cursor = conn.cursor()
    cursor.execute("BEGIN TRANSACTION")
    cursor.execute("INSERT INTO logs SELECT * FROM arrow_logs")

    if arrow_clusters:
        cursor.execute("CREATE TEMP TABLE temp_clusters AS SELECT * FROM arrow_clusters")
        cursor.execute("""
            INSERT INTO clusters (workspace_id, cluster_id, template, count)
            SELECT workspace_id, cluster_id, template, count FROM temp_clusters
            ON CONFLICT (workspace_id, cluster_id)
            DO UPDATE SET count = clusters.count + excluded.count, template = excluded.template
        """)
        cursor.execute("DROP TABLE temp_clusters")

    cursor.execute("COMMIT")


if __name__ == "__main__":
    logs = read_logs()
    if not logs:
        print("No logs found.")
        sys.exit(1)

    print(f"Loaded {len(logs)} logs from memory.")
    print("--------------------------------------------------\n")

    run_benchmark(
        "Approach A: Native execute_many", "test_executemany.duckdb", insert_executemany, logs
    )
    run_benchmark("Approach B: Pandas DataFrame", "test_pandas.duckdb", insert_pandas, logs)
    run_benchmark("Approach C: PyArrow Table", "test_arrow.duckdb", insert_arrow, logs)
