import argparse
import os

import duckdb

# Path Configuration
PROJECT_ROOT = os.getcwd()
DB_PATH = os.path.join(PROJECT_ROOT, "data", "loglens.duckdb")


def wipe_logs(force=False):
    if not os.path.exists(DB_PATH):
        print(f"[Error] Database not found at {DB_PATH}")
        return

    if not force:
        confirm = input("Are you sure you want to wipe all logs, sources, and clusters? (y/N): ")
        if confirm.lower() != "y":
            print("Aborted.")
            return

    try:
        # Connect in read-write mode
        conn = duckdb.connect(DB_PATH)

        # Tables to wipe (Data that changes frequently)
        tables_to_wipe = [
            "logs",
            "log_sources",
            "clusters",
            "log_streams",
            "anomalies",
            "ingestion_jobs",
            "ai_messages",
            "ai_sessions",
        ]

        print(f"[Wipe] Cleaning database at {DB_PATH}...")

        for table in tables_to_wipe:
            try:
                # Check if table exists
                exists = conn.execute(
                    f"SELECT count(*) FROM information_schema.tables WHERE table_name = '{table}'"
                ).fetchone()[0]
                if exists:
                    count = conn.execute(f"SELECT count(*) FROM {table}").fetchone()[0]
                    conn.execute(f"DELETE FROM {table}")
                    print(f"  - Table '{table}': Cleared {count} rows.")
                else:
                    print(f"  - Table '{table}': Does not exist, skipping.")
            except Exception as e:
                print(f"  - Table '{table}': Error - {str(e)}")

        # Vacuum to reclaim space
        conn.execute("CHECKPOINT")
        print("[Success] Database wiped successfully. Workspaces and settings were preserved.")

    except Exception as e:
        print(f"[Error] Failed to wipe database: {str(e)}")
        print("Tip: Make sure the app and sidecar are closed so the file isn't locked.")
    finally:
        if "conn" in locals():
            conn.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Wipe logs and sources from LogLens database")
    parser.add_argument("--force", action="store_true", help="Skip confirmation prompt")
    args = parser.parse_args()

    wipe_logs(force=args.force)
