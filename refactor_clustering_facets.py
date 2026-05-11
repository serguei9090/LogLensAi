
with open('sidecar/src/workers/clustering.py', encoding='utf-8') as f:
    content = f.read()

# Update Phase 1: Train
old_phase1 = '''                parser = self.app.get_drain_parser(ws_id)
                res = parser.parse(meta["message"])  # ? updates tree
                cluster_id, template = res["cluster_id"], res["template"]

                key = (ws_id, cluster_id, template)
                cluster_increments[key] = cluster_increments.get(key, 0) + 1'''

new_phase1 = '''                parser = self.app.get_drain_parser(ws_id)
                res = parser.parse(meta["message"])  # ? updates tree
                cluster_id, template = res["cluster_id"], res["template"]
                
                if "facets" in res:
                    meta["facets"].update(res["facets"])

                key = (ws_id, cluster_id, template)
                cluster_increments[key] = cluster_increments.get(key, 0) + 1'''

content = content.replace(old_phase1, new_phase1)

# Update Phase 2: Tag
old_phase2 = '''            if temp_miner:
                match_result = temp_miner.match(message)
                if match_result:
                    cluster_id = str(match_result.cluster_id)
                    template = match_result.get_template()'''

new_phase2 = '''            if temp_miner:
                match_result = temp_miner.match(message)
                if match_result:
                    cluster_id = str(match_result.cluster_id)
                    template = match_result.get_template()
                    try:
                        params = temp_miner.extract_parameters(template, message, exact_matching=False)
                        if params:
                            for param in params:
                                mask_key = param.mask_name.strip("<>").lower()
                                meta["facets"][mask_key] = param.value
                    except Exception:
                        pass'''

content = content.replace(old_phase2, new_phase2)

with open('sidecar/src/workers/clustering.py', 'w', encoding='utf-8') as f:
    f.write(content)
