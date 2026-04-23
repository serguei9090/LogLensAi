
import pytest
from db import LogDatabase


@pytest.fixture
def db(tmp_path):
    db_file = tmp_path / "test_hierarchy.db"
    db = LogDatabase(str(db_file))
    yield db
    db.reset()


def test_folder_crud(db):
    workspace_id = "test_ws"
    f1_id = "f1"
    db.create_folder(workspace_id, f1_id, "Folder 1")

    hierarchy = db.get_hierarchy(workspace_id)
    assert len(hierarchy["root"]["children"]) == 1
    assert hierarchy["root"]["children"][0]["name"] == "Folder 1"

    db.update_folder(f1_id, name="Folder 1 Renamed")
    hierarchy = db.get_hierarchy(workspace_id)
    assert hierarchy["root"]["children"][0]["name"] == "Folder 1 Renamed"

    f2_id = "f2"
    db.create_folder(workspace_id, f2_id, "Folder 2", parent_id=f1_id)
    hierarchy = db.get_hierarchy(workspace_id)
    assert len(hierarchy["root"]["children"][0]["children"]) == 1
    assert hierarchy["root"]["children"][0]["children"][0]["id"] == f2_id

    db.delete_folder(f1_id)
    hierarchy = db.get_hierarchy(workspace_id)
    # Folder 2 should now be at root
    assert len(hierarchy["root"]["children"]) == 1
    assert hierarchy["root"]["children"][0]["id"] == f2_id


def test_source_management(db):
    workspace_id = "test_ws"
    s1_id = "s1"
    db.upsert_log_source(workspace_id, s1_id, "Source 1", "file", "/path/1")

    hierarchy = db.get_hierarchy(workspace_id)
    assert len(hierarchy["root"]["sources"]) == 1
    assert hierarchy["root"]["sources"][0]["name"] == "Source 1"

    f1_id = "f1"
    db.create_folder(workspace_id, f1_id, "Folder 1")
    db.update_log_source(s1_id, folder_id=f1_id)

    hierarchy = db.get_hierarchy(workspace_id)
    assert len(hierarchy["root"]["sources"]) == 0
    assert len(hierarchy["root"]["children"][0]["sources"]) == 1
    assert hierarchy["root"]["children"][0]["sources"][0]["id"] == s1_id


def test_get_workspace_sources_mixed(db):
    workspace_id = "test_ws"
    # Source in table
    db.upsert_log_source(workspace_id, "s1", "Managed", "file", "/path/managed")

    # Source only in logs (legacy/implicit)
    cursor = db.get_cursor()
    cursor.execute(
        "INSERT INTO logs (workspace_id, source_id, raw_text, timestamp) VALUES (?, ?, ?, ?)",
        (workspace_id, "/path/implicit", "test", "2023-01-01 00:00:00"),
    )
    db.commit()

    from api import App

    app = App()
    app.db = db

    sources = app.method_get_workspace_sources(workspace_id)
    assert "/path/managed" in sources
    assert "/path/implicit" in sources
    assert len(sources) == 2
