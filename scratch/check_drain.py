from drain3 import TemplateMiner

miner = TemplateMiner()
print(f"Clusters type: {type(miner.drain.clusters)}")
miner.add_log_message("test")
print(f"Clusters count: {len(miner.drain.clusters)}")
print(f"Cluster 0 type: {type(miner.drain.clusters[0])}")
