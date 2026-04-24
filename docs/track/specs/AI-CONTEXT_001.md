# Task Spec: AI-CONTEXT-001
**Title:** Smart Context Manager
**Status:** Implemented (2026-04-20)

## The Contract (What)
Optimize the LLM context window by filtering mundane logs and summarizing repeated patterns before sending context to the AI provider.

## Implementation Strategy
1. **Context Manager**: Created `sidecar/src/ai/context_manager.py`.
2. **Filtering**: Implemented `prepare_log_context` to identify repeated `cluster_id` blocks.
3. **Integration**: Wired into `method_chat_session` in `sidecar/src/api.py`.

## Verification
- [x] Unit tests in `sidecar/tests/test_context_manager.py`.
