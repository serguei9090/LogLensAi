import os
import sys
import time

# Ensure the sidecar/src directory is in the python path
sidecar_src = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "src"))
sys.path.insert(0, sidecar_src)

import tempfile  # noqa: E402

import pytest  # noqa: E402
from api import App  # noqa: E402
from db import Database  # noqa: E402


@pytest.fixture
def e2e_api():
    Database.reset()
    temp_dir = tempfile.gettempdir()
    db_path = os.path.join(temp_dir, "test_perf.duckdb")
    if os.path.exists(db_path):
        os.remove(db_path)
    app = App(db_path=db_path)
    # We must explicitly start the clustering worker for it to process the logs
    app.clustering_worker.start()
    yield app
    app.clustering_worker.stop()
    app.stop()
    Database.reset()


def test_upload_and_clustering_performance(e2e_api):
    workspace_id = "test_perf_ws"
    source_id = "source_apache"

    # Path to the sample log file
    test_file_path = os.path.abspath(
        os.path.join(os.path.dirname(__file__), "..", "..", "scripts", "drain3", "apache_logs.log")
    )

    assert os.path.exists(test_file_path), f"Test file not found: {test_file_path}"

    # Ensure burst mode is set to process it fast
    e2e_api.method_set_clustering_mode("burst")

    print(f"\nStarting ingestion of {test_file_path}...")
    start_time = time.time()

    # Trigger local file ingestion
    res = e2e_api.method_ingest_local_file(
        workspace_id=workspace_id, source_id=source_id, filepath=test_file_path
    )

    assert res["status"] in ("success", "started", "ok"), f"Ingestion failed: {res}"
    job_id = res.get("job_id")

    # Poll until ingestion and clustering are complete
    max_wait_seconds = 10
    poll_interval = 0.5
    elapsed = 0

    total_target_lines = 0
    ingestion_complete = False
    clustering_complete = False

    print(f"\nStrict Performance Window: {max_wait_seconds}s")
    
    while elapsed < max_wait_seconds:
        jobs = e2e_api.method_get_ingestion_jobs(workspace_id=workspace_id)
        job = next((j for j in jobs if j.get("id") == job_id), None) if jobs else None

        if job:
            total_target_lines = job.get('total_lines', 0)
            processed = job.get('processed_lines', 0)
            status = job['status']
            progress_pct = (processed / total_target_lines * 100) if total_target_lines > 0 else 0
            print(f"[{elapsed:4.1f}s] Ingestion: {processed}/{total_target_lines} ({progress_pct:4.1f}%) | Status: {status}")
            
            if status == "completed":
                ingestion_complete = True
            elif status == "failed":
                pytest.fail(f"Job failed unexpectedly: {job}")
        
        status_clustering = e2e_api.method_get_clustering_status()
        backlog = status_clustering["backlog"]
        print(f"[{elapsed:4.1f}s] Clustering Backlog: {backlog}")
        
        if ingestion_complete and backlog == 0:
            clustering_complete = True
            break

        time.sleep(poll_interval)
        elapsed += poll_interval

    end_time = time.time()
    total_time = end_time - start_time

    # Check final stats
    logs_res = e2e_api.method_get_logs(workspace_id=workspace_id, limit=1)
    final_processed_logs = logs_res.get("total", 0)
    clusters = e2e_api.method_get_clusters(workspace_id=workspace_id)
    total_clusters = len(clusters)

    print("\n--- Final Results ---")
    print(f"Total time taken: {total_time:.2f} seconds")
    if total_time > 0:
        print(f"Average speed: {final_processed_logs / total_time:.2f} lines/sec")
    print(f"Total clusters found: {total_clusters}")
    print(f"Total logs in DB: {final_processed_logs} / {total_target_lines}")

    # Enforce strict 50% threshold for failure
    if total_target_lines > 0:
        completion_pct = (final_processed_logs / total_target_lines) * 100
        print(f"Final Completion: {completion_pct:.1f}%")
        if completion_pct < 50:
            pytest.fail(f"Performance too slow! Only {completion_pct:.1f}% of logs processed in {max_wait_seconds}s.")
    
    assert ingestion_complete, "Ingestion did not complete within the strict timeout."
    assert clustering_complete, "Clustering did not complete within the strict timeout."
    assert total_clusters > 0, "No clusters were formed"
