from db import LogDatabase


def test_db_extra_migrations():
    db = LogDatabase(":memory:")
    cursor = db.get_cursor()
    # It should have already run migrations, let's call them manually for coverage
    db._run_migrations(cursor)
    db._migrate_fast_path_schema(cursor)
    db._migrate_ingestion_columns(cursor)
    db._migrate_ingestion_jobs(cursor)
    db._migrate_indexes(cursor)
    db._migrate_ai_tables(cursor)
    db._migrate_fusion_pk(cursor)
    db._migrate_fusion_time_shift(cursor)
    db._migrate_log_columns(cursor)
    db._migrate_log_facets(cursor)


def test_db_extra_parse_filters():
    db = LogDatabase(":memory:")
    filters = [
        {"field": "level", "operator": "equals", "value": "ERROR"},
        {"field": "source_id", "operator": "contains", "value": "src1"},
        {"field": "facets.custom", "operator": "not_equals", "value": "val"},
    ]
    clauses, params = db._parse_filters(filters)
    assert len(clauses) == 3
    assert len(params) == 3


def test_db_extra_apply_temporal_offsets():
    db = LogDatabase(":memory:")
    cursor = db.get_cursor()
    cursor.execute(
        "INSERT INTO temporal_offsets (workspace_id, source_id, offset_seconds) VALUES ('ws1', 'src1', 3600)"
    )
    db.commit()

    logs = [
        {"source_id": "src1", "timestamp": "2026-05-18T10:00:00.000Z"},
        {"source_id": "src2", "timestamp": "2026-05-18T10:00:00.000Z"},  # No config
    ]
    db._apply_temporal_offsets("ws1", logs)
    assert logs[0]["timestamp"] == "2026-05-18 11:00:00"


def test_db_extra_folder_ops():
    db = LogDatabase(":memory:")
    db.create_folder("ws1", "f1", "Folder 1")
    db.update_folder("f1", "Folder 1 Updated")
    db.delete_folder("f1")


def test_db_extra_source_ops():
    db = LogDatabase(":memory:")
    db.upsert_log_source("ws1", "src1", "Source 1", "local", "path/to/file")
    db.update_log_source("src1", name="Source 1 Updated", type="local", path="path/to/file2")
    db.delete_log_source("src1")


def test_db_extra_ingestion_jobs():
    db = LogDatabase(":memory:")
    job_id = db.create_ingestion_job("ws1", "src1", 100)
    assert job_id is not None
    db.update_ingestion_progress(job_id, 50)
    jobs = db.get_ingestion_jobs("ws1")
    assert len(jobs) == 1
    assert jobs[0]["processed_lines"] == 50
