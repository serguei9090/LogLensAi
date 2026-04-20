import pytest
from api import App
from models import FusionSourceConfig, IngestLogEntry


@pytest.fixture
def api():
    # Use memory DB for isolation
    app = App(db_path=":memory:")
    yield app
    from db import Database

    Database.reset()


def test_get_fused_logs_with_timezone_shift(api):
    # Log 1: UTC Time 10:00:00 from London (Offset 0)
    # Log 2: UTC Time 09:00:00 but from EST (Offset -5) -> Actually 14:00:00 UTC
    # Wait, the offset should be used to NORMALIZE to a single view.
    # Currently, LogLensAi NORMALIZE by SHIFTING the raw timestamp by the offset.
    # If source_id = 'EST', tz_offset = -5, it means "Add -5 hours to display this in UTC".
    # NO: Usually it means "Original string is EST, add 5 hours to get UTC".
    # Let's check sidecar logic in api.py:
    # dt = dt + timedelta(hours=offset)
    # So if offset is 5, it ADDS 5 hours to the string.

    api.method_ingest_logs(
        [
            IngestLogEntry(
                workspace_id="ws1",
                source_id="src_london",
                raw_text="2024-01-01 10:00:00 INFO London event",
                timestamp="2024-01-01 10:00:00",
            ),
            IngestLogEntry(
                workspace_id="ws1",
                source_id="src_nyc",
                raw_text="2024-01-01 10:00:00 INFO NYC event",
                timestamp="2024-01-01 10:00:00",
            ),
        ]
    )

    # Fusion config: NYC has 5 hour offset
    sources = [
        FusionSourceConfig(source_id="src_london", enabled=True, tz_offset=0),
        FusionSourceConfig(source_id="src_nyc", enabled=True, tz_offset=5),  # NYC+5 hours
    ]
    api.method_update_fusion_config(workspace_id="ws1", fusion_id="f1", sources=sources)

    # Fetch fused logs
    res = api.method_get_fused_logs(workspace_id="ws1", fusion_id="f1")
    logs = res["logs"]

    # Identify logs in the result
    london_log = next(log for log in logs if log["source_id"] == "src_london")
    nyc_log = next(log for log in logs if log["source_id"] == "src_nyc")

    assert london_log["timestamp"] == "2024-01-01 10:00:00"
    assert nyc_log["timestamp"] == "2024-01-01 15:00:00"  # 10:00 + 5


def test_get_fused_logs_with_disabled_source(api):
    api.method_ingest_logs(
        [
            IngestLogEntry(workspace_id="ws1", source_id="src1", raw_text="Log 1"),
            IngestLogEntry(workspace_id="ws1", source_id="src2", raw_text="Log 2"),
        ]
    )

    # Only src1 enabled
    sources = [
        FusionSourceConfig(source_id="src1", enabled=True, tz_offset=0),
        FusionSourceConfig(source_id="src2", enabled=False, tz_offset=0),
    ]
    api.method_update_fusion_config(workspace_id="ws1", fusion_id="f1", sources=sources)

    res = api.method_get_fused_logs(workspace_id="ws1", fusion_id="f1")
    assert len(res["logs"]) == 1
    assert res["logs"][0]["source_id"] == "src1"
