import contextlib
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
        self._setup_schema(cursor)
        self._run_migrations(cursor)
        self._initialize_cluster_cache(cursor)

    def _setup_schema(self, cursor):
        """Initial table and sequence creation."""
        cursor.execute("CREATE SEQUENCE IF NOT EXISTS log_id_seq;")
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
                time_shift_seconds INTEGER DEFAULT 0,
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
                provider_session_id TEXT,
                created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                last_modified TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS ai_messages (
                id           INTEGER PRIMARY KEY DEFAULT nextval('log_id_seq'),
                session_id   TEXT,
                role         TEXT,
                content      TEXT,
                context_logs TEXT,
                timestamp    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                provider_session_id TEXT
            );

            CREATE TABLE IF NOT EXISTS ai_memory (
                workspace_id TEXT,
                issue_signature TEXT,
                resolution TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (workspace_id, issue_signature)
            );

            CREATE TABLE IF NOT EXISTS temporal_offsets (
                workspace_id TEXT,
                source_id    TEXT,
                offset_seconds INTEGER DEFAULT 0,
                PRIMARY KEY (workspace_id, source_id)
            );
        """)

    def _run_migrations(self, cursor):
        """Handle schema evolution for existing databases."""
        self._migrate_ai_tables(cursor)
        self._migrate_fusion_pk(cursor)
        self._migrate_fusion_time_shift(cursor)
        self._migrate_log_columns(cursor)

    def _migrate_ai_tables(self, cursor):
        """Ensure AI session/message tables have latest columns."""
        # Fix column names if using old temporary names
        try:
            cursor.execute("SELECT name FROM ai_sessions LIMIT 1")
        except Exception:
            with contextlib.suppress(Exception):
                cursor.execute("ALTER TABLE ai_sessions RENAME COLUMN title TO name")

        try:
            cursor.execute("SELECT last_modified FROM ai_sessions LIMIT 1")
        except Exception:
            with contextlib.suppress(Exception):
                cursor.execute(
                    "ALTER TABLE ai_sessions RENAME COLUMN last_updated TO last_modified"
                )

        # Add missing columns
        for table, col in [
            ("ai_sessions", "provider_session_id"),
            ("ai_messages", "provider_session_id"),
        ]:
            try:
                cursor.execute(f"SELECT {col} FROM {table} LIMIT 1")
            except Exception:
                cursor.execute(f"ALTER TABLE {table} ADD COLUMN {col} TEXT")

        # Add ai_memory table if it doesn't exist
        try:
            cursor.execute("SELECT workspace_id FROM ai_memory LIMIT 1")
        except Exception:
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS ai_memory (
                    workspace_id TEXT,
                    issue_signature TEXT,
                    resolution TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    PRIMARY KEY (workspace_id, issue_signature)
                );
            """)

    def _migrate_fusion_pk(self, cursor):
        """Migrate fusion_configs to new composite PK including fusion_id."""
        try:
            cursor.execute(
                "SELECT k.name FROM pragma_table_info('fusion_configs') k WHERE k.pk > 0"
            )
            pk_cols = [row[0] for row in cursor.fetchall()]

            if "fusion_id" not in pk_cols:
                print("[DB] Migrating fusion_configs to update Primary Key...")
                cursor.execute(
                    "CREATE TEMP TABLE fusion_configs_backup AS SELECT * FROM fusion_configs"
                )
                cursor.execute("DROP TABLE fusion_configs")
                self._setup_schema(cursor)  # Re-creates with new PK structure

                cursor.execute("PRAGMA table_info('fusion_configs_backup')")
                backup_cols = [row[1] for row in cursor.fetchall()]

                if "fusion_id" in backup_cols:
                    cursor.execute("""
                        INSERT INTO fusion_configs (workspace_id, fusion_id, source_id, enabled, tz_offset, custom_format, parser_config)
                        SELECT workspace_id, fusion_id, source_id, enabled, tz_offset, custom_format, parser_config FROM fusion_configs_backup
                    """)
                else:
                    cursor.execute("""
                        INSERT INTO fusion_configs (workspace_id, fusion_id, source_id, enabled, tz_offset, custom_format, parser_config)
                        SELECT workspace_id, 'default', source_id, enabled, tz_offset, custom_format, parser_config FROM fusion_configs_backup
                    """)
                cursor.execute("DROP TABLE fusion_configs_backup")
        except Exception as e:
            print(f"[DB] Error migrating fusion_configs: {e}")

    def _migrate_fusion_time_shift(self, cursor):
        """Add time_shift_seconds column to fusion_configs."""
        try:
            cursor.execute("SELECT time_shift_seconds FROM fusion_configs LIMIT 1")
        except Exception:
            print("[DB] Adding time_shift_seconds to fusion_configs...")
            cursor.execute(
                "ALTER TABLE fusion_configs ADD COLUMN time_shift_seconds INTEGER DEFAULT 0"
            )

    def _migrate_log_columns(self, cursor):
        """Add missing source_id and defaults to logs table."""
        try:
            cursor.execute("SELECT source_id FROM logs LIMIT 1")
        except Exception:
            cursor.execute("ALTER TABLE logs ADD COLUMN source_id TEXT")

        with contextlib.suppress(Exception):
            cursor.execute("ALTER TABLE logs ALTER id SET DEFAULT nextval('log_id_seq')")

    def _initialize_cluster_cache(self, cursor):
        """Warm up the clusters table from existing log data if empty."""
        try:
            cursor.execute("SELECT count(*) FROM clusters")
            if cursor.fetchone()[0] == 0:
                print("[DB] Initializing clusters cache...")
                cursor.execute("""
                    INSERT INTO clusters (workspace_id, cluster_id, template, count)
                    SELECT workspace_id, cluster_id, 'Pattern ' || cluster_id, count(*)
                    FROM logs WHERE cluster_id IS NOT NULL GROUP BY workspace_id, cluster_id
                """)
        except Exception as e:
            print(f"[DB] Cluster cache initialization failure: {e}")

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
