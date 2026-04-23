import os

import duckdb

SOURCE_DB = r"i:\01-Master_Code\Apps\LogLensAi\data\loglens_tauri.duckdb"
TARGET_DB = r"i:\01-Master_Code\Apps\LogLensAi\data\loglens.duckdb"


def migrate():
    if not os.path.exists(SOURCE_DB):
        print(f"Source DB {SOURCE_DB} not found.")
        return

    conn = duckdb.connect(TARGET_DB)
    try:
        conn.execute(f"ATTACH '{SOURCE_DB}' AS s")

        # Clear main logs if they are 0
        count = conn.execute("SELECT COUNT(*) FROM logs").fetchone()[0]
        if count == 0:
            print("Target logs empty, copying everything...")
            # We use a temp table to avoid sequence conflicts if any
            conn.execute("CREATE TABLE logs_backup AS SELECT * FROM s.logs")
            conn.execute("DELETE FROM logs")
            conn.execute("INSERT INTO logs SELECT * FROM logs_backup")
            conn.execute("DROP TABLE logs_backup")
            print("Logs migrated.")
        else:
            print(f"Target already has {count} logs. Skipping log migration to avoid conflicts.")

        # Clusters
        conn.execute(
            "INSERT INTO main.clusters SELECT * FROM s.clusters WHERE NOT EXISTS (SELECT 1 FROM main.clusters t WHERE t.workspace_id = s.clusters.workspace_id AND t.cluster_id = s.clusters.cluster_id)"
        )
        print("Clusters merged.")

        # Settings
        s_count = conn.execute("SELECT COUNT(*) FROM settings").fetchone()[0]
        if s_count == 0:
            conn.execute("INSERT INTO settings SELECT * FROM s.settings")
            print("Settings migrated.")

        conn.commit()
    except Exception as e:
        print(f"Error: {e}")
    finally:
        conn.close()


if __name__ == "__main__":
    migrate()
