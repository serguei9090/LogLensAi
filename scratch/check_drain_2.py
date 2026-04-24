from drain3 import TemplateMiner

miner = TemplateMiner()
miner.add_log_message("User admin logged in")
cluster = list(miner.drain.clusters)[0]
print(f"Cluster attributes: {dir(cluster)}")
print(f"Cluster template: {cluster.get_template()}")
