---
name: codanna
description: High-performance code intelligence via Codanna. Use for symbol analysis, impact assessment, caller graphs, and blast radius. Run via direct CLI commands (codanna retrieve) or direct MCP tools (codanna mcp).
---

# Codanna Skill: Physical Code Intelligence

Codanna is an ultra-fast Rust-based code intelligence engine indexing the AST, symbols, and relationships of LogLensAi into `.codanna/index`.

Use **`codanna retrieve`** or **`codanna mcp`** directly without manual file reading.

## 🛠️ Direct CLI & MCP Commands

| Task | CLI Command (`codanna retrieve`) | Direct MCP Mode (`codanna mcp`) |
| :--- | :--- | :--- |
| **Who calls X? (Callers)** | `codanna retrieve callers <Symbol>` | `codanna mcp find_callers <Symbol>` |
| **What does X call? (Callees)** | `codanna retrieve calls <Symbol>` | `codanna mcp get_calls <Symbol>` |
| **Blast Radius / Impact** | — | `codanna mcp analyze_impact <Symbol>` |
| **Find Symbol Definition** | `codanna retrieve symbol <Symbol>` | `codanna mcp find_symbol <Symbol>` |
| **Search Symbols** | `codanna retrieve search "<query>" --limit 5` | `codanna mcp search_symbols query:<text>` |
| **Semantic Code Search** | — | `codanna mcp semantic_search_with_context query:"<query>"` |
| **Trait / Interface Impls**| `codanna retrieve implementations <Interface>` | — |
| **Re-index Codebase** | `codanna index .` | `codanna index .` |

## 🚀 Recommended Workflow Sequence

Before editing or refactoring shared code:

```powershell
# 1. Inspect exact symbol location and signature
codanna retrieve symbol SymbolName

# 2. Check full blast radius and callers across the project
codanna mcp analyze_impact SymbolName

# 3. Check what this symbol depends on
codanna retrieve calls SymbolName
```

## ⚙️ Indexing & Maintenance

- Index storage: `.codanna/index` (SQLite + Tantivy).
- Re-index when methods or files are added/moved:
  ```powershell
  codanna index .
  ```

