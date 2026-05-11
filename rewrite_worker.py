
with open("sidecar/src/workers/clustering.py", encoding="utf-8") as f:
    content = f.read()

# We want to replace the entire `def _tag_log_batch` down to `except Exception as exc:` block
# Let's find the start of `def _tag_log_batch`
start_idx = content.find("def _tag_log_batch")

# Let's find the end of the function (before `# ---------------------------------------------------------------------------` which precedes `class ClusteringWorker`)
end_marker = "# Main worker class"
end_idx = content.find(end_marker, start_idx)

# Go back up a bit to include the comment block line
end_idx = content.rfind("# ---", start_idx, end_idx)

new_func = '''def _tag_log_batch(  # noqa: PLR0913
    rows: list[tuple],
    cluster_map: dict,
    miner_config: Any,
    rules: list,
    p_config: dict,
    p_tz: int,
    _now: float,
) -> list[dict]:
    """
    Pure, picklable function executed in a child process.

    Performs metadata extraction and cluster-matching against a snapshot of
    the Drain tree for a batch of rows. It reconstructs a temporary, in-memory TemplateMiner
    from the cluster map to leverage the official `match` logic.

    Never writes to the Drain tree or the database.

    Returns a list of result dicts with keys:
      - log_id, ws_id, source_id, cluster_id, template, timestamp, level,
        facets_json, status ('ok' | 'missing' | 'error')
    """
    results = []

    # Reconstruct miner once per batch
    temp_miner = None
    if cluster_map:
        temp_miner = TemplateMiner(config=miner_config)
        for c in cluster_map.values():
            temp_miner.drain.id_to_cluster[c.cluster_id] = c
            temp_miner.drain.add_seq_to_prefix_tree(temp_miner.drain.root_node, c)

    for row in rows:
        log_id, ws_id, source_id, _line_id, facets_json, raw_text = row
        try:
            if not raw_text:
                results.append({"status": "missing", "log_id": log_id, "ws_id": ws_id, "source_id": source_id})
                continue

            meta = extract_log_metadata(
                raw_text, custom_rules=rules, parser_config=p_config, tz_offset=p_tz
            )

            # Merge pre-existing facets
            existing_facets = json.loads(facets_json) if facets_json else {}
            meta["facets"].update(existing_facets)

            message = meta["message"]

            cluster_id = None
            template = None
            if temp_miner:
                match_result = temp_miner.match(message)
                if match_result:
                    cluster_id = str(match_result.cluster_id)
                    template = match_result.get_template()

            results.append({
                "status": "ok",
                "log_id": log_id,
                "ws_id": ws_id,
                "source_id": source_id,
                "cluster_id": cluster_id,
                "template": template,
                "timestamp": meta["timestamp"],
                "level": meta["level"],
                "facets_json": json.dumps(meta["facets"]),
            })

        except Exception as exc:
            results.append({
                "status": "error",
                "log_id": log_id,
                "ws_id": ws_id,
                "source_id": source_id,
                "error": str(exc),
                "facets_json": facets_json,
            })
            logger.debug("Failed to parse", exc_info=True)

    return results

'''

if start_idx != -1 and end_idx != -1:
    content = content[:start_idx] + new_func + content[end_idx:]

    with open("sidecar/src/workers/clustering.py", "w", encoding="utf-8") as f:
        f.write(content)
    print("Replaced function")
else:
    print("Could not find start/end")

"""
We also need to fix E501 inside `_tag_log_batch`?
Wait, I will just run ruff fix afterwards.
But the earlier error reported E501 at:
logger.error(
   "[Worker] Tag worker error for log %s: %s", log_id, result.get("error")
)
We should fix that too since we changed logger.error to logger.exception? Wait, the earlier error didn't change this specific logger.error.
Let's fix it here:
"""

content = content.replace(
    'logger.error(\n                                "[Worker] Tag worker error for log %s: %s", log_id, result.get("error")\n                            )',
    'logger.error("[Worker] Tag worker error for log %s: %s", log_id, result.get("error"))  # noqa: E501',
)

with open("sidecar/src/workers/clustering.py", "w", encoding="utf-8") as f:
    f.write(content)
