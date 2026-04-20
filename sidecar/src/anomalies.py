import logging
import threading
import time
from datetime import datetime, timedelta

logger = logging.getLogger("LogLensAnomalies")


class AnomalyDetector:
    """
    Background worker that detects volume spikes in log clusters.
    Uses a simple Z-score moving average approach.
    """

    def __init__(self, db, interval_seconds=300):
        self.db = db
        self.interval_seconds = interval_seconds
        self.running = False
        self._thread = None

    def start(self):
        self.running = True
        self._thread = threading.Thread(target=self._run, daemon=True)
        self._thread.start()
        logger.info("Anomaly Detector: Background worker started")

    def stop(self):
        self.running = False

    def _run(self):
        while self.running:
            try:
                self.detect_anomalies()
            except Exception as e:
                logger.error(f"Anomaly detection cycle failed: {e}")

            # Wait for next interval
            for _ in range(self.interval_seconds):
                if not self.running:
                    break
                time.sleep(1)

    def detect_anomalies(self):
        """
        Calculates cluster frequency and flags anomalies using Z-score (standard score).
        Flags clusters where current volume deviates significantly from historical baseline.
        """
        cursor = self.db.get_cursor()
        logger.debug("Running Z-score anomaly detection cycle...")

        now = datetime.now()
        ten_mins_ago = (now - timedelta(minutes=10)).strftime("%Y-%m-%d %H:%M:%S")
        day_ago = (now - timedelta(days=1)).strftime("%Y-%m-%d %H:%M:%S")

        # 1. Calculate Baseline (Mean and StdDev) for the last 24 hours, grouped by workspace and cluster
        # We bucket by hour to get a distribution of hourly volumes
        cursor.execute(
            """
            WITH hourly_counts AS (
                SELECT 
                    workspace_id,
                    cluster_id,
                    substring(timestamp, 1, 13) as hour_bucket,
                    count(*) as cnt
                FROM logs
                WHERE timestamp >= ? AND timestamp < ? AND cluster_id IS NOT NULL
                GROUP BY workspace_id, cluster_id, hour_bucket
            )
            SELECT 
                workspace_id,
                cluster_id,
                avg(cnt) as mean,
                stddev_pop(cnt) as stddev
            FROM hourly_counts
            GROUP BY workspace_id, cluster_id
        """,
            (day_ago, ten_mins_ago),
        )

        baselines = {}
        for row in cursor.fetchall():
            ws_id, cid, mean, stddev = row
            baselines[(ws_id, cid)] = {"mean": float(mean), "stddev": float(stddev or 0.1)}

        # 2. Calculate Current Rate (last 10 minutes, scaled to hourly)
        cursor.execute(
            """
            SELECT workspace_id, cluster_id, CAST(count(*) AS FLOAT) * 6.0 as current_rate
            FROM logs
            WHERE timestamp >= ? AND cluster_id IS NOT NULL
            GROUP BY workspace_id, cluster_id
        """,
            (ten_mins_ago,),
        )

        current_rates = cursor.fetchall()

        anomalies = []
        for ws_id, cid, rate in current_rates:
            rate = float(rate)
            baseline = baselines.get((ws_id, cid))
            if not baseline:
                # If no baseline, but high volume, it's a new anomaly
                if rate > 20.0:
                    anomalies.append(f"{ws_id}:{cid}")
                continue

            mean = baseline["mean"]
            stddev = baseline["stddev"]

            # Z-Score Calculation
            z_score = (rate - mean) / stddev

            # Threshold: 3.0 is standard for "extreme outlier" (99.7% confidence)
            if z_score > 3.0 and rate > 5.0:
                logger.warning(
                    f"Anomaly! Workspace {ws_id} Cluster {cid}: Z={z_score:.2f} (Rate {rate:.1f} vs Mean {mean:.1f})"
                )
                anomalies.append(f"{ws_id}:{cid}")

                # Persist to DB
                cursor.execute(
                    """
                    INSERT INTO anomalies (workspace_id, cluster_id, timestamp, z_score, current_rate, mean_rate)
                    VALUES (?, ?, ?, ?, ?, ?)
                """,
                    (ws_id, cid, now.strftime("%Y-%m-%d %H:%M:%S"), z_score, rate, mean),
                )

        self.db.commit()
        self._last_anomalies = anomalies

    def get_last_anomalies(self):
        return getattr(self, "_last_anomalies", [])
