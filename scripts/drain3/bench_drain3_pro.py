import json
import os
import time

from drain3 import TemplateMiner
from drain3.template_miner_config import TemplateMinerConfig


def process_apache_logs_pro():
    log_file_path = "apache_logs.log"
    if not os.path.exists(log_file_path):
        # Try local path relative to script
        log_file_path = os.path.join(os.path.dirname(__file__), "apache_logs.log")
        if not os.path.exists(log_file_path):
            print(f"Error: {log_file_path} not found.")
            return

    # 1. Setup Configuration
    config = TemplateMinerConfig()
    config.drain_sim_th = 0.4
    config.drain_max_children = 100
    config.drain_max_clusters = 1000
    # Enable parameter extraction regex caching
    config.parameter_extraction_cache_capacity = 1000
    
    miner = TemplateMiner(config=config)

    # 2. Phase 1: Training Pass (Sampling)
    train_sample_size = 5000
    print(f"--- Phase 1: Training on first {train_sample_size} lines ---")
    
    lines = []
    with open(log_file_path, encoding="utf-8", errors="ignore") as f:
        for i, line in enumerate(f):
            if i >= 10000:
                break  # Load a buffer
            lines.append(line.strip())

    train_start = time.time()
    for i in range(min(train_sample_size, len(lines))):
        miner.add_log_message(lines[i])
    train_end = time.time()
    
    print(f"Training took: {train_end - train_start:.4f}s ({len(miner.drain.clusters)} clusters)")

    # 3. Phase 2: Inference Pass (Tagging)
    print("\n--- Phase 2: Inference (Tagging) benchmark ---")
    tag_start = time.time()
    match_count = 0
    fail_count = 0
    
    # We use a larger set for tagging test
    test_lines = lines[train_sample_size:10000]
    for line in test_lines:
        result = miner.match(line)
        if result:
            match_count += 1
        else:
            fail_count += 1
    
    tag_end = time.time()
    tag_duration = tag_end - tag_start
    print(f"Tagging {len(test_lines)} lines took: {tag_duration:.4f}s")
    print(f"Match Rate: {(match_count/len(test_lines))*100:.2f}%")
    if tag_duration > 0:
        print(f"Tagging Speed: {len(test_lines) / tag_duration:.2f} lines/sec")

    # 4. Phase 3: Facet Extraction Test (100 lines)
    print("\n--- Phase 3: Facet Extraction Test (Sample of 5) ---")
    for i, line in enumerate(lines[0:100]):
        result = miner.add_log_message(line) # Ensure it exists in tree
        params = miner.extract_parameters(result["template_mined"], line, exact_matching=True)
        
        if i < 5:
            print(f"\nLog: {line[:80]}...")
            print(f"Template: {result['template_mined']}")
            param_list = [p.value for p in params]
            print(f"Extracted Facets (Slots): {param_list}")

    # Write a small sample to verify the idea
    test_results = {
        "summary": {
            "training_speed": train_sample_size / (train_end - train_start),
            "tagging_speed": len(test_lines) / tag_duration if tag_duration > 0 else 0,
            "match_rate": match_count / len(test_lines) if len(test_lines) > 0 else 0
        },
        "sample_extractions": []
    }
    
    for line in lines[100:105]:
        res = miner.add_log_message(line)
        params = miner.extract_parameters(res["template_mined"], line)
        test_results["sample_extractions"].append({
            "log": line,
            "template": res["template_mined"],
            "params": [p.value for p in params]
        })

    with open("bench_results_pro.json", "w") as f:
        json.dump(test_results, f, indent=2)
    print("\nDetailed results saved to bench_results_pro.json")

if __name__ == "__main__":
    process_apache_logs_pro()
