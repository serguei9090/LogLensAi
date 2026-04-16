import asyncio
import json
import os
import sys

import aiohttp

from .base import AIChatMessage, AIProvider


class GeminiCLIProvider(AIProvider):
    """
    Provider for Gemini CLI. 
    Supports 'Hot Mode' via A2A Server (sub-second latency) 
    and 'Cold Mode' via direct subprocess (fallback).
    """
    
    DEFAULT_MODEL = "gemini-2.5-flash"

    def __init__(self, host: str = "http://localhost:22436", system_prompt: str = "", model: str | None = None):
        super().__init__(system_prompt=system_prompt)
        self.host = host.rstrip("/")
        self.active_model = model or self.DEFAULT_MODEL
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

    async def list_models(self) -> list[str]:
        return [self.DEFAULT_MODEL, "gemini-pro"]

    async def _get_or_create_task(self, session: aiohttp.ClientSession, session_id: str, existing_task_id: str | None = None, model: str | None = None) -> str:
        """Fetch existing taskId (from cache or DB) or create a new one."""
        # 1. Use existing taskId if provided from DB or cache
        task_id = existing_task_id or self._task_cache.get(session_id)
        
        # 2. Verify if task is still alive on A2A server
        if task_id:
             try:
                 async with session.get(f"{self.host}/tasks/{task_id}") as resp:
                     if resp.status not in (200, 204):
                         task_id = None # Expired on server
             except Exception:
                 task_id = None

        if not task_id:
            # 3. Create new task if needed
            target_model = model or self.active_model
            payload = {
                "model": target_model,
                "agentSettings": {
                    "autoExecute": True,
                    "model": target_model # Some versions use it here
                }
            }
            async with session.post(f"{self.host}/tasks", json=payload) as resp:
                if resp.status not in (200, 201):
                    err_text = await resp.text()
                    raise RuntimeError(f"Failed to create A2A task ({resp.status}): {err_text}")
                task_id = await resp.json()
                self._task_cache[session_id] = task_id
        else:
             self._task_cache[session_id] = task_id
        
        return task_id

    async def chat(self, messages: list[AIChatMessage], model: str | None = None, session_id: str | None = None, provider_session_id: str | None = None) -> AIChatMessage:
        """Execute chat using A2A Hot Mode if available, falling back to Cold Mode."""
        if not session_id:
            return await self._chat_cold(messages, model)

        try:
            return await self._chat_hot(session_id, messages, provider_session_id, model)
        except Exception as e:
            # Fallback to cold mode on server failure
            sys.stderr.write(f"A2A Hot Mode Error: {e}. Falling back to Cold Mode.\n")
            return await self._chat_cold(messages, model)

    async def _chat_hot(self, session_id: str, messages: list[AIChatMessage], existing_task_id: str | None = None, model: str | None = None) -> AIChatMessage:
        """Core Hot Mode logic via A2A Server using exact parity with chat_session.js."""
        async with aiohttp.ClientSession(timeout=self.timeout) as session:
            # 1. Task Management
            task_id = await self._get_or_create_task(session, session_id, existing_task_id, model)
            is_new_task = (task_id != existing_task_id) if existing_task_id else False

            # 2. Context Restoration (Parity with Auto-Heal)
            prompt = self._prepare_hot_prompt(messages, is_new_task)

            # 3. Payload Parity (Match chat.js exactly)
            message_id = os.urandom(8).hex()
            payload = {
                "jsonrpc": "2.0",
                "id": message_id,
                "method": "message/stream",
                "params": {
                    "message": {
                        "taskId": task_id,
                        "messageId": message_id,
                        "parts": [{"kind": "text", "text": prompt}]
                    }
                }
            }
            
            # 4. Stream Handling
            async with session.post(f"{self.host}/", json=payload) as resp:
                if resp.status != 200:
                    err_text = await resp.text()
                    raise RuntimeError(f"A2A Message Error ({resp.status}): {err_text}")
                
                content = await self._parse_sse_stream(resp.content)
            
            # Update cache and return
            self._task_cache[session_id] = task_id
            return AIChatMessage(role="assistant", content=content, provider_session_id=task_id)

    def _prepare_hot_prompt(self, messages: list[AIChatMessage], is_new_task: bool) -> str:
        """Helper to prepare the prompt, injecting history if auto-healing is needed."""
        prompt = messages[-1].content
        if is_new_task and len(messages) > 1:
            hist_lines = []
            for m in messages[:-1]:
                role = "YOU" if m.role == "user" else "AI"
                hist_lines.append(f"[{role}]: {m.content}")
            
            prompt = (
                "=== CONTEXT RESTORATION (AUTO-HEAL) ===\n"
                "The following is the history of our previous conversation which was lost from the server state. "
                "Please use this as context for our current chat:\n\n"
                + "\n---\n".join(hist_lines) +
                f"\n\n=== END OF RESTORATION ===\n\nUser Message: {prompt}"
            )
        return prompt

    async def _parse_sse_stream(self, reader: aiohttp.StreamReader) -> str:
        """Robustly parse Server Sent Events (SSE) stream from A2A server."""
        full_response = []
        buffer = ""
        
        while True:
            chunk = await reader.read(4096)
            if not chunk:
                break
            
            buffer += chunk.decode(errors="replace")
            
            while "\n\n" in buffer:
                block, buffer = buffer.split("\n\n", 1)
                block = block.strip()
                
                if block.startswith("data: "):
                    data_str = block[6:].strip()
                    text = self._parse_json_chunk(data_str)
                    if text:
                        full_response.append(text)
        
        content = "".join(full_response)
        if not content:
            raise RuntimeError("No text returned from A2A server")
        return content

    def _parse_json_chunk(self, json_str: str) -> str | None:
        """Robustly extracts agent text from a single JSON chunk."""
        try:
            data = json.loads(json_str)
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

    def _sync_to_disk(self, session_id: str, messages: list[AIChatMessage]):
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

    async def _chat_cold(self, messages: list[AIChatMessage], model: str | None = None) -> AIChatMessage:
        """Original Cold Mode logic as a fallback."""
        target_model = model or self.active_model
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

    async def analyze_logs(self, template: str, samples: list[str]) -> dict:
        """Diagnostic analysis remains cold for now as it's typically a one-off."""
        prompt = (
            "You are a Log Analysis Specialist. Return JSON with summary, root_cause, actions.\n\n"
            f"Cluster template: {template}\nSample logs:\n" + "\n".join(samples)
        )
        
        try:
             process = await asyncio.create_subprocess_exec(
                "gemini", "-p", prompt, 
                "-m", self.active_model,
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
