# Assume Role: Automation Engineer (@test)
import pytest
from ai.tools import CreateColumnParams, CreateFacetParams, ToolRegistry


class MockApp:
    def __init__(self):
        self.settings = {}

    def method_get_settings(self, workspace_id=None):
        return self.settings

    def method_update_settings(self, settings, workspace_id=None):
        self.settings.update(settings)
        return {"status": "success"}


def test_tool_schemas_registered():
    app = MockApp()
    registry = ToolRegistry(app)
    schemas = registry.get_tool_schemas()

    # Check that new tools are listed in schemas
    names = [s["function"]["name"] for s in schemas]
    assert "create_column" in names
    assert "create_facet" in names


@pytest.mark.anyio
async def test_create_column_tool():
    app = MockApp()
    registry = ToolRegistry(app)

    params = CreateColumnParams(label="TestCol", source="user", regex="user=(\\w+)")
    res = await registry.create_column(None, params)
    assert res["status"] == "success"
    assert "add_column" in res["a2ui_block"]
    assert "TestCol" in res["a2ui_block"]


@pytest.mark.anyio
async def test_create_facet_tool():
    app = MockApp()
    registry = ToolRegistry(app)

    params = CreateFacetParams(workspace_id="ws1", pattern="test=(\\d+)", label="test_id")
    res = await registry.create_facet(None, params)
    assert res["status"] == "success"

    # Settings should contain the updated drain_masks
    settings = app.method_get_settings("ws1")
    assert "drain_masks" in settings
    import json

    masks = json.loads(settings["drain_masks"])
    assert len(masks) == 1
    assert masks[0]["label"] == "test_id"
    assert masks[0]["pattern"] == "test=(\\d+)"
