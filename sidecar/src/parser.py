import threading

from drain3 import TemplateMiner
from drain3.template_miner_config import TemplateMinerConfig


class DrainParser:
    def __init__(self, sim_th=0.4, max_children=100, max_clusters=1000):
        self.config = TemplateMinerConfig()
        self.config.drain_sim_th = sim_th
        self.config.drain_max_children = max_children
        self.config.drain_max_clusters = max_clusters
        self.miner = TemplateMiner(config=self.config)
        self.lock = threading.RLock()

    def parse(self, log_line: str) -> dict:
        """Returns a dict with cluster_id and template for the given log line."""
        with self.lock:
            result = self.miner.add_log_message(log_line)
            return {"cluster_id": str(result["cluster_id"]), "template": result["template_mined"]}

    def get_clusters(self):
        return self.miner.drain.clusters
