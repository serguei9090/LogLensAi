from unittest.mock import MagicMock, patch

import pytest
from ai import AIProviderFactory
from ai.openai_compatible import OpenAICompatibleProvider


@pytest.mark.asyncio
async def test_factory_lmstudio_resolution():
    settings = {
        "ai_lmstudio_host": "http://my-lm-studio:1234/v1"
    }
    provider = AIProviderFactory.get_provider("lmstudio", settings=settings)
    
    assert isinstance(provider, OpenAICompatibleProvider)
    assert provider.host == "http://my-lm-studio:1234/v1"

@pytest.mark.asyncio
async def test_lmstudio_model_listing():
    settings = {
        "ai_lmstudio_host": "http://localhost:1234/v1"
    }
    provider = AIProviderFactory.get_provider("lmstudio", settings=settings)
    
    mock_resp_data = {
        "data": [
            {"id": "publisher/model-1"},
            {"id": "publisher/model-2"}
        ]
    }
    
    with patch("httpx.AsyncClient.get") as mock_get:
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = mock_resp_data
        mock_get.return_value = mock_resp
        
        models = await provider.list_models()
        assert models == ["publisher/model-1", "publisher/model-2"]

@pytest.mark.asyncio
async def test_lmstudio_test_connection_success():
    settings = {
        "ai_lmstudio_host": "http://localhost:1234/v1"
    }
    provider = AIProviderFactory.get_provider("lmstudio", settings=settings)
    
    with patch("httpx.AsyncClient.get") as mock_get:
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {"data": [{"id": "any"}]}
        mock_get.return_value = mock_resp
        
        status = await provider.test_connection()
        assert status["status"] == "success"
