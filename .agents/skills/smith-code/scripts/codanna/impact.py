"""
Codanna proxy: analyze_impact
Why: Standardizes the JSON argument formation that the AI often gets wrong,
     and surfaces Codanna's built-in system_message guidance hint cleanly.
Usage:
    uv run python scripts/codanna/impact.py <SymbolName>
    uv run python scripts/codanna/impact.py <SymbolName> --depth 5
    uv run python scripts/codanna/impact.py --id 1234
"""
import argparse
import json
import subprocess
import sys


if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")


def _run(args_dict: dict) -> None:
    """Build and execute the codanna mcp analyze_impact command."""
    cmd = [
        "codanna", "mcp", "analyze_impact",
        "--args", json.dumps(args_dict),
        "--json",
    ]
    result = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8")

    if result.returncode != 0:
        print(f"[codanna:impact] ERROR: {result.stderr.strip()}", file=sys.stderr)
        sys.exit(result.returncode)

    try:
        payload = json.loads(result.stdout)
    except json.JSONDecodeError:
        # Codanna returned plain text — print as-is
        print(result.stdout)
        return

    # Print data section
    data = payload.get("data") or payload
    if isinstance(data, dict):
        for kind, symbols in data.items():
            if symbols:
                print(f"\n  [{kind}]")
                for sym in symbols if isinstance(symbols, list) else [symbols]:
                    print(f"    - {sym}")
    else:
        print(result.stdout)

    # Always surface the guidance hint if present
    hint = payload.get("system_message")
    if hint:
        print(f"\n💡 {hint}")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Codanna: analyze_impact — map the full dependency graph of a symbol."
    )
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("name", nargs="?", help="Symbol name (function, class, method)")
    group.add_argument("--id", type=int, dest="symbol_id", help="Symbol ID (from a previous search)")
    parser.add_argument("--depth", type=int, default=None, help="Max traversal depth (default: codanna default)")
    parser.add_argument("--lang", help="Filter by language e.g. python, typescript")

    args = parser.parse_args()

    payload: dict = {}
    if args.symbol_id:
        payload["symbol_id"] = args.symbol_id
    else:
        payload["symbol_name"] = args.name
    if args.depth is not None:
        payload["max_depth"] = args.depth
    if args.lang:
        payload["lang"] = args.lang

    _run(payload)


if __name__ == "__main__":
    main()
