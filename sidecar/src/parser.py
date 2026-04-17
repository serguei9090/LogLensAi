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

        if masking_instructions:
            for mi in masking_instructions:
                if not mi.get("enabled", True):
                    continue
                pattern = mi.get("pattern")
                label = mi.get("label")
                if pattern and label:
                    try:
                        # Validate regex before adding
                        import re

                        re.compile(pattern)
                        self.config.masking_instructions.append(MaskingInstruction(pattern, label))
                    except re.error:
                        # Log or handle invalid regex
                        continue

        self.persistence = None
        if persistence_path:
            # Ensure directory exists for persistence file
            os.makedirs(os.path.dirname(persistence_path), exist_ok=True)
            self.persistence = FilePersistence(persistence_path)

        self.miner = TemplateMiner(persistence=self.persistence, config=self.config)
        self.lock = threading.RLock()

    def parse(self, log_line: str) -> dict:
        """Returns a dict with cluster_id and template for the given log line."""
        with self.lock:
            result = self.miner.add_log_message(log_line)
            return {
                "cluster_id": str(result["cluster_id"]),
                "template": result["template_mined"],
                "change_type": result["change_type"],
            }

    def get_clusters(self):
        with self.lock:
            return self.miner.drain.clusters

    def save(self):
        """Forces a state save if persistence is enabled."""
        if self.persistence:
            with self.lock:
                self.miner.save_state()
