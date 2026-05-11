
with open("sidecar/src/workers/clustering.py", encoding="utf-8") as f:
    content = f.read()

# 1. Update signature of _tag_log_row
old_sig = """def _tag_log_row(  # noqa: PLR0913
    row: tuple,
    cluster_map: dict,
    rules: list,
    p_config: dict,
    p_tz: int,
    _now: float,
) -> dict:"""

new_sig = """def _tag_log_row(  # noqa: PLR0913
    row: tuple,
    cluster_map: dict,
    miner_config: any,
    rules: list,
    p_config: dict,
    p_tz: int,
    _now: float,
) -> dict:"""

if old_sig in content:
    content = content.replace(old_sig, new_sig)
else:
    print("Could not find old signature")

# 2. Update temp_miner instantiation and tree population
old_miner_setup = """        if cluster_map:
            # Create a new, temporary, in-memory miner for this one-off task.
            # This avoids any pickling issues with locks from the main parser.
            temp_miner = TemplateMiner()
            for c in cluster_map.values():
                # Manually reconstruct the cluster in the temporary miner.
                # This is safer than trying to pickle the actual Cluster object.
                temp_miner.drain.add_cluster(c)"""

new_miner_setup = """        if cluster_map:
            # Create a new, temporary, in-memory miner for this one-off task.
            # This avoids any pickling issues with locks from the main parser.
            temp_miner = TemplateMiner(config=miner_config)
            for c in cluster_map.values():
                # Manually reconstruct the cluster in the temporary miner.
                temp_miner.drain.id_to_cluster[c.cluster_id] = c
                temp_miner.drain.add_seq_to_prefix_tree(temp_miner.drain.root_node, c)"""

if old_miner_setup in content:
    content = content.replace(old_miner_setup, new_miner_setup)
else:
    print("Could not find old miner setup")

# 3. Update the call to _tag_log_row inside _process_batch
old_call = """                for row in rows:
                    fut = self._executor.submit(
                        _tag_log_row, row, cluster_map, rules, p_config, p_tz, now
                    )"""

new_call = """                miner_config = parser.miner.config
                for row in rows:
                    fut = self._executor.submit(
                        _tag_log_row, row, cluster_map, miner_config, rules, p_config, p_tz, now
                    )"""

if old_call in content:
    content = content.replace(old_call, new_call)
else:
    print("Could not find old call")

with open("sidecar/src/workers/clustering.py", "w", encoding="utf-8") as f:
    f.write(content)
