# Assume Role: Backend Engineer (@backend)
import logging
import time
from datetime import datetime, timedelta

logger = logging.getLogger("LogLensAnomalies")


class AnomalyDetector:
    """
    On-Demand/Event-Driven worker that detects volume spikes in log clusters.
    Uses a simple Z-score moving average approach.
    """

    def __init__(self, db, interval_seconds=300):
        self.db = db
        self.interval_seconds = interval_seconds
        self.running = False
        self._last_run = {}  # Track last run time per workspace for throttling

    def start(self):
        # Thread loop removed for desktop event-driven Option 1
        logger.info("Anomaly Detector: Event-driven mode active (background thread disabled)")

    def stop(self):
        pass

    def detect_anomalies(self, workspace_id=None):
        """
        Calculates cluster frequency and flags anomalies using Z-score (standard score).
        Flags clusters where current volume deviates significantly from historical baseline.
        """
        # Throttling check: max once every 10 seconds per workspace to prevent CPU thrashing during streams
        now_time = time.time()
        last_time = self._last_run.get(workspace_id, 0)
        if now_time - last_time < 10:
            logger.debug(
                f"Throttling anomaly detection for workspace {workspace_id} (last run was {now_time - last_time:.1f}s ago)"
            )
            return
        self._last_run[workspace_id] = now_time

        cursor = self.db.get_cursor()
        logger.debug(f"Running Z-score anomaly detection cycle (workspace={workspace_id})...")

        # Get reference time (latest log timestamp in the DB/workspace, or now)
        ref_time = None
        if workspace_id:
            cursor.execute(
                "SELECT max(timestamp) FROM logs WHERE workspace_id = ?", (workspace_id,)
            )
            ref_row = cursor.fetchone()
            if ref_row and ref_row[0]:
                ref_time = ref_row[0]
        else:
            cursor.execute("SELECT max(timestamp) FROM logs")
            ref_row = cursor.fetchone()
            if ref_row and ref_row[0]:
                ref_time = ref_row[0]

        if ref_time:
            if isinstance(ref_time, str):
                try:
                    normalized = ref_time.replace("T", " ")
                    normalized = normalized.split("+")[0].split("Z")[0].strip()
                    if "." in normalized:
                        now = datetime.strptime(normalized.split(".")[0], "%Y-%m-%d %H:%M:%S")
                    else:
                        if len(normalized) == 10:
                            now = datetime.strptime(normalized, "%Y-%m-%d")
                        else:
                            now = datetime.strptime(normalized, "%Y-%m-%d %H:%M:%S")
                except Exception as e:
                    logger.error(f"Failed to parse max timestamp {ref_time}: {e}")
                    now = datetime.now()
            elif isinstance(ref_time, datetime):
                now = ref_time
            else:
                now = datetime.now()
        else:
            now = datetime.now()

        ten_mins_ago = (now - timedelta(minutes=10)).strftime("%Y-%m-%d %H:%M:%S")
        day_ago = (now - timedelta(days=1)).strftime("%Y-%m-%d %H:%M:%S")
        now_str = now.strftime("%Y-%m-%d %H:%M:%S")

        day_ago_bucket = day_ago[:13]
        ten_mins_ago_bucket = ten_mins_ago[:13]

        # Ensure stats are synced for the last 24 hours (heals any direct bypass or out-of-sync states)
        cursor.execute("""
            INSERT INTO hourly_cluster_counts (workspace_id, cluster_id, hour_bucket, count)
            SELECT workspace_id, cluster_id, SUBSTRING(REPLACE(timestamp, 'T', ' '), 1, 13) as hr, count(*)
            FROM logs
            WHERE timestamp >= ? AND cluster_id IS NOT NULL
            GROUP BY workspace_id, cluster_id, hr
            ON CONFLICT (workspace_id, cluster_id, hour_bucket)
            DO UPDATE SET count = excluded.count
        """, (day_ago,))

        # 1. Calculate Baseline (Mean and StdDev) for the last 24 hours from pre-aggregated stats
        baseline_query = """
            WITH hourly_counts AS (
                SELECT 
                    workspace_id,
                    cluster_id,
                    hour_bucket,
                    count as cnt
                FROM hourly_cluster_counts
                WHERE hour_bucket >= ? AND hour_bucket < ? AND cluster_id IS NOT NULL
                {workspace_clause}
            )
            SELECT 
                workspace_id,
                cluster_id,
                avg(cnt) as mean,
                stddev_pop(cnt) as stddev
            FROM hourly_counts
            GROUP BY workspace_id, cluster_id
        """

        current_query = """
            SELECT workspace_id, cluster_id, CAST(count(*) AS FLOAT) * 6.0 as current_rate
            FROM logs
            WHERE timestamp >= ? AND cluster_id IS NOT NULL
            {workspace_clause}
            GROUP BY workspace_id, cluster_id
        """

        if workspace_id:
            baseline_query = baseline_query.format(workspace_clause="AND workspace_id = ?")
            baseline_params = (day_ago_bucket, ten_mins_ago_bucket, workspace_id)

            current_query = current_query.format(workspace_clause="AND workspace_id = ?")
            current_params = (ten_mins_ago, workspace_id)
        else:
            baseline_query = baseline_query.format(workspace_clause="")
            baseline_params = (day_ago_bucket, ten_mins_ago_bucket)

            current_query = current_query.format(workspace_clause="")
            current_params = (ten_mins_ago,)

        cursor.execute(baseline_query, baseline_params)
        baselines = {}
        for row in cursor.fetchall():
            ws, cid, mean, stddev = row
            baselines[(ws, cid)] = {"mean": float(mean), "stddev": float(stddev or 0.1)}

        # 2. Calculate Current Rate (last 10 minutes, scaled to hourly)
        cursor.execute(current_query, current_params)
        current_rates = cursor.fetchall()

        anomalies = []
        for ws, cid, rate in current_rates:
            rate = float(rate)
            baseline = baselines.get((ws, cid))
            if not baseline:
                # If no baseline, but high volume, it's a new anomaly
                if rate > 20.0:
                    anomalies.append(f"{ws}:{cid}")
                continue

            mean = baseline["mean"]
            stddev = baseline["stddev"]

            # Z-Score Calculation
            z_score = (rate - mean) / stddev

            # Threshold: 3.0 is standard for "extreme outlier"
            if z_score > 3.0 and rate > 5.0:
                logger.warning(
                    f"Anomaly! Workspace {ws} Cluster {cid}: Z={z_score:.2f} (Rate {rate:.1f} vs Mean {mean:.1f})"
                )
                anomalies.append(f"{ws}:{cid}")

                # Persist to DB
                cursor.execute(
                    """
                    INSERT INTO anomalies (workspace_id, cluster_id, timestamp, z_score, current_rate, mean_rate)
                    VALUES (?, ?, ?, ?, ?, ?)
                    ON CONFLICT DO NOTHING
                """,
                    (ws, cid, now_str, z_score, rate, mean),
                )

        self.db.commit()
        self._last_anomalies = anomalies

    def get_last_anomalies(self):
        return getattr(self, "_last_anomalies", [])
