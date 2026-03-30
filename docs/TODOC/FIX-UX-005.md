# FIX-UX-005: Sidecar LLM Provider Stability

## 📝 Issue Description
The `GeminiCLIProvider` uses `subprocess.run`, which is a blocking/synchronous call, inside an `async` function (`analyze_logs`). Additionally, broad `except:` blocks hide specific errors and violate project standards.

## 🔍 Root Cause Analysis
1. **Sync Subprocess**: `subprocess.run` blocks the event loop, preventing the Sidecar from handling other RPC requests until analysis completes (up to 30s timeout).
2. **Standard Violation**: `except:` catch-all prevents proper stack trace visibility.

## 🛠️ Implementation Plan

### 1. Sidecar (@backend)
- **`sidecar/src/ai/gemini_cli.py`**:
  - Replace `subprocess.run` in `analyze_logs` with `asyncio.create_subprocess_exec`.
  - Refactor `chat` and `analyze_logs` catch blocks to `except Exception as e:`.
  - Ensure correct `stdout/stderr` decoding (utf-8).

## ✅ Verification
- Test `analyze_cluster` RPC method via manual call.
- Verify log analysis completes without blocking concurrent `get_logs` requests.
