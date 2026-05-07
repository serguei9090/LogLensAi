import os
import json
import duckdb
import argparse
from datetime import datetime

# Path Configuration
PROJECT_ROOT = os.getcwd()
DB_PATH = os.path.join(PROJECT_ROOT, "data", "loglens.duckdb")
LOG_DIR = os.path.join(PROJECT_ROOT, "scripts", "logs")

def ensure_log_dir():
    if not os.path.exists(LOG_DIR):
        os.makedirs(LOG_DIR)

def get_db_inspector(verbose=False):
    if not os.path.exists(DB_PATH):
        return {"error": f"Database not found at {DB_PATH}"}

    try:
        # Use read_only=True and specifically handle the 'access denied' case
        # DuckDB 1.2+ usually allows multiple readers, but an exclusive writer can block it.
        conn = duckdb.connect(DB_PATH, read_only=True, config={'access_mode': 'read_only'})
        cursor = conn.cursor()

        # --- Summary Stats (Always Included) ---
        
        # Workspace IDs and Log Counts
        cursor.execute("SELECT workspace_id, COUNT(*) as log_count FROM logs GROUP BY workspace_id")
        workspace_logs = {str(r[0]): r[1] for r in cursor.fetchall()}
        
        # Log Sources
        cursor.execute("SELECT COUNT(*) FROM log_sources")
        total_sources = cursor.fetchone()[0]
        
        # Clusters (Patterns)
        cursor.execute("SELECT COUNT(*) FROM clusters")
        total_clusters = cursor.fetchone()[0]

        # All Table Counts
        tables = [
            "logs", "clusters", "log_sources", "folders", 
            "log_streams", "workspace_settings", "settings",
            "temporal_offsets", "fusion_configs", "ai_sessions"
        ]
        table_counts = {}
        for table in tables:
            try:
                cursor.execute(f"SELECT COUNT(*) FROM {table}")
                table_counts[table] = cursor.fetchone()[0]
            except:
                table_counts[table] = "missing/error"

        summary = {
            "status": "success",
            "timestamp": datetime.now().isoformat(),
            "database": DB_PATH,
            "metrics": {
                "workspace_count": len(workspace_logs),
                "total_logs": table_counts.get("logs", 0),
                "total_sources": total_sources,
                "total_clusters": total_clusters,
                "table_row_counts": table_counts
            },
            "workspaces": [
                {"id": ws_id, "logs": count} for ws_id, count in workspace_logs.items()
            ]
        }

        # --- Verbose Details (Conditional) ---
        if verbose:
            details = {}
            # Log Source Details
            cursor.execute("SELECT workspace_id, id, name, type, path FROM log_sources")
            details["log_sources"] = [
                {"workspace_id": str(r[0]), "id": str(r[1]), "name": r[2], "type": r[3], "path": r[4]} 
                for r in cursor.fetchall()
            ]
            
            # Sample Logs (Top 5 per workspace)
            samples = {}
            for ws_id in workspace_logs.keys():
                cursor.execute(f"SELECT * FROM logs WHERE workspace_id = '{ws_id}' LIMIT 5")
                cols = [d[0] for d in cursor.description]
                rows = cursor.fetchall()
                samples[ws_id] = [dict(zip(cols, r)) for r in rows]
            details["log_samples"] = samples
            
            summary["details"] = details

        return summary

    except Exception as e:
        return {"status": "error", "error": str(e)}
    finally:
        if 'conn' in locals():
            conn.close()

def main():
    parser = argparse.ArgumentParser(description="LogLens Database Inspector")
    parser.add_argument("-v", "--verbose", action="store_true", help="Include detailed samples and metadata")
    parser.add_argument("-o", "--output", help="Custom output filename in scripts/logs/")
    args = parser.parse_args()

    ensure_log_dir()
    
    result = get_db_inspector(verbose=args.verbose)
    
    # Generate Output Filename
    suffix = "verbose" if args.verbose else "summary"
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = args.output if args.output else f"db_inspect_{suffix}_{timestamp}.json"
    output_path = os.path.join(LOG_DIR, filename)
    
    # Save to File
    with open(output_path, "w") as f:
        json.dump(result, f, indent=2, default=str)
    
    # Print Summary to Console
    print(f"\n[DB Inspector] Result exported to: {output_path}")
    if "metrics" in result:
        m = result["metrics"]
        print(f"  - Workspaces: {m['workspace_count']}")
        print(f"  - Total Logs: {m['total_logs']}")
        print(f"  - Total Sources: {m['total_sources']}")
    elif "error" in result:
        print(f"  - Error: {result['error']}")

if __name__ == "__main__":
    main()
