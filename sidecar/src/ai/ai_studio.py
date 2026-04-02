import os
from typing import List, Optional
import asyncio
from google.adk.agents.llm_agent import LlmAgent
from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService
from google.genai import types, Client
from .base import AIProvider, AIChatMessage

DEFAULT_MODEL = "gemini-2.5-flash"

class AIStudioProvider(AIProvider):
    """Direct provider using Google AI Studio (API Key)."""

    def __init__(self, api_key: str):
        self.api_key = api_key
        # We wrap the client for list_models and other direct calls
        self._client = Client(api_key=api_key) if api_key else None

    async def list_models(self) -> List[str]:
        """Fetches available Gemini models from the API."""
        if not self._client:
            return [DEFAULT_MODEL]
            
        try:
            # Note: This is a synchronous call in google-genai currently
            # but we run it in executor for safety
            loop = asyncio.get_event_loop()
            models = await loop.run_in_executor(None, self._client.models.list)
            return [m.name for m in models if "gemini" in m.name.lower()]
        except Exception:
            return [DEFAULT_MODEL, "gemini-2.5-pro"]

    async def chat(self, messages: List[AIChatMessage], model: Optional[str] = None, session_id: Optional[str] = None, provider_session_id: Optional[str] = None) -> AIChatMessage:
        """Sends a message to Gemini via ADK Agent."""
        if not self.api_key:
            return AIChatMessage(role="assistant", content="Error: No API Key configured for AI Studio.")

        # Create a transient agent for this request
        # In a real session, we'd use the ADK session management
        agent = LlmAgent(
            name="ai_studio_agent",
            model=model,
            instruction="Expert log analyst. Provide concise and accurate assistance."
        )
        
        # Configure the client via environment or ADK config if possible
        # For now, we manually use the client/runner if ADK allows 
        # Actually ADK uses the environment variable 'GOOGLE_API_KEY'
        os.environ["GOOGLE_API_KEY"] = self.api_key
        
        # Reconstruct context for the runner
        # Since we use InMemorySessionService, we must populate it with history
        # of the current session before running the new message.
        session_service = InMemorySessionService()
        user_id = "default_user"
        # 1. Standard history injection via ADK Session (this is the AI Studio "Auto-Heal")
        adk_session_id = session_id or "temp_session"
        for msg in messages[:-1]:
            role = "user" if msg.role == "user" else "model"
            content = types.Content(role=role, parts=[types.Part(text=msg.content)])
            await session_service.add_message(user_id, adk_session_id, content)

        runner = Runner(agent=agent, app_name="LogLensAi", session_service=session_service)
        
        last_msg = messages[-1]
        content = types.Content(role="user", parts=[types.Part(text=last_msg.content)])
        
        response_text = ""
        try:
            async for event in runner.run_async(user_id=user_id, session_id=adk_session_id, new_message=content):
                if event.is_final_response() and event.content:
                    response_text = event.content.parts[0].text
            
            # Note: adk_session_id acts as our provider_session_id here
            return AIChatMessage(role="assistant", content=response_text, provider_session_id=adk_session_id)
        except Exception as e:
            return AIChatMessage(role="assistant", content=f"AI Studio Error: {str(e)}")

    async def analyze_logs(self, template: str, samples: List[str]) -> dict:
        """Specific one-off analysis for log clusters."""
        # For simple analysis, we use the direct client to avoid session overhead
        if not self._client: return {"summary": "No API Key", "root_cause": "", "recommended_actions": []}
        
        prompt = (
            "You are a Log Analysis Specialist. Return JSON with 'summary', 'root_cause', 'recommended_actions'.\n\n"
            f"Cluster template: {template}\nSample logs:\n" + "\n".join(samples)
        )
        
        try:
            loop = asyncio.get_event_loop()
            response = await loop.run_in_executor(
                None, 
                lambda: self._client.models.generate_content(
                    model=DEFAULT_MODEL, 
                    config=types.GenerateContentConfig(response_mime_type='application/json'),
                    contents=prompt
                )
            )
            return response.parsed
        except Exception as e:
            return {"summary": "Analysis failed", "root_cause": str(e), "recommended_actions": []}
