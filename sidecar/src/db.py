import contextlib
import json
import logging
import os
import threading
from datetime import datetime, timedelta
from typing import Any

import duckdb
from query_parser import parse_llql

logger = logging.getLogger(__name__)


MEMORY_DB = ":memory:"


class LogDatabase:
    _instance = None
    _lock = threading.Lock()

    def __new__(cls, db_path=None):
        with cls._lock:
            if cls._instance is None:
                if db_path is None:
                    # In extreme cases, fallback to a memory DB rather than creating a random file
                    db_path = MEMORY_DB
                instance = super().__new__(cls)
                instance._init_db(db_path)
                cls._instance = instance
        return cls._instance

    def _init_db(self, db_path):
        self.db_path = db_path
        if db_path != MEMORY_DB:
            self.db_path = os.path.abspath(db_path)

        self._local = threading.local()
        # Initialize the first connection to create tables
        conn = self._get_conn()
        self._create_tables(conn)

    def _get_conn(self):
        # Memory DBs MUST share the same connection object to see the same data.
        # File-based DBs should use thread-local connections to avoid transaction interference.
        if self.db_path == MEMORY_DB:
            if not hasattr(self, "_shared_conn") or self._shared_conn is None:
                self._shared_conn = duckdb.connect(self.db_path)
            return self._shared_conn

        if not hasattr(self._local, "conn"):
            try:
                # Use the same db_path for all connections
                self._local.conn = duckdb.connect(self.db_path)
            except Exception as e:
                if self.db_path != MEMORY_DB:
                    wal_path = f"{self.db_path}.wal"
                    if os.path.exists(wal_path):
                        logger.warning("[DB] WAL replay failed: %s", e)
                        try:
                            os.remove(wal_path)
                            self._local.conn = duckdb.connect(self.db_path)
                            return self._local.conn
                        except Exception:
                            pass
                raise e
        return self._local.conn

    def get_cursor(self):
        return self._get_conn().cursor()

    def commit(self):
        self._get_conn().commit()

    def _create_tables(self, conn):
        cursor = conn.cursor()
        self._setup_schema(cursor)
        self._run_migrations(cursor)
        self._initialize_cluster_cache(cursor)

    def _setup_schema(self, cursor):
        """Initial table and sequence creation.

        Each table with a synthetic integer PK gets its own dedicated sequence
        to prevent cross-table ID collisions (the root cause of the duplicate-key
        ConstraintException observed when ingesting logs across multiple workspaces).
        """
        # Dedicated sequences — one per table that needs a synthetic PK.
        cursor.execute("CREATE SEQUENCE IF NOT EXISTS log_id_seq;")
        cursor.execute("CREATE SEQUENCE IF NOT EXISTS log_streams_id_seq;")
        cursor.execute("CREATE SEQUENCE IF NOT EXISTS ai_messages_id_seq;")
        cursor.execute("CREATE SEQUENCE IF NOT EXISTS settings_templates_id_seq;")
        cursor.execute("CREATE SEQUENCE IF NOT EXISTS ingestion_jobs_id_seq;")
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS logs (
                id           INTEGER PRIMARY KEY DEFAULT nextval('log_id_seq'),
                workspace_id TEXT,
                source_id    TEXT,
                line_id      INTEGER,
                raw_text     TEXT,
                timestamp    TEXT,
                level        TEXT,
                cluster_id   TEXT,
                has_comment  BOOLEAN DEFAULT FALSE,
                comment      TEXT,
                facets       JSON,
                processed    BOOLEAN DEFAULT FALSE
            );
        """)

        # --- MIGRATIONS (Vibe Shift v0.12.0) ---
        # 1. Add raw_text column if it doesn't exist
        cursor.execute("PRAGMA table_info('logs')")
        columns = [row[1] for row in cursor.fetchall()]
        if "raw_text" not in columns:
            logger.info("[DB] Migrating: Adding 'raw_text' column to logs table")
            cursor.execute("ALTER TABLE logs ADD COLUMN raw_text TEXT")

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS ingestion_jobs (
                id           INTEGER PRIMARY KEY DEFAULT nextval('ingestion_jobs_id_seq'),
                workspace_id TEXT,
                source_id    TEXT,
                status       TEXT DEFAULT 'pending', -- pending, processing, completed, failed
                total_lines  INTEGER DEFAULT 0,
                processed_lines INTEGER DEFAULT 0,
                last_log_id  INTEGER DEFAULT NULL,
                created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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

            CREATE TABLE IF NOT EXISTS log_streams (
                id           INTEGER PRIMARY KEY DEFAULT nextval('log_streams_id_seq'),
                workspace_id TEXT,
                name         TEXT,
                type         TEXT,
                port         INTEGER,
                enabled      BOOLEAN DEFAULT TRUE,
                created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS ai_messages (
                id           INTEGER PRIMARY KEY DEFAULT nextval('ai_messages_id_seq'),
                session_id   TEXT,
                role         TEXT,
                content      TEXT,
                a2ui_payload TEXT,
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

            CREATE TABLE IF NOT EXISTS workspace_settings (
                workspace_id TEXT,
                key          TEXT,
                value        TEXT,
                PRIMARY KEY (workspace_id, key)
            );

            CREATE TABLE IF NOT EXISTS settings_templates (
                id           INTEGER PRIMARY KEY DEFAULT nextval('settings_templates_id_seq'),
                workspace_id TEXT,
                name         TEXT,
                config_json  TEXT,
                created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS anomalies (
                workspace_id TEXT,
                cluster_id   TEXT,
                timestamp    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                z_score      FLOAT,
                current_rate FLOAT,
                mean_rate    FLOAT,
                PRIMARY KEY (workspace_id, cluster_id, timestamp)
            );

            CREATE TABLE IF NOT EXISTS folders (
                id           TEXT PRIMARY KEY,
                workspace_id TEXT,
                parent_id    TEXT,
                name         TEXT,
                created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS log_sources (
                id           TEXT PRIMARY KEY,
                workspace_id TEXT,
                folder_id    TEXT,
                name         TEXT,
                type         TEXT,
                path         TEXT,
                created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            -- Performance Indexes
            CREATE INDEX IF NOT EXISTS idx_logs_workspace_id ON logs (workspace_id);
            CREATE INDEX IF NOT EXISTS idx_logs_source_id ON logs (source_id);
            CREATE INDEX IF NOT EXISTS idx_logs_timestamp ON logs (timestamp);
            CREATE INDEX IF NOT EXISTS idx_logs_cluster_id ON logs (cluster_id);
            CREATE INDEX IF NOT EXISTS idx_logs_processed ON logs (processed);
            CREATE INDEX IF NOT EXISTS idx_ai_messages_session_id ON ai_messages (session_id);
        """)

    def _run_migrations(self, cursor):
        """Handle schema evolution for existing databases."""
        self._migrate_ai_tables(cursor)
        self._migrate_fusion_pk(cursor)
        self._migrate_fusion_time_shift(cursor)
        self._migrate_log_columns(cursor)
        self._migrate_log_facets(cursor)
        self._migrate_ingestion_columns(cursor)
        self._migrate_ingestion_jobs(cursor)
        self._migrate_fast_path_schema(cursor)
        self._migrate_indexes(cursor)

    def _migrate_fast_path_schema(self, cursor):
        """Migration: upgrade existing logs table to the Skinny / Fast-Path schema.

        Old schema had ``raw_text TEXT`` and ``message TEXT`` columns.
        New schema replaces them with ``line_id INTEGER`` — a pointer into the
        source's flat file under ``data/storage/``.

        Strategy (DuckDB)
        -----------------
        DuckDB ≥1.0 supports ``ALTER TABLE … DROP COLUMN`` natively when there
        are no dependent indexes.  We drop relevant indexes first, apply column
        changes, then rely on ``_migrate_indexes`` to recreate them.
        """
        # 1. Add line_id if missing
        cursor.execute(
            "SELECT count(*) FROM information_schema.columns"
            " WHERE table_name = 'logs' AND column_name = 'line_id'"
        )
        if cursor.fetchone()[0] == 0:
            logger.info("[DB] Fast-Path Migration: adding 'line_id' column...")
            try:
                cursor.execute("ALTER TABLE logs ADD COLUMN line_id INTEGER")
            except Exception as exc:
                logger.error("[DB] Fast-Path Migration (line_id): %s", exc)

        # 2. Add raw_text if missing (REVERSED: v0.12.0)
        cursor.execute(
            "SELECT count(*) FROM information_schema.columns"
            " WHERE table_name = 'logs' AND column_name = 'raw_text'"
        )
        if cursor.fetchone()[0] == 0:
            logger.info("[DB] Dual-Track Migration: adding 'raw_text' column back...")
            try:
                cursor.execute("ALTER TABLE logs ADD COLUMN raw_text TEXT")
            except Exception as exc:
                logger.error("[DB] Dual-Track Migration (raw_text): %s", exc)

        # 3. Drop message if it still exists
        cursor.execute(
            "SELECT count(*) FROM information_schema.columns"
            " WHERE table_name = 'logs' AND column_name = 'message'"
        )
        if cursor.fetchone()[0] > 0:
            logger.info("[DB] Fast-Path Migration: dropping 'message' column...")
            try:
                cursor.execute("ALTER TABLE logs DROP COLUMN message")
            except Exception as exc:
                logger.error("[DB] Fast-Path Migration (drop message): %s", exc)

    def _migrate_ingestion_columns(self, cursor):
        """Adds columns required for asynchronous ingestion and clustering."""
        cursor.execute(
            "SELECT count(*) FROM information_schema.columns WHERE table_name = 'logs' AND column_name = 'processed'"
        )
        if cursor.fetchone()[0] == 0:
            logger.info("[DB] Migration: Adding 'processed' column to 'logs' table...")
            # STAB-004: Drop dependent indexes before altering table to avoid DependencyException
            try:
                # We drop all common logs indexes to be safe
                cursor.execute("DROP INDEX IF EXISTS idx_logs_workspace_id")
                cursor.execute("DROP INDEX IF EXISTS idx_logs_source_id")
                cursor.execute("DROP INDEX IF EXISTS idx_logs_timestamp")
                cursor.execute("DROP INDEX IF EXISTS idx_logs_cluster_id")

                cursor.execute("ALTER TABLE logs ADD COLUMN processed BOOLEAN DEFAULT FALSE")
            except Exception as e:
                logger.error("[DB] Migration Error (logs.processed): %s", e)

        # Ensure performance index for the worker
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_logs_processed ON logs (processed)")

    def _migrate_ingestion_jobs(self, cursor):
        """Ensures source_id column exists in ingestion_jobs table."""
        try:
            # Check if source_id exists
            cursor.execute("SELECT source_id FROM ingestion_jobs LIMIT 1")
        except Exception:
            logger.info("[DB] Migration: Adding 'source_id' column to 'ingestion_jobs' table...")
            try:
                cursor.execute("ALTER TABLE ingestion_jobs ADD COLUMN source_id TEXT")
            except Exception as e:
                logger.error(
                    f"[DB] Migration Error (ingestion_jobs.source_id): {e}. Recreating table."
                )
                # Fallback: drop and recreate since ingestion_jobs is ephemeral
                cursor.execute("DROP TABLE IF EXISTS ingestion_jobs")
                self._setup_schema(cursor)

    def _migrate_indexes(self, cursor):
        """Ensure all performance indexes exist on legacy databases."""
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_logs_workspace_id ON logs (workspace_id);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_logs_source_id ON logs (source_id);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_logs_timestamp ON logs (timestamp);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_logs_cluster_id ON logs (cluster_id);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_logs_processed ON logs (processed);")
        cursor.execute(
            "CREATE INDEX IF NOT EXISTS idx_ai_messages_session_id ON ai_messages (session_id);"
        )
        cursor.execute(
            "CREATE INDEX IF NOT EXISTS idx_folders_workspace_id ON folders (workspace_id);"
        )
        cursor.execute(
            "CREATE INDEX IF NOT EXISTS idx_log_sources_workspace_id ON log_sources (workspace_id);"
        )

    def _migrate_ai_tables(self, cursor):
        """Ensure AI session/message tables have latest columns."""
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

        for table, col in [
            ("ai_sessions", "provider_session_id"),
            ("ai_messages", "provider_session_id"),
            ("ai_messages", "a2ui_payload"),
        ]:
            # Internal schema check - using variables for readability
            check_query = f"SELECT {col} FROM {table} LIMIT 1"
            try:
                cursor.execute(check_query)
            except Exception:
                alter_query = f"ALTER TABLE {table} ADD COLUMN {col} TEXT"
                cursor.execute(alter_query)

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
        try:
            cursor.execute(
                "SELECT k.name FROM pragma_table_info('fusion_configs') k WHERE k.pk > 0"
            )
            pk_cols = [row[0] for row in cursor.fetchall()]

            if "fusion_id" not in pk_cols:
                logger.info("[DB] Migrating fusion_configs to update Primary Key...")
                cursor.execute(
                    "CREATE TEMP TABLE fusion_configs_backup AS SELECT * FROM fusion_configs"
                )
                cursor.execute("DROP TABLE fusion_configs")
                self._setup_schema(cursor)

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
            logger.error("[DB] Error migrating fusion_configs: %s", e)

    def _migrate_fusion_time_shift(self, cursor):
        try:
            cursor.execute("SELECT time_shift_seconds FROM fusion_configs LIMIT 1")
        except Exception:
            logger.info("[DB] Adding time_shift_seconds to fusion_configs...")
            cursor.execute(
                "ALTER TABLE fusion_configs ADD COLUMN time_shift_seconds INTEGER DEFAULT 0"
            )

    def _migrate_log_columns(self, cursor):
        try:
            cursor.execute("SELECT source_id FROM logs LIMIT 1")
        except Exception:
            cursor.execute("ALTER TABLE logs ADD COLUMN source_id TEXT")

        # Ensure all per-table sequences exist on legacy databases that were
        # created before the dedicated-sequence migration.
        with contextlib.suppress(Exception):
            cursor.execute("CREATE SEQUENCE IF NOT EXISTS log_streams_id_seq;")
        with contextlib.suppress(Exception):
            cursor.execute("CREATE SEQUENCE IF NOT EXISTS ai_messages_id_seq;")
        with contextlib.suppress(Exception):
            cursor.execute("CREATE SEQUENCE IF NOT EXISTS settings_templates_id_seq;")

        with contextlib.suppress(Exception):
            cursor.execute("ALTER TABLE logs ALTER id SET DEFAULT nextval('log_id_seq')")

    def _migrate_log_facets(self, cursor):
        try:
            cursor.execute("SELECT facets FROM logs LIMIT 1")
        except Exception:
            logger.info("[DB] Adding facets column to logs table...")
            cursor.execute("ALTER TABLE logs ADD COLUMN facets JSON")

    def _initialize_cluster_cache(self, cursor):
        try:
            cursor.execute("SELECT count(*) FROM clusters")
            if cursor.fetchone()[0] == 0:
                logger.info("[DB] Initializing clusters cache...")
                cursor.execute("""
                    INSERT INTO clusters (workspace_id, cluster_id, template, count)
                    SELECT workspace_id, cluster_id, 'Pattern ' || cluster_id, count(*)
                    FROM logs WHERE cluster_id IS NOT NULL GROUP BY workspace_id, cluster_id
                """)
        except Exception as e:
            logger.error("[DB] Cluster cache initialization failure: %s", e)

    @classmethod
    def reset(cls):
        with cls._lock:
            if cls._instance is not None:
                # Close all connections in all threads is hard, but we can at least
                # close the one in the current thread if it exists.
                # Usually reset is called during shutdown/cleanup.
                if hasattr(cls._instance, "_shared_conn") and cls._instance._shared_conn:
                    cls._instance._shared_conn.close()
                    cls._instance._shared_conn = None
                if hasattr(cls._instance, "_local") and hasattr(cls._instance._local, "conn"):
                    cls._instance._local.conn.close()
                cls._instance = None

    def _get_filter_condition(self, field: str, op: str, value: Any) -> tuple[str, Any]:
        """Maps operator to SQL condition and parameter."""
        if op == "contains":
            return f"{field} ILIKE ?", f"%{value}%"
        if op == "not_contains":
            return f"{field} NOT ILIKE ?", f"%{value}%"
        if op == "equals":
            if "source_id" in field:
                return f"{field} ILIKE ?", value
            return f"{field} = ?", value
        if op == "not_equals":
            return f"{field} != ?", value
        if op == "starts_with":
            return f"{field} ILIKE ?", f"{value}%"
        if op == "regex":
            return f"regexp_matches({field}, ?)", value
        return "", None

    def _parse_filters(self, filters: list) -> tuple[list[str], list[Any]]:
        where_clauses = []
        params = []
        allowed_fields = ["level", "source_id", "cluster_id", "has_comment"]

        for f in filters:
            if hasattr(f, "model_dump"):
                f = f.model_dump()

            field = f.get("field")
            value = f.get("value")
            op = f.get("operator", "equals")

            if field.startswith("facets."):
                facet_key = field.split(".", 1)[1]
                field = f"json_extract_string(l.facets, '$.{facet_key}')"
            elif field not in allowed_fields or value is None:
                continue
            else:
                field = f"l.{field}"

            clause, param = self._get_filter_condition(field, op, value)
            if clause:
                where_clauses.append(clause)
                params.append(param)

        return where_clauses, params

    def _apply_temporal_offsets(self, workspace_id: str, logs: list[dict]):
        cursor = self.get_cursor()
        cursor.execute(
            "SELECT source_id, offset_seconds FROM temporal_offsets WHERE workspace_id = ?",
            (workspace_id,),
        )
        rows = cursor.fetchall()
        if not rows:
            return

        offsets = {row[0]: row[1] for row in rows}

        for log in logs:
            source_id = log.get("source_id")
            shift_sec = offsets.get(source_id, 0)
            if shift_sec != 0 and log.get("timestamp"):
                try:
                    ts_str = log["timestamp"]
                    if "T" in ts_str:
                        ts_str = ts_str.replace("T", " ")
                    dt = datetime.strptime(ts_str[:19], "%Y-%m-%d %H:%M:%S")
                    dt = dt + timedelta(seconds=shift_sec)
                    log["timestamp"] = dt.strftime("%Y-%m-%d %H:%M:%S")
                except Exception:
                    pass

    def _build_where_clauses(
        self,
        workspace_id: str,
        query: str = None,
        filters: list = None,
        source_ids: list = None,
        start_time: str = None,
        end_time: str = None,
    ) -> tuple[list[str], list[Any]]:
        """Constructs WHERE clauses and gathers parameters."""
        where_clauses = ["l.workspace_id = ?"]
        params = [workspace_id]

        if source_ids is not None:
            placeholders = ",".join(["?"] * len(source_ids))
            where_clauses.append(f"l.source_id IN ({placeholders})")
            params.extend(source_ids)

        if filters:
            f_clauses, f_params = self._parse_filters(filters)
            where_clauses.extend(f_clauses)
            params.extend(f_params)

        if query:
            llql_sql, llql_params = parse_llql(query)
            if llql_sql:
                where_clauses.append(f"({llql_sql})")
                params.extend(llql_params)

        if start_time:
            norm_start = start_time.replace("T", " ").split(".")[0].replace("Z", "")
            where_clauses.append("l.timestamp >= ?")
            params.append(norm_start)
        if end_time:
            norm_end = end_time.replace("T", " ").split(".")[0].replace("Z", "")
            where_clauses.append("l.timestamp <= ?")
            params.append(norm_end)

        return where_clauses, params

    def _process_log_results(self, cursor) -> list[dict]:
        """Converts raw cursor rows to a list of dicts with JSON parsing."""
        columns = [desc[0] for desc in cursor.description]
        logs = []
        for row in cursor.fetchall():
            log_dict = dict(zip(columns, row, strict=False))
            if "facets" in log_dict and isinstance(log_dict["facets"], str):
                try:
                    log_dict["facets"] = json.loads(log_dict["facets"])
                except Exception:
                    log_dict["facets"] = {}
            elif "facets" in log_dict and log_dict["facets"] is None:
                log_dict["facets"] = {}
            logs.append(log_dict)
        return logs

    def query_logs(
        self,
        workspace_id: str,
        query: str = None,
        filters: list = None,
        limit: int = 100,
        offset: int = 0,
        sort_by: str = "id",
        sort_order: str = "DESC",
        source_ids: list = None,
        start_time: str = None,
        end_time: str = None,
    ) -> dict:
        cursor = self.get_cursor()

        if source_ids is not None and not source_ids:
            return {"total": 0, "logs": [], "offset": offset, "limit": limit}

        where_clauses, params = self._build_where_clauses(
            workspace_id, query, filters, source_ids, start_time, end_time
        )

        where_sql = " AND ".join(where_clauses)
        total_logs_subquery = "(SELECT count(*) FROM logs WHERE workspace_id = ?)"

        base_query = f"""
            SELECT l.*, c.count as _cluster_count, c.template as cluster_template,
                CAST(c.count AS FLOAT) * 100.0 / {total_logs_subquery} as cluster_percent
            FROM logs l
            LEFT JOIN clusters c ON l.workspace_id = c.workspace_id AND l.cluster_id = c.cluster_id
            WHERE {where_sql}
        """

        count_query = f"SELECT COUNT(*) FROM logs l WHERE {where_sql}"
        cursor.execute(count_query, params)
        total = cursor.fetchone()[0]

        allowed_sort = [
            "id",
            "timestamp",
            "level",
            "source_id",
            "cluster_id",
            "has_comment",
            "cluster_percent",
        ]
        final_sort_by = sort_by if sort_by in allowed_sort else "id"
        if final_sort_by == "cluster_id":
            final_sort_by = "cluster_percent"

        final_sort_order = "ASC" if sort_order and sort_order.upper() == "ASC" else "DESC"
        data_query = (
            base_query
            + f" ORDER BY {final_sort_by} {final_sort_order}, l.id {final_sort_order} LIMIT ? OFFSET ?"
        )

        cursor.execute(data_query, [workspace_id] + params + [limit, offset])
        logs = self._process_log_results(cursor)

        self._apply_temporal_offsets(workspace_id, logs)

        return {"total": total, "logs": logs, "offset": offset, "limit": limit}

    def _get_facet_keys(self, workspace_id: str) -> list[str]:
        """Resolve priority and custom facet keys from settings."""
        cursor = self.get_cursor()
        keys = [
            "ip",
            "uuid",
            "user_id",
            "host",
            "thread",
            "logger",
            "status",
            "method",
            "level",
            "email",
        ]

        def _append_rules(json_str: str | None):
            if not json_str:
                return
            try:
                rules = json.loads(json_str)
                for r in rules if isinstance(rules, list) else []:
                    name = r.get("name")
                    if name and name not in keys:
                        keys.append(name)
            except Exception:
                pass

        cursor.execute("SELECT value FROM settings WHERE key = 'facet_extractions'")
        gr = cursor.fetchone()
        _append_rules(gr[0] if gr else None)

        cursor.execute(
            "SELECT value FROM workspace_settings WHERE workspace_id = ? AND key = 'facet_extractions'",
            (workspace_id,),
        )
        wr = cursor.fetchone()
        _append_rules(wr[0] if wr else None)

        # Also dynamically fetch all unique keys currently in the logs table
        try:
            cursor.execute(
                "SELECT DISTINCT UNNEST(json_keys(facets)) FROM logs WHERE workspace_id = ? AND facets IS NOT NULL",
                (workspace_id,)
            )
            for row in cursor.fetchall():
                key = str(row[0])
                if key and key not in keys and key != "*":
                    keys.append(key)
        except Exception as e:
            logger.warning("[DB] Failed to extract dynamic facet keys: %s", e)

        return keys

    def _get_facet_aggregations(
        self, workspace_id: str, keys: list[str], source_ids: list = None
    ) -> dict:
        """Query top 10 unique values for each facet key."""
        cursor = self.get_cursor()
        results = {}

        for key in keys:
            if key == "level":
                where_clauses = ["workspace_id = ?", "level IS NOT NULL"]
                query_field = "level"
            else:
                # Whitelist: ensure key only contains safe characters if it's used in JSON path
                safe_key = "".join(c for c in key if c.isalnum() or c in "_-")
                where_clauses = [
                    "workspace_id = ?",
                    f"json_extract_string(facets, '$.\"{safe_key}\"') IS NOT NULL",
                ]
                query_field = f"json_extract_string(facets, '$.\"{safe_key}\"')"

            sql_params = [workspace_id]

            if source_ids:
                placeholders = ",".join(["?"] * len(source_ids))
                where_clauses.append(f"source_id IN ({placeholders})")
                sql_params.extend(source_ids)

            where_sql = " AND ".join(where_clauses)
            agg_query = f"""
                SELECT {query_field} as val, count(*) as count
                FROM logs
                WHERE {where_sql}
                GROUP BY val
                ORDER BY count DESC
                LIMIT 10
            """
            try:
                cursor.execute(agg_query, sql_params)
                rows = cursor.fetchall()
                if rows:
                    results[key] = [{"value": str(r[0]), "count": r[1]} for r in rows]
            except Exception as e:
                logger.warning("[DB] Facet aggregation failed for '%s': %s", key, e)

        return results

    def get_metadata_facets(self, workspace_id: str, source_ids: list = None) -> dict:
        """Return the top unique metadata facets across all logs in a workspace."""
        keys = self._get_facet_keys(workspace_id)
        return self._get_facet_aggregations(workspace_id, keys, source_ids)

    def delete_logs(self, workspace_id: str, source_id: str = None):
        """Delete logs for a workspace. Optionally filter by source_id."""
        cursor = self.get_cursor()
        if source_id:
            cursor.execute(
                "DELETE FROM logs WHERE workspace_id = ? AND source_id = ?",
                (workspace_id, source_id),
            )
            # Re-initialize cluster cache for the workspace to reflect deletions
            cursor.execute("DELETE FROM clusters WHERE workspace_id = ?", (workspace_id,))
            cursor.execute(
                """
                INSERT INTO clusters (workspace_id, cluster_id, template, count)
                SELECT workspace_id, cluster_id, 'Pattern ' || cluster_id, count(*)
                FROM logs WHERE workspace_id = ? AND cluster_id IS NOT NULL GROUP BY workspace_id, cluster_id
            """,
                (workspace_id,),
            )
        else:
            cursor.execute("DELETE FROM logs WHERE workspace_id = ?", (workspace_id,))
            cursor.execute("DELETE FROM clusters WHERE workspace_id = ?", (workspace_id,))

        self.commit()

    # --- Hierarchy Management ---

    def create_folder(self, workspace_id: str, folder_id: str, name: str, parent_id: str = None):
        cursor = self.get_cursor()
        cursor.execute(
            "INSERT INTO folders (id, workspace_id, name, parent_id) VALUES (?, ?, ?, ?)",
            (folder_id, workspace_id, name, parent_id),
        )
        self.commit()

    def update_folder(self, folder_id: str, name: str = None, parent_id: str = None):
        cursor = self.get_cursor()
        if name:
            cursor.execute("UPDATE folders SET name = ? WHERE id = ?", (name, folder_id))
        if parent_id is not None:
            # Note: parent_id can be empty string/None for root level
            p_val = parent_id if parent_id != "" else None
            cursor.execute("UPDATE folders SET parent_id = ? WHERE id = ?", (p_val, folder_id))
        self.commit()

    def _get_all_subfolder_ids(self, folder_id: str) -> list[str]:
        """Recursively fetch all child folder IDs."""
        cursor = self.get_cursor()
        cursor.execute("SELECT id FROM folders WHERE parent_id = ?", (folder_id,))
        child_ids = [row[0] for row in cursor.fetchall()]

        all_ids = [folder_id]
        for child_id in child_ids:
            all_ids.extend(self._get_all_subfolder_ids(child_id))
        return all_ids

    def delete_folder(self, folder_id: str):
        cursor = self.get_cursor()

        # 1. Promote child folders to root (NULL parent)
        cursor.execute("UPDATE folders SET parent_id = NULL WHERE parent_id = ?", (folder_id,))

        # 2. Promote log sources in this folder to root
        cursor.execute("UPDATE log_sources SET folder_id = NULL WHERE folder_id = ?", (folder_id,))

        # 3. Delete the folder itself
        cursor.execute("DELETE FROM folders WHERE id = ?", (folder_id,))

        self.commit()

    def upsert_log_source(
        self,
        workspace_id: str,
        source_id: str,
        name: str,
        type: str,
        path: str,
        folder_id: str = None,
    ):
        cursor = self.get_cursor()
        cursor.execute(
            """
            INSERT OR REPLACE INTO log_sources (id, workspace_id, folder_id, name, type, path)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (source_id, workspace_id, folder_id, name, type, path),
        )
        self.commit()

    def update_log_source(self, source_id: str, **kwargs):
        if not kwargs:
            return
        cursor = self.get_cursor()
        fields = []
        params = []
        for k, v in kwargs.items():
            fields.append(f"{k} = ?")
            params.append(v)
        params.append(source_id)
        cursor.execute(f"UPDATE log_sources SET {', '.join(fields)} WHERE id = ?", params)
        self.commit()

    def delete_log_source(self, source_id: str):
        cursor = self.get_cursor()
        # Wipe the actual logs first
        cursor.execute("DELETE FROM logs WHERE source_id = ?", (source_id,))
        # Then the source entry
        cursor.execute("DELETE FROM log_sources WHERE id = ?", (source_id,))
        self.commit()

    def get_hierarchy(self, workspace_id: str) -> dict:
        """Returns the tree structure for a workspace."""
        cursor = self.get_cursor()

        # 1. Fetch all folders
        cursor.execute(
            "SELECT id, name, parent_id FROM folders WHERE workspace_id = ?", (workspace_id,)
        )
        folders = [
            {"id": r[0], "name": r[1], "parent_id": r[2], "children": [], "sources": []}
            for r in cursor.fetchall()
        ]

        # 2. Fetch all sources
        cursor.execute(
            "SELECT id, name, type, path, folder_id FROM log_sources WHERE workspace_id = ?",
            (workspace_id,),
        )
        sources = [
            {"id": r[0], "name": r[1], "type": r[2], "path": r[3], "folder_id": r[4]}
            for r in cursor.fetchall()
        ]

        # 3. Build tree
        folder_map = {f["id"]: f for f in folders}
        root_nodes = []
        root_sources = []

        for f in folders:
            pid = f["parent_id"]
            if pid and pid in folder_map:
                folder_map[pid]["children"].append(f)
            else:
                root_nodes.append(f)

        for s in sources:
            fid = s["folder_id"]
            if fid and fid in folder_map:
                folder_map[fid]["sources"].append(s)
            else:
                root_sources.append(s)

        return {
            "workspace_id": workspace_id,
            "root": {
                "id": "root",
                "name": "Root",
                "type": "folder",
                "children": root_nodes,
                "sources": root_sources,
            },
        }

    # --- Ingestion Job Tracking ---

    def create_ingestion_job(self, workspace_id: str, source_id: str, total_lines: int) -> int:
        cursor = self.get_cursor()
        cursor.execute(
            "INSERT INTO ingestion_jobs (workspace_id, source_id, total_lines, status) VALUES (?, ?, ?, 'processing') RETURNING id",
            (workspace_id, source_id, total_lines),
        )
        job_id = cursor.fetchone()[0]
        self.commit()
        return job_id

    def update_ingestion_progress(
        self, job_id: int, processed_lines: int, status: str = "processing"
    ):
        cursor = self.get_cursor()
        cursor.execute(
            "UPDATE ingestion_jobs SET processed_lines = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
            (processed_lines, status, job_id),
        )
        self.commit()

    def get_ingestion_jobs(self, workspace_id: str | None = None) -> list[dict]:
        cursor = self.get_cursor()
        if workspace_id:
            cursor.execute(
                "SELECT id, workspace_id, source_id, status, total_lines, processed_lines, created_at, updated_at FROM ingestion_jobs WHERE workspace_id = ? ORDER BY created_at DESC",
                (workspace_id,),
            )
        else:
            cursor.execute(
                "SELECT id, workspace_id, source_id, status, total_lines, processed_lines, created_at, updated_at FROM ingestion_jobs ORDER BY created_at DESC LIMIT 50"
            )
        columns = [desc[0] for desc in cursor.description]
        results = []
        for row in cursor.fetchall():
            job = dict(zip(columns, row, strict=False))
            # Format timestamps for JSON serialization
            for key in ["created_at", "updated_at"]:
                if job[key]:
                    job[key] = job[key].isoformat()
            results.append(job)
        return results


# Alias for backward compatibility
Database = LogDatabase
