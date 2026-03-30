import os
import threading
from typing import Any

import duckdb


class Database:
    _instance = None
    _lock = threading.Lock()

    def __new__(cls, db_path="loglens.duckdb"):
        with cls._lock:
            if cls._instance is None:
                cls._instance = super().__new__(cls)
                cls._instance._init_db(db_path)
        return cls._instance

    def _init_db(self, db_path):
        self.conn: Any = None
        # Memory mode is allowed for tests, else absolute path
        if db_path != ":memory:":
            db_path = os.path.abspath(db_path)

        try:
            self.conn = duckdb.connect(db_path)
        except Exception as e:
            # BUG-001 / STAB-003 Resolution: Robust WAL Recovery
            # If the database was crashed abruptly, replaying the WAL may fail.
            # In dev/local mode, we attempt to recover by flushing the WAL.
            if db_path != ":memory:":
                wal_path = f"{db_path}.wal"
                if os.path.exists(wal_path):
                    print(f"[DB] WAL replay failed: {e}")
                    print(f"[DB] Attempting recovery by removing WAL file: {wal_path}")
                    try:
                        os.remove(wal_path)
                        self.conn = duckdb.connect(db_path)
                        print("[DB] Recovery successful.")
                        self._create_tables()
                        return
                    except Exception as retry_err:
                        print(f"[DB] Recovery failed: {retry_err}")
            raise e

        self._create_tables()

    def _create_tables(self):
        cursor = self.get_cursor()

        # 1. Ensure sequence exists first
        cursor.execute("CREATE SEQUENCE IF NOT EXISTS log_id_seq;")

        # 2. Create tables if they don't exist
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS logs (
                id        INTEGER PRIMARY KEY DEFAULT nextval('log_id_seq'),
                workspace_id TEXT,
                source_id    TEXT,
                timestamp    TEXT,
                level        TEXT,
                message      TEXT,
                cluster_id   TEXT,
                raw_text     TEXT,
                has_comment  BOOLEAN DEFAULT FALSE,
                comment      TEXT
            );

            CREATE TABLE IF NOT EXISTS settings (
                key   TEXT PRIMARY KEY,
                value TEXT
            );

            CREATE TABLE IF NOT EXISTS clusters (
                workspace_id TEXT,
                cluster_id   TEXT,
                template     TEXT,
                count        INTEGER DEFAULT 0,
                PRIMARY KEY (workspace_id, cluster_id)
            );

            CREATE TABLE IF NOT EXISTS fusion_configs (
                workspace_id TEXT,
                fusion_id    TEXT DEFAULT 'default',
                source_id    TEXT,
                enabled      BOOLEAN DEFAULT TRUE,
                tz_offset    INTEGER DEFAULT 0,
                custom_format TEXT,
                parser_config TEXT,
                PRIMARY KEY (workspace_id, fusion_id, source_id)
            );

            CREATE TABLE IF NOT EXISTS ai_sessions (
                session_id   TEXT PRIMARY KEY,
                workspace_id TEXT,
                name         TEXT,
                provider     TEXT,
                model        TEXT,
                created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                last_modified TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS ai_messages (
                id           INTEGER PRIMARY KEY DEFAULT nextval('log_id_seq'),
                session_id   TEXT,
                role         TEXT,
                content      TEXT,
                context_logs TEXT, -- JSON array of log IDs
                timestamp    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)

        # 3. Migrations for existing databases
        
        # Check for AI tables in existing DB and add them if missing
        # (IF NOT EXISTS in CREATE TABLE already handles this, but some older DuckDB versions 
        # might need explicit checks if combined in a multi-statement block)
        
        # Ensure name column exists in ai_sessions (if it was created with title before)
        try:
            cursor.execute("SELECT name FROM ai_sessions LIMIT 1")
        except Exception:
            try:
                cursor.execute("ALTER TABLE ai_sessions RENAME COLUMN title TO name")
            except Exception:
                pass # Table might not exist yet or other issue, creation handled above
        
        # Ensure last_modified column exists in ai_sessions
        try:
            cursor.execute("SELECT last_modified FROM ai_sessions LIMIT 1")
        except Exception:
            try:
                cursor.execute("ALTER TABLE ai_sessions RENAME COLUMN last_updated TO last_modified")
            except Exception:
                pass
        
        # Add parser_config column to fusion_configs if missing
        try:
            cursor.execute("SELECT parser_config FROM fusion_configs LIMIT 1")
        except Exception:
            cursor.execute("ALTER TABLE fusion_configs ADD COLUMN parser_config TEXT")

        # Add fusion_id column to fusion_configs if missing
        try:
            cursor.execute("SELECT fusion_id FROM fusion_configs LIMIT 1")
        except Exception:
            cursor.execute("ALTER TABLE fusion_configs ADD COLUMN fusion_id TEXT DEFAULT 'default'")
            # Note: We can't easily change composite PK in DuckDB without recreating, 
            # but 'ALTER' will suffice for column existence. New installs get the proper PK.

        # Add source_id column if missing to logs
        try:
            cursor.execute("SELECT source_id FROM logs LIMIT 1")
        except Exception:
            cursor.execute("ALTER TABLE logs ADD COLUMN source_id TEXT")
            
        # Ensure id column has the sequence default attached
        try:
            # DuckDB syntax to update default on existing column
            cursor.execute("ALTER TABLE logs ALTER id SET DEFAULT nextval('log_id_seq')")
        except Exception:
            pass # Already has default or table is empty/new

        # 4. Data migration: populate clusters table from existing logs if empty
        try:
            cursor.execute("SELECT count(*) FROM clusters")
            if cursor.fetchone()[0] == 0:
                print("[DB] Initializing clusters cache from existing logs...")
                cursor.execute("""
                    INSERT INTO clusters (workspace_id, cluster_id, template, count)
                    SELECT workspace_id, cluster_id, 'Pattern ' || cluster_id, count(*)
                    FROM logs
                    WHERE cluster_id IS NOT NULL
                    GROUP BY workspace_id, cluster_id
                """)
                print("[DB] Cluster cache initialized.")
        except Exception as e:
            print(f"[DB] Cluster cache initialization skipped: {e}")

    def get_cursor(self):
        # BUG-001 Fix: Use thread-local cursor for DuckDB thread safety
        return self.conn.cursor()

    def commit(self):
        """Thread-safe commit for DuckDB write operations."""
        self.conn.commit()

    @classmethod
    def reset(cls):
        with cls._lock:
            if cls._instance is not None:
                if hasattr(cls._instance, "conn"):
                    cls._instance.conn.close()
                cls._instance = None
