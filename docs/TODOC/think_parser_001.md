# TODO(think_parser_001): Unified Thinking/Reasoning Stream Parser

## Status: PLANNED

## Problem Statement
Thinking/reasoning parsing logic is currently **duplicated and provider-coupled**:

| Location | Duplicated Logic |
|---|---|
| `ollama.py` | Full stateful channel-marker parser (400+ lines) |
| `reasoning.py` | Minimal marker normalization only — no stream state machine |
| `ai_studio.py` | **Zero** thinking handling — raw text passthrough |
| `api.py` | Calls `parse_reasoning_blocks()` on every chunk (normalization only) |

## Architecture

### Files to Change
1. CREATE `sidecar/src/ai/thinking_parser.py` — single source of truth
2. REFACTOR `ollama.py` — delegate to shared parser
3. REFACTOR `ai_studio.py` — add thinking support via shared parser
4. REFACTOR `reasoning.py` — re-export shim for backward compat
5. UPDATE `ai/__init__.py` — export new symbols
