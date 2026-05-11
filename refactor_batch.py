
with open("sidecar/src/workers/clustering.py", encoding="utf-8") as f:
    content = f.read()

# 1. Rename _tag_log_row to _tag_log_batch and modify signature
old_func = """def _tag_log_row(  # noqa: PLR0913
    row: tuple,
    cluster_map: dict,
    miner_config: Any,
    rules: list,
    p_config: dict,
    p_tz: int,
    _now: float,
) -> dict:"""

new_func = """def _tag_log_batch(  # noqa: PLR0913
    rows: list[tuple],
    cluster_map: dict,
    miner_config: Any,
    rules: list,
    p_config: dict,
    p_tz: int,
    _now: float,
) -> list[dict]:"""

if old_func in content:
    content = content.replace(old_func, new_func)

# 2. Modify the implementation of the worker function
old_body_start = '''    """
    Pure, picklable function executed in a child process.

    Performs metadata extraction and cluster-matching against a snapshot of
    the Drain tree. It reconstructs a temporary, in-memory TemplateMiner
    from the cluster map to leverage the official `match` logic.

    Never writes to the Drain tree or the database.

    Returns a result dict with keys:
      - log_id, ws_id, source_id, cluster_id, template, timestamp, level,
        facets_json, status ('ok' | 'missing' | 'error')
    """
    log_id, ws_id, source_id, _line_id, facets_json, raw_text = row
    try:'''

new_body_start = '''    """
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

    return results'''

# We have to extract out the old body and replace it.
start_idx = content.find(old_body_start)
if start_idx != -1:
    end_marker = """        }
            logger.debug("Failed to parse", exc_info=True)"""
    end_idx = content.find(end_marker, start_idx)
    if end_idx != -1:
        content = content[:start_idx] + new_body_start + content[end_idx + len(end_marker) :]

# 3. Update the call to the worker function in _process_batch
old_submit = """                miner_config = parser.miner.config
                for row in rows:
                    fut = self._executor.submit(
                        _tag_log_row, row, cluster_map, miner_config, rules, p_config, p_tz, now
                    )
                    futures.append(fut)"""

new_submit = """                miner_config = parser.miner.config
                # Dispatch the entire list of rows for this source as one batch
                fut = self._executor.submit(
                    _tag_log_batch, rows, cluster_map, miner_config, rules, p_config, p_tz, now
                )
                futures.append(fut)"""

if old_submit in content:
    content = content.replace(old_submit, new_submit)

with open("sidecar/src/workers/clustering.py", "w", encoding="utf-8") as f:
    f.write(content)
