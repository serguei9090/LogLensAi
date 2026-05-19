import os
import duckdb

def inspect_db(path):
    print(f"=== Inspecting {path} ===")
    if not os.path.exists(path):
        print("File does not exist.")
        return
    try:
        conn = duckdb.connect(path, read_only=True)
        cursor = conn.cursor()
        
        # List tables
        cursor.execute("SELECT table_name FROM information_schema.tables WHERE table_schema='main';")
        tables = [r[0] for r in cursor.fetchall()]
        print(f"Tables: {tables}")
        
        for table in tables:
            try:
                cursor.execute(f"SELECT count(*) FROM {table}")
                count = cursor.fetchone()[0]
                print(f"  {table}: {count} rows")
            except Exception as e:
                print(f"  Failed to get count for {table}: {e}")
                
        # Also print folders and log sources if any
        if 'folders' in tables:
            cursor.execute("SELECT id, workspace_id, name, parent_id FROM folders")
            folders = cursor.fetchall()
            if folders:
                print("  Folders:")
                for f in folders:
                    print(f"    - {f}")
        if 'log_sources' in tables:
            cursor.execute("SELECT id, workspace_id, name, path FROM log_sources")
            sources = cursor.fetchall()
            if sources:
                print("  Log Sources:")
                for s in sources:
                    print(f"    - {s}")
        conn.close()
    except Exception as e:
        print(f"Error: {e}")
    print()

def main():
    db_paths = [
        r"i:\01-Master_Code\Apps\LogLensAi\data\loglens.duckdb",
        r"i:\01-Master_Code\Apps\LogLensAi\src-tauri\loglens.duckdb",
        r"i:\01-Master_Code\Apps\LogLensAi\src-tauri\loglens_tauri.duckdb"
    ]
    for path in db_paths:
        inspect_db(path)

if __name__ == "__main__":
    main()
