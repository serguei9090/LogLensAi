"""
Codanna proxy: semantic_search_docs / semantic_search_with_context
Why: Single entry point for both search modes; avoids the AI having to pick
     between two subtly different MCP tool names.
Usage:
    uv run python scripts/codanna/search.py "user authentication"
    uv run python scripts/codanna/search.py "error handling" --context --limit 3
    uv run python scripts/codanna/search.py "config parsing" --lang rust --threshold 0.5
"""
import argparse
import json
import subprocess
import sys


if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")


def _run(tool: str, args_dict: dict) -> None:
    """Execute a codanna mcp search command and print clean output."""
    cmd = [
        "codanna", "mcp", tool,
        "--args", json.dumps(args_dict),
        "--json",
    ]
    result = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8")

    if result.returncode != 0:
        print(f"[codanna:search] ERROR: {result.stderr.strip()}", file=sys.stderr)
        sys.exit(result.returncode)

    try:
        payload = json.loads(result.stdout)
    except json.JSONDecodeError:
        print(result.stdout)
        return

    data = payload.get("data") or payload
    items = data if isinstance(data, list) else [data]
    for i, item in enumerate(items, 1):
        name = item.get("name") or item.get("symbol") or ""
        kind = item.get("kind") or item.get("type") or ""
        score = item.get("similarity") or item.get("score") or ""
        file_ = item.get("file") or item.get("location") or ""
        doc = item.get("doc") or item.get("documentation") or ""
        sid = item.get("symbol_id")
        sid_str = f" [symbol_id:{sid}]" if sid else ""
        score_str = f" - Similarity: {score:.3f}" if isinstance(score, float) else ""
        print(f"\n  {i}. {name} ({kind}){score_str}{sid_str}")
        if file_:
            print(f"     File: {file_}")
        if doc:
            # Trim long docs
            doc_short = doc[:160].replace("\n", " ")
            print(f"     Doc: {doc_short}")

    hint = payload.get("system_message")
    if hint:
        print(f"\n💡 {hint}")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Codanna: semantic_search — find code/docs by meaning."
    )
    parser.add_argument("query", help="Natural language search query")
    parser.add_argument("--limit", type=int, default=5, help="Max results (default: 5)")
    parser.add_argument("--threshold", type=float, default=None, help="Min similarity score (0-1)")
    parser.add_argument("--lang", help="Filter by language e.g. python, typescript, rust")
    parser.add_argument(
        "--context",
        action="store_true",
        help="Use semantic_search_with_context (includes call graph and types)",
    )

    args = parser.parse_args()

    tool = "semantic_search_with_context" if args.context else "semantic_search_docs"
    payload: dict = {"query": args.query, "limit": args.limit}
    if args.threshold is not None:
        payload["threshold"] = args.threshold
    if args.lang:
        payload["lang"] = args.lang

    _run(tool, payload)


if __name__ == "__main__":
    main()
