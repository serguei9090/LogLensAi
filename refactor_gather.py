
with open("sidecar/src/workers/clustering.py", encoding="utf-8") as f:
    content = f.read()

old_gather = """            for fut in as_completed(futures):
                try:
                    result = fut.result()
                    status = result["status"]
                    log_id = result["log_id"]
                    ws_id = result["ws_id"]
                    source_id = result["source_id"]

                    if status == "ok":
                        cluster_id = result["cluster_id"]
                        template = result["template"]

                        if cluster_id and template:
                            key = (ws_id, cluster_id, template)
                            cluster_increments[key] = cluster_increments.get(key, 0) + 1

                        updates.append(
                            (
                                result["timestamp"],
                                result["level"],
                                result["facets_json"],
                                cluster_id,
                                log_id,
                            )
                        )
                        job_key = (ws_id, source_id)
                        batch_counts[job_key] = batch_counts.get(job_key, 0) + 1

                    elif status == "missing":
                        updates.append((None, "MISSING", "{}", None, log_id))

                    else:
                        logger.error(
                            "[Worker] Tag worker error for log %s: %s", log_id, result.get("error")
                        )
                        updates.append((None, "ERROR", result.get("facets_json"), None, log_id))

                except Exception:
                    logger.exception("[Worker] Future resolution failed:")"""

new_gather = """            for fut in as_completed(futures):
                try:
                    batch_results = fut.result()
                    for result in batch_results:
                        status = result["status"]
                        log_id = result["log_id"]
                        ws_id = result["ws_id"]
                        source_id = result["source_id"]

                        if status == "ok":
                            cluster_id = result["cluster_id"]
                            template = result["template"]

                            if cluster_id and template:
                                key = (ws_id, cluster_id, template)
                                cluster_increments[key] = cluster_increments.get(key, 0) + 1

                            updates.append(
                                (
                                    result["timestamp"],
                                    result["level"],
                                    result["facets_json"],
                                    cluster_id,
                                    log_id,
                                )
                            )
                            job_key = (ws_id, source_id)
                            batch_counts[job_key] = batch_counts.get(job_key, 0) + 1

                        elif status == "missing":
                            updates.append((None, "MISSING", "{}", None, log_id))

                        else:
                            logger.error(
                                "[Worker] Tag worker error for log %s: %s", log_id, result.get("error")
                            )
                            updates.append((None, "ERROR", result.get("facets_json"), None, log_id))

                except Exception:
                    logger.exception("[Worker] Future resolution failed:")"""

if old_gather in content:
    content = content.replace(old_gather, new_gather)
else:
    print("Could not find old_gather!")

with open("sidecar/src/workers/clustering.py", "w", encoding="utf-8") as f:
    f.write(content)
