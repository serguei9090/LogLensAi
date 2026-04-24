# Task: Fix Missing 'os' Import in Ollama Provider (FIX-BE-001)

## 📌 Problem
A `NameError: name 'os' is not defined` occurs in `ollama.py` during `chat_stream` when the code attempts to access `os.getenv("LOGLENS_AI_DEBUG")`. This was a regression introduced during the environment configuration stabilization.

## 🛠️ Implementation Logic
- Add `import os` to the top of `sidecar/src/ai/ollama.py`.

## 🧪 Testing
1. Trigger an AI chat session.
2. Verify in `sidecar.log` that `chat_stream` completes without errors.
