"""
Codanna proxy: search_documents (doc collection / RAG)
Why: Keeps document search clearly separate from code search in the AI's
     mental model. Points exclusively at the MCP search_documents tool.
Usage:
    uv run python scripts/codanna/docs_search.py "setup guide"
    uv run python scripts/codanna/docs_search.py "configuration" --collection docs --limit 5
"""
import argparse
import json
import subprocess
import sys


if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")


def _run(args_dict: dict) -> None:
    cmd = [
        "codanna", "mcp", "search_documents",
        "--args", json.dumps(args_dict),
        "--json",
    ]
    result = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8")

    if result.returncode != 0:
        print(f"[codanna:docs_search] ERROR: {result.stderr.strip()}", file=sys.stderr)
        sys.exit(result.returncode)

    try:
        payload = json.loads(result.stdout)
    except json.JSONDecodeError:
        print(result.stdout)
        return

    data = payload.get("data") or []
    items = data if isinstance(data, list) else [data]
    for i, item in enumerate(items, 1):
        title = item.get("title") or item.get("name") or f"Result {i}"
        file_ = item.get("file") or item.get("path") or ""
        preview = item.get("content_preview") or item.get("content") or ""
        score = item.get("similarity") or item.get("score") or ""
        score_str = f" (score: {score:.3f})" if isinstance(score, float) else ""
        print(f"\n  {i}. {title}{score_str}")
        if file_:
            print(f"     File: {file_}")
        if preview:
            print(f"     {preview[:200].replace(chr(10), ' ')}")

    hint = payload.get("system_message")
    if hint:
        print(f"\n💡 {hint}")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Codanna: search_documents — semantic search over indexed doc collections."
    )
    parser.add_argument("query", help="Natural language query")
    parser.add_argument("--limit", type=int, default=5, help="Max results (default: 5)")
    parser.add_argument("--collection", help="Target a specific collection name")

    args = parser.parse_args()
    payload: dict = {"query": args.query, "limit": args.limit}
    if args.collection:
        payload["collection"] = args.collection

    _run(payload)


if __name__ == "__main__":
    main()
