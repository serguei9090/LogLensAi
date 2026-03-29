import asyncio
import json
import os
import subprocess
from typing import Any, List, Optional
from .base import AIProvider, AIChatMessage

class GeminiCLIProvider(AIProvider):
    """Fallback provider using the 'gemini' CLI tool."""

    async def list_models(self) -> List[str]:
        return ["gemini-pro-cli"]

    async def chat(self, messages: List[AIChatMessage], model: Optional[str] = None) -> AIChatMessage:
        """Note: Gemini CLI is stateless, so we must feed all previous messages as context."""
        
        # Simple concat context for legacy CLI
        prompt_parts = []
        for msg in messages:
            prefix = "User" if msg.role == "user" else "Assistant"
            prompt_parts.append(f"{prefix}: {msg.content}")
        
        prompt = "\n\n".join(prompt_parts) + "\n\nAssistant: "
        
        try:
            # Use asyncio for non-blocking execution
            process = await asyncio.create_subprocess_exec(
                "gemini", "-p", prompt, "--json",
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            stdout, stderr = await process.communicate()
            
            if process.returncode != 0:
                return AIChatMessage(role="assistant", content=f"CLI Error: {stderr.decode()}")

            # Fallback if no valid JSON
            try:
                 parsed = json.loads(stdout.decode())
                 content = parsed.get("content", stdout.decode())
            except:
                 content = stdout.decode()
                 
            return AIChatMessage(role="assistant", content=content)
            
        except Exception as e:
            return AIChatMessage(role="assistant", content=f"Internal CLI Error: {str(e)}")

    async def analyze_logs(self, template: str, samples: List[str]) -> dict:
        prompt = (
            "You are a Log Analysis Specialist. Return JSON with summary, root_cause, actions.\n\n"
            f"Cluster template: {template}\nSample logs:\n" + "\n".join(samples)
        )
        
        try:
             # Synchronous wait since this is one-off, but keep same interface
             result = subprocess.run(
                ["gemini", "-p", prompt, "--json"], 
                capture_output=True, text=True, timeout=30
             )
             if result.returncode != 0: raise RuntimeError(result.stderr)
             return json.loads(result.stdout)
        except Exception as e:
             return {"summary": "Analysis failed", "root_cause": str(e), "recommended_actions": []}
