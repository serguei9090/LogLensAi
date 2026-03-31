import asyncio
import json
import os
import subprocess
from typing import Any, List, Optional
from .base import AIProvider, AIChatMessage

class GeminiCLIProvider(AIProvider):
    """Fallback provider using the 'gemini' CLI tool."""
    
    DEFAULT_MODEL = "gemini-2.5-flash"

    def _extract_json(self, output: str) -> dict:
        """Helper to find and parse the FIRST valid JSON object in a string."""
        start = output.find("{")
        end = output.rfind("}")
        if start == -1 or end == -1 or end < start:
            raise ValueError("No valid JSON object found in output")
        return json.loads(output[start:end+1])

    async def list_models(self) -> List[str]:
        return [self.DEFAULT_MODEL, "gemini-2.0-flash", "gemini-pro"]

    async def chat(self, messages: List[AIChatMessage], model: Optional[str] = None) -> AIChatMessage:
        """Feeding all previous messages as context to the CLI."""
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
            return AIChatMessage(role="assistant", content=f"Internal Provider Error: {str(e)}")

    async def analyze_logs(self, template: str, samples: List[str]) -> dict:
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
                  # Extraction failed or inner JSON is invalid
                  return {"summary": output_str, "root_cause": "Parsing failed", "recommended_actions": []}
                  
        except Exception as e:
             return {"summary": "Analysis failed", "root_cause": str(e), "recommended_actions": []}
