---
name: codanna
description: High-performance code intelligence via Codanna. Use for symbol analysis, impact assessment, and documentation search. Always prefer the proxy scripts in scripts/codanna/ over raw CLI commands.
---

# Codanna Skill: Physical Code Intelligence

Provides reliable, standardized access to Codanna's codebase analysis engine.
All tools are accessed via proxy scripts in `scripts/codanna/` — **never call raw `codanna mcp` commands directly** as JSON formatting errors break the autonomous loop.

## 🛠️ Script Suite (Use These)

| Task | Script | Key Args |
| :--- | :--- | :--- |
| Full dependency graph | `scripts/codanna/impact.py` | `<SymbolName>` or `--id <id>` `--depth N` |
| Semantic code search | `scripts/codanna/search.py` | `"query"` `--context` `--lang` `--threshold` |
| What does X call? | `scripts/codanna/calls.py` | `<SymbolName>` or `--id <id>` |
| What calls X? | `scripts/codanna/callers.py` | `<SymbolName>` or `--id <id>` |
| Search docs / RAG | `scripts/codanna/docs_search.py` | `"query"` `--collection` `--limit` |
| Index code + docs | `scripts/codanna/index.py` | (no args = full re-index) |

## 📋 Raw MCP Tool Reference (Reference Only)

> **Do not call these directly.** Use the scripts above.

| MCP Tool | Description |
| :--- | :--- |
| `analyze_impact` | Full dependency graph and usage analysis |
| `find_symbol` | Find exact symbol definition and metadata |
| `semantic_search_docs` | Semantic search over code symbols |
| `semantic_search_with_context` | Semantic search + call graph + types |
| `search_documents` | Semantic search over markdown/text collections |
| `get_calls` | List functions called by a symbol |
| `find_callers` | List functions that call a symbol |
| `get_index_info` | Stats on current index state |

## 🚀 Recommended Workflow Sequence

When analyzing a codebase change (follow Codanna's own guidance hints to chain tools):

```powershell
# 1. Find the symbol semantically
uv run python scripts/codanna/search.py "concept you're changing" --limit 3

# 2. Get its full call graph
uv run python scripts/codanna/calls.py SymbolName

# 3. Find who calls it
uv run python scripts/codanna/callers.py SymbolName

# 4. Map the full blast radius
uv run python scripts/codanna/impact.py SymbolName

# 5. Search docs for architectural rationale
uv run python scripts/codanna/docs_search.py "why this pattern exists"
```

## ⚙️ Indexing

Indexing is handled automatically by lefthook on commit.
For manual re-indexing:

```powershell
# Smart dispatch (detects code vs docs)
uv run python scripts/codanna/index.py

# Force full code re-index
codanna index . --force

# Re-index docs only
codanna documents index
```

## 🎯 Agentic Guidance (System Messages)

Codanna returns a `system_message` with every result suggesting the next logical tool call. The proxy scripts surface these as `💡` hints. **Always follow them** to chain queries effectively.

## ⚠️ Guardrails
- **Scripts only**: Never construct `--args '{...}'` JSON manually.
- **Index after refactors**: Run `scripts/codanna/index.py` after any structural code change.
- **symbol_id is sticky**: Use `[symbol_id:X]` from search results to chain to callers/calls/impact without re-searching.
- **Similarity threshold**: Scores < 0.3 are likely irrelevant. Use `--threshold 0.5` for cleaner results.
