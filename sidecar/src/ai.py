import json
import subprocess

from pydantic import BaseModel, ValidationError


class DiagnosticResult(BaseModel):
    summary: str
    root_cause: str
    recommended_actions: list[str]


class AIProvider:
    def __init__(self, provider="gemini-cli", api_key="", system_prompt=""):
        self.provider = provider
        self.api_key = api_key
        self.system_prompt = (
            system_prompt
            or "You are a Log Analysis Specialist. Return JSON with summary, root_cause, actions."
        )

    def analyze(self, cluster_template: str, samples: list[str]) -> dict:
        if self.provider != "gemini-cli":
            return {
                "summary": "Analysis failed",
                "root_cause": f"Unsupported provider: {self.provider}",
                "recommended_actions": [],
            }

        prompt = (
            f"{self.system_prompt}\n\nCluster template: {cluster_template}\nSample logs:\n"
            + "\n".join(samples)
        )

        try:
            result = subprocess.run(
                ["gemini", "-p", prompt, "--json"], capture_output=True, text=True, timeout=30
            )

            if result.returncode != 0:
                raise RuntimeError(result.stderr)

            parsed = json.loads(result.stdout)
            validated = DiagnosticResult(**parsed)
            return validated.model_dump()

        except subprocess.TimeoutExpired:
            return {
                "summary": "Analysis failed",
                "root_cause": "Timeout",
                "recommended_actions": [],
            }
        except (json.JSONDecodeError, ValidationError) as e:
            return {"summary": "Analysis failed", "root_cause": str(e), "recommended_actions": []}
        except Exception as e:
            return {"summary": "Analysis failed", "root_cause": str(e), "recommended_actions": []}
