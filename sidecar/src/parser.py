import os
import threading

from drain3 import TemplateMiner
from drain3.file_persistence import FilePersistence
from drain3.masking import MaskingInstruction
from drain3.template_miner_config import TemplateMinerConfig


class DrainParser:
    def __init__(
        self,
        persistence_path=None,
        sim_th=0.4,
        max_children=100,
        max_clusters=1000,
        masking_instructions=None,
    ):
        self.config = TemplateMinerConfig()
        self.config.drain_sim_th = sim_th
        self.config.drain_max_children = max_children
        self.config.drain_max_clusters = max_clusters
        # Optimization: Don't save on every single cluster creation
        self.config.snapshot_interval_minutes = 10
        self.config.snapshot_compress_state = True

        if masking_instructions:
            self._apply_masking_instructions(masking_instructions)

        self.persistence = None
        if persistence_path:
            # Ensure directory exists for persistence file
            os.makedirs(os.path.dirname(persistence_path), exist_ok=True)
            self.persistence = FilePersistence(persistence_path)

        self.miner = TemplateMiner(persistence_handler=self.persistence, config=self.config)
        self.lock = threading.RLock()

    def _apply_masking_instructions(self, masking_instructions):
        if not isinstance(masking_instructions, (list, tuple)):
            return

        import re

        for mi in masking_instructions:
            if not isinstance(mi, dict) or not mi.get("enabled", True):
                continue

            pattern = mi.get("pattern")
            label = mi.get("label")
            if not pattern or not label:
                continue

            try:
                # Validate regex before adding
                re.compile(pattern)
                self.config.masking_instructions.append(MaskingInstruction(pattern, label))
            except re.error:
                # Log or handle invalid regex
                continue

    def parse(self, log_line: str) -> dict:
        """Returns a dict with cluster_id and template for the given log line (updates tree)."""
        with self.lock:
            result = self.miner.add_log_message(log_line)
            cluster_id = str(result["cluster_id"])
            template = result["template_mined"]

            facets = {}
            try:
                params = self.miner.extract_parameters(template, log_line, exact_matching=False)
                if params:
                    for param in params:
                        # Clean up mask name e.g., <IP> -> ip, <NUM> -> num
                        mask_key = param.mask_name.strip("<>").lower()
                        facets[mask_key] = param.value
            except Exception:
                pass

            return {
                "cluster_id": cluster_id,
                "template": template,
                "change_type": result["change_type"],
                "facets": facets,
            }

    def match(self, log_line: str) -> dict | None:
        """
        Identify cluster for a log line without updating the tree.
        Thread-safe and suitable for parallel tagging.
        """
        # Note: miner.match is read-only on the Drain tree
        cluster = self.miner.match(log_line)
        if cluster:
            return {
                "cluster_id": str(cluster.cluster_id),
                "template": cluster.get_template(),
            }
        return None

    def get_clusters(self):
        with self.lock:
            # Return list of clusters for easier consumption
            return list(self.miner.drain.clusters)

    def save(self):
        """Forces a state save if persistence is enabled."""
        if self.persistence:
            with self.lock:
                self.miner.save_state("Manual save")
