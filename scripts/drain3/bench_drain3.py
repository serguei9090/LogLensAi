import os
import time

from drain3 import TemplateMiner
from drain3.template_miner_config import TemplateMinerConfig


def process_apache_logs():
    log_file_path = "apache_logs.log"
    if not os.path.exists(log_file_path):
        print(f"Error: {log_file_path} not found in the current directory.")
        return

    # Initialize Drain3 Configuration
    config = TemplateMinerConfig()
    config.drain_sim_th = 0.4
    config.drain_max_children = 100
    config.drain_max_clusters = 1000
    
    # Initialize TemplateMiner
    miner = TemplateMiner(config=config)

    print(f"Starting ingestion of {log_file_path}...")
    
    start_time = time.time()
    line_count = 0
    
    with open(log_file_path, encoding="utf-8", errors="ignore") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            
            # Mimic main code clustering
            miner.add_log_message(line)
            line_count += 1
            
            if line_count % 5000 == 0:
                print(f"Processed {line_count} lines...")

    end_time = time.time()
    duration = end_time - start_time

    print("\n--- Ingestion Complete ---")
    print(f"Total lines processed: {line_count}")
    print(f"Total time taken: {duration:.4f} seconds")
    if line_count > 0:
        print(f"Average speed: {line_count / duration:.2f} lines/sec")
    print(f"Total clusters found: {len(miner.drain.clusters)}")
    print("--------------------------")

if __name__ == "__main__":
    process_apache_logs()
