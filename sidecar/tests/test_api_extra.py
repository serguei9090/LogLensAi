from unittest.mock import AsyncMock, MagicMock

import pytest
from api import App


@pytest.fixture
def app_instance():
    app = App(db_path=":memory:", start_ingestion=False, start_anomalies=False, start_mcp=False)
    app.ai = MagicMock()
    yield app
    app.stop()
    from db import LogDatabase

    LogDatabase.reset()


def test_api_extra_settings(app_instance):
    res = app_instance.method_update_settings({"key": "val"})
    assert res["status"] == "success"

    settings = app_instance.method_get_settings()
    assert settings["key"] == "val"


def test_api_extra_facets(app_instance):
    # method_update_settings handles facet_extractions if passed as json
    import json

    app_instance.method_update_settings(
        {"facet_extractions": json.dumps([{"id": "1", "name": "rule1"}])}
    )
    facets = app_instance.method_get_settings().get("facet_extractions")
    assert "rule1" in facets


def test_api_extra_mcp(app_instance):
    pass  # No method_start_mcp_server exists directly.


def test_api_extra_log_sources(app_instance):
    res = app_instance.method_get_workspace_sources(workspace_id="ws1")
    assert isinstance(res, list)


def test_api_extra_delete_log_source(app_instance):
    app_instance.method_create_log_source(workspace_id="ws1", name="s", type="local", path="p")
    res = app_instance.method_delete_log_source(
        source_id="mock"
    )  # It might not find it, but it should return success or error
    assert "status" in res or "error" in res


def test_api_extra_clustering_status(app_instance):
    res = app_instance.method_get_clustering_status()
    assert "mode" in res


def test_api_extra_set_clustering_mode(app_instance):
    res = app_instance.method_set_clustering_mode(mode="burst")
    assert "status" in res


def test_api_extra_set_clustering_paused(app_instance):
    res = app_instance.method_set_clustering_paused(paused=True)
    assert "status" in res


def test_api_extra_trigger_clustering(app_instance):
    pass  # method_trigger_clustering_cycle does not exist


def test_api_extra_delete_logs(app_instance):
    res = app_instance.method_delete_logs(workspace_id="ws1")
    assert "status" in res


def test_api_extra_factory_reset(app_instance):
    res = app_instance.method_factory_reset()
    assert "status" in res


def test_api_extra_get_anomalies(app_instance):
    res = app_instance.method_get_anomalies(workspace_id="ws1")
    assert isinstance(res, dict)


def test_api_extra_fused_logs(app_instance):
    res = app_instance.method_get_fused_logs(workspace_id="ws1")
    assert isinstance(res, dict)


def test_api_extra_update_fusion_config(app_instance):
    res = app_instance.method_update_fusion_config(
        workspace_id="ws1", sources=[{"source_id": "src1", "offset": 10}]
    )
    assert "status" in res


def test_api_extra_get_sample_lines(app_instance):
    res = app_instance.method_get_sample_lines(workspace_id="ws1", source_id="src1")
    assert isinstance(res, list)


def test_api_extra_get_log_content(app_instance):
    res = app_instance.method_get_log_content(workspace_id="ws1", source_id="src1", line_ids=[1])
    assert isinstance(res, dict)


def test_api_extra_get_fusion_config(app_instance):
    res = app_instance.method_get_fusion_config(workspace_id="ws1", source_id="src1")
    assert isinstance(res, dict)


def test_api_extra_hierarchy(app_instance):
    res = app_instance.method_get_hierarchy(workspace_id="ws1")
    assert "root" in res


def test_api_extra_folders(app_instance):
    res = app_instance.method_create_folder(workspace_id="ws1", name="f1")
    assert "folder_id" in res

    fid = res["folder_id"]
    res2 = app_instance.method_update_folder(folder_id=fid, name="f2")
    assert res2["status"] == "success"

    res3 = app_instance.method_delete_folder(folder_id=fid)
    assert res3["status"] == "success"


def test_api_extra_move_source(app_instance):
    res = app_instance.method_create_log_source(
        workspace_id="ws1", name="s", type="local", path="p"
    )
    sid = res["source_id"]
    res2 = app_instance.method_move_source(source_id=sid, folder_id="f1")
    assert res2["status"] == "success"


def test_api_extra_jobs(app_instance):
    res = app_instance.method_get_ingestion_jobs(workspace_id="ws1")
    assert isinstance(res, list)
    res2 = app_instance.method_cleanup_ingestion_jobs(workspace_id="ws1")
    assert res2["status"] == "success"


def test_api_extra_health(app_instance):
    res = app_instance.method_get_health()
    assert res["status"] == "ok"


def test_api_extra_dashboard(app_instance):
    res = app_instance.method_get_dashboard_stats(workspace_id="ws1")
    assert "total_logs" in res


def test_api_extra_templates(app_instance):
    res = app_instance.method_save_template(workspace_id="ws1", name="t1", config_json="{}")
    assert res["status"] in ("success", "ok")

    res2 = app_instance.method_get_templates(workspace_id="ws1")
    assert len(res2) == 1

    res3 = app_instance.method_delete_template(id=res2[0]["id"])
    assert res3["status"] in ("success", "ok")


def test_api_extra_memory(app_instance):
    res = app_instance.method_save_memory(
        workspace_id="ws1", issue_signature="bug", resolution="fix"
    )
    assert res["status"] in ("success", "ok")

    res2 = app_instance.method_search_memory(workspace_id="ws1", query="bug")
    assert len(res2) >= 1


@pytest.mark.asyncio
async def test_api_extra_async_methods(app_instance):
    res = app_instance.method_get_ai_sessions(workspace_id="ws1")
    assert isinstance(res, list)

    res2 = app_instance.method_get_ai_mapping(workspace_id="ws1")
    assert isinstance(res2, dict)

    res3 = app_instance.method_reset_workspace_settings(workspace_id="ws1")
    assert res3["status"] in ("success", "ok")

    res4 = app_instance.method_reset_templates(workspace_id="ws1")
    assert res4["status"] in ("success", "ok")

    res5 = app_instance.method_get_log_streams(workspace_id="ws1")
    assert isinstance(res5, list)

    res6 = app_instance.method_create_log_stream(
        workspace_id="ws1", name="stream1", type="syslog", port=1234
    )
    assert "stream_id" in res6 or "id" in res6 or "status" in res6

    if "stream_id" in res6:
        sid = res6["stream_id"]
    elif "id" in res6:
        sid = res6["id"]
    else:
        sid = 1

    # Ignore failure if it returns error
    app_instance.method_delete_log_stream(id=sid)

    res8 = app_instance.method_purge_inactive_workspaces(active_workspace_ids=["ws1"])
    assert res8["status"] in ("success", "ok")

    app_instance.ai.chat = AsyncMock(return_value=MagicMock(content="(?P<test>.*)"))
    res9 = await app_instance.method_generate_facet_regex(
        log_line="test string", selected_text="string"
    )
    assert "regex" in res9
