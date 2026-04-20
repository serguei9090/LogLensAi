import contextlib
import json
import os
import threading
from datetime import datetime, timedelta
from typing import Any

import duckdb
from query_parser import parse_llql


class LogDatabase:
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
                comment      TEXT,
                facets       JSON
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
                id           INTEGER PRIMARY KEY DEFAULT nextval('log_id_seq'),
                workspace_id TEXT,
                name         TEXT,
                type         TEXT,
                port         INTEGER,
                enabled      BOOLEAN DEFAULT TRUE,
                created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS ai_messages (
                id           INTEGER PRIMARY KEY DEFAULT nextval('log_id_seq'),
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
                id           INTEGER PRIMARY KEY DEFAULT nextval('log_id_seq'),
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

            -- Performance Indexes
            CREATE INDEX IF NOT EXISTS idx_logs_workspace_id ON logs (workspace_id);
            CREATE INDEX IF NOT EXISTS idx_logs_source_id ON logs (source_id);
            CREATE INDEX IF NOT EXISTS idx_logs_timestamp ON logs (timestamp);
            CREATE INDEX IF NOT EXISTS idx_logs_cluster_id ON logs (cluster_id);
            CREATE INDEX IF NOT EXISTS idx_ai_messages_session_id ON ai_messages (session_id);
        """)

    def _run_migrations(self, cursor):
        """Handle schema evolution for existing databases."""
        self._migrate_ai_tables(cursor)
        self._migrate_fusion_pk(cursor)
        self._migrate_fusion_time_shift(cursor)
        self._migrate_log_columns(cursor)
        self._migrate_log_facets(cursor)
        self._migrate_indexes(cursor)

    def _migrate_indexes(self, cursor):
        """Ensure all performance indexes exist on legacy databases."""
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_logs_workspace_id ON logs (workspace_id);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_logs_source_id ON logs (source_id);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_logs_timestamp ON logs (timestamp);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_logs_cluster_id ON logs (cluster_id);")
        cursor.execute(
            "CREATE INDEX IF NOT EXISTS idx_ai_messages_session_id ON ai_messages (session_id);"
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
            try:
                cursor.execute(f"SELECT {col} FROM {table} LIMIT 1")
            except Exception:
                cursor.execute(f"ALTER TABLE {table} ADD COLUMN {col} TEXT")

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
                print("[DB] Migrating fusion_configs to update Primary Key...")
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
            print(f"[DB] Error migrating fusion_configs: {e}")

    def _migrate_fusion_time_shift(self, cursor):
        try:
            cursor.execute("SELECT time_shift_seconds FROM fusion_configs LIMIT 1")
        except Exception:
            print("[DB] Adding time_shift_seconds to fusion_configs...")
            cursor.execute(
                "ALTER TABLE fusion_configs ADD COLUMN time_shift_seconds INTEGER DEFAULT 0"
            )

    def _migrate_log_columns(self, cursor):
        try:
            cursor.execute("SELECT source_id FROM logs LIMIT 1")
        except Exception:
            cursor.execute("ALTER TABLE logs ADD COLUMN source_id TEXT")

        with contextlib.suppress(Exception):
            cursor.execute("ALTER TABLE logs ALTER id SET DEFAULT nextval('log_id_seq')")

    def _migrate_log_facets(self, cursor):
        try:
            cursor.execute("SELECT facets FROM logs LIMIT 1")
        except Exception:
            print("[DB] Adding facets column to logs table...")
            cursor.execute("ALTER TABLE logs ADD COLUMN facets JSON")

    def _initialize_cluster_cache(self, cursor):
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
        return self.conn.cursor()

    def commit(self):
        self.conn.commit()

    @classmethod
    def reset(cls):
        with cls._lock:
            if cls._instance is not None:
                if hasattr(cls._instance, "conn"):
                    cls._instance.conn.close()
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
        allowed_fields = ["level", "source_id", "cluster_id", "raw_text", "has_comment"]

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


# Alias for backward compatibility
Database = LogDatabase
