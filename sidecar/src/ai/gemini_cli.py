import asyncio
import json
import os
from typing import Any, List, Optional
import aiohttp
from .base import AIProvider, AIChatMessage

class GeminiCLIProvider(AIProvider):
    """
    Provider for Gemini CLI. 
    Supports 'Hot Mode' via A2A Server (sub-second latency) 
    and 'Cold Mode' via direct subprocess (fallback).
    """
    
    DEFAULT_MODEL = "gemini-2.5-flash"

    def __init__(self, host: str = "http://localhost:22436"):
        self.host = host.rstrip("/")
        # session_id -> taskId mapping to achieve Hot Mode persistence
        self._task_cache = {} 
        self.timeout = aiohttp.ClientTimeout(total=30)
    
    def _extract_json(self, output: str) -> dict:
        """Helper to find and parse the FIRST valid JSON object in a string."""
        start = output.find("{")
        end = output.rfind("}")
        if start == -1 or end == -1 or end < start:
            raise ValueError("No valid JSON object found in output")
        return json.loads(output[start:end+1])

    async def list_models(self) -> List[str]:
        return [self.DEFAULT_MODEL, "gemini-2.0-flash", "gemini-pro"]

    async def _get_or_create_task(self, session: aiohttp.ClientSession, session_id: str, messages: List[AIChatMessage]) -> str:
        """Fetch existing taskId or create a new one and re-inject history if needed."""
        task_id = self._task_cache.get(session_id)
        
        # Verify if task is still alive on server
        if task_id:
            try:
                # Minimal check: try to fetch task info or just proceed
                # If it fails during message/stream, we'll catch it and recreate
                pass
            except Exception:
                task_id = None

        if not task_id:
            # Create new task
            async with session.post(f"{self.host}/tasks", json={"agentSettings": {"autoExecute": True}}) as resp:
                if resp.status != 200:
                    raise RuntimeError(f"Failed to create A2A task: {await resp.text()}")
                task_id = await resp.json()
                self._task_cache[session_id] = task_id
                
                # Re-inject history (all messages except the very last one which is the new user prompt)
                if len(messages) > 1:
                    for msg in messages[:-1]:
                        payload = {
                            "jsonrpc": "2.0", "id": "hist", "method": "message/stream",
                            "params": {"message": {"taskId": task_id, "parts": [{"kind": "text", "text": msg.content}]}}
                        }
                        # We send them sequentially to preserve order. 
                        # Note: We don't need to consume the full stream for history injection, but the server expects it to finish.
                        async with session.post(f"{self.host}/", json=payload) as hresp:
                            await hresp.release() # Just ensure it's sent
        
        return task_id

    async def chat(self, messages: List[AIChatMessage], model: Optional[str] = None, session_id: Optional[str] = None) -> AIChatMessage:
        """Execute chat using A2A Hot Mode if available, falling back to Cold Mode."""
        if not session_id:
            return await self._chat_cold(messages, model)

        try:
            return await self._chat_hot(session_id, messages)
        except Exception:
            return await self._chat_cold(messages, model)

    async def _chat_hot(self, session_id: str, messages: List[AIChatMessage]) -> AIChatMessage:
        """Core Hot Mode logic via A2A Server."""
        async with aiohttp.ClientSession(timeout=self.timeout) as session:
            task_id = await self._get_or_create_task(session, session_id, messages)
            
            # Send the final user message
            last_msg = messages[-1].content
            payload = {
                "jsonrpc": "2.0", "id": "m1", "method": "message/stream",
                "params": {"message": {"taskId": task_id, "parts": [{"kind": "text", "text": last_msg}]}}
            }
            
            full_response = []
            async with session.post(f"{self.host}/", json=payload) as resp:
                if resp.status != 200:
                    self._task_cache.pop(session_id, None)
                    raise RuntimeError(f"Server error {resp.status}")
                
                async for line in resp.content:
                    chunk = self._parse_sse_response(line)
                    if chunk:
                        full_response.append(chunk)
            
            content = "".join(full_response)
            if not content:
                raise RuntimeError("Empty response from A2A server")
            
            # Persist to disk
            messages.append(AIChatMessage(role="assistant", content=content))
            self._sync_to_disk(session_id, messages)
            
            return AIChatMessage(role="assistant", content=content)

    def _parse_sse_response(self, line: bytes) -> Optional[str]:
        """Helper to extract text from a single SSE data line."""
        line_str = line.decode().strip()
        if not line_str.startswith("data: "):
            return None
            
        try:
            data = json.loads(line_str[6:])
            msg = data.get("result", {}).get("status", {}).get("message", {})
            if msg.get("role") == "agent":
                parts = []
                for part in msg.get("parts", []):
                    if part.get("kind") == "text":
                        parts.append(part.get("text", ""))
                return "".join(parts)
        except Exception:
            pass
        return None

    def _sync_to_disk(self, session_id: str, messages: List[AIChatMessage]):
        """Persist session history to local JSON files for redundancy."""
        try:
            base_dir = "gemini_sessions"
            chat_back = os.path.join(base_dir, "chat_back")
            os.makedirs(chat_back, exist_ok=True)
            
            # Save the full history for this session
            filename = f"session-{session_id}.json"
            filepath = os.path.join(chat_back, filename)
            
            history_data = [msg.model_dump() for msg in messages]
            with open(filepath, "w", encoding="utf-8") as f:
                json.dump(history_data, f, indent=2)
                
            # Note: session_names.json update is skipped here as we don't have the name.
            # api.py handles sessions names in DuckDB which is more reliable.
        except Exception:
            pass # Non-critical backup failure

    async def _chat_cold(self, messages: List[AIChatMessage], model: Optional[str] = None) -> AIChatMessage:
        """Original Cold Mode logic as a fallback."""
        target_model = model or self.DEFAULT_MODEL
        prompt_parts = []
        for msg in messages:
            prefix = "User" if msg.role == "user" else "Assistant"
            prompt_parts.append(f"{prefix}: {msg.content}")
        
        prompt = "\n\n".join(prompt_parts) + "\n\nAssistant: "
        
        try:
            process = await asyncio.create_subprocess_exec(
                "gemini", "-p", prompt, 
                "-m", target_model,
                "-o", "json", 
                "--raw-output", "--accept-raw-output-risk",
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            stdout, stderr = await process.communicate()
            output_str = stdout.decode().strip()
            
            if process.returncode != 0:
                error_msg = stderr.decode().strip()
                return AIChatMessage(role="assistant", content=f"Gemini CLI Error (Code {process.returncode}): {error_msg}")

            try:
                 obj = self._extract_json(output_str)
                 content = obj.get("response", output_str)
            except Exception:
                 content = output_str
                 
            return AIChatMessage(role="assistant", content=content)
        except Exception as e:
            return AIChatMessage(role="assistant", content=f"Gemini Cold Fallback Error: {str(e)}")

    async def analyze_logs(self, template: str, samples: List[str]) -> dict:
        """Diagnostic analysis remains cold for now as it's typically a one-off."""
        prompt = (
            "You are a Log Analysis Specialist. Return JSON with summary, root_cause, actions.\n\n"
            f"Cluster template: {template}\nSample logs:\n" + "\n".join(samples)
        )
        
        try:
             process = await asyncio.create_subprocess_exec(
                "gemini", "-p", prompt, 
                "-m", self.DEFAULT_MODEL,
                "-o", "json", 
                "--raw-output", "--accept-raw-output-risk",
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
             )
             stdout, stderr = await asyncio.wait_for(process.communicate(), timeout=30)
             output_str = stdout.decode().strip()
             
             if process.returncode != 0:
                  error_msg = stderr.decode().strip()
                  raise RuntimeError(f"Gemini CLI Error (Code {process.returncode}): {error_msg}")
                  
             try:
                  obj = self._extract_json(output_str)
                  raw_response = obj.get("response", output_str)
                  return json.loads(raw_response)
             except Exception:
                  return {"summary": output_str, "root_cause": "Parsing failed", "recommended_actions": []}
                  
        except Exception as e:
             return {"summary": "Analysis failed", "root_cause": str(e), "recommended_actions": []}
