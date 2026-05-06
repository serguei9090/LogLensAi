"""
Codanna proxy: find_callers
Why: find_callers is the most-used tool in impact analysis. This wrapper
     prevents the AI from confusing it with find_symbol or get_calls.
Usage:
    uv run python scripts/codanna/callers.py <SymbolName>
    uv run python scripts/codanna/callers.py --id 6405
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
        "codanna", "mcp", "find_callers",
        "--args", json.dumps(args_dict),
        "--json",
    ]
    result = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8")

    if result.returncode != 0:
        print(f"[codanna:callers] ERROR: {result.stderr.strip()}", file=sys.stderr)
        sys.exit(result.returncode)

    try:
        payload = json.loads(result.stdout)
    except json.JSONDecodeError:
        print(result.stdout)
        return

    data = payload.get("data") or []
    items = data if isinstance(data, list) else [data]
    target = args_dict.get("function_name") or args_dict.get("symbol_id")
    print(f"\n  Callers of '{target}':")
    for item in items:
        name = item.get("name") or str(item)
        file_ = item.get("file") or ""
        sid = item.get("symbol_id")
        sid_str = f" [symbol_id:{sid}]" if sid else ""
        print(f"    <- {name}{sid_str}  {file_}")

    hint = payload.get("system_message")
    if hint:
        print(f"\n💡 {hint}")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Codanna: find_callers — list what calls a symbol."
    )
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("name", nargs="?", help="Symbol name")
    group.add_argument("--id", type=int, dest="symbol_id", help="Symbol ID")
    parser.add_argument("--lang", help="Filter by language")

    args = parser.parse_args()
    payload: dict = {}
    if args.symbol_id:
        payload["symbol_id"] = args.symbol_id
    else:
        payload["function_name"] = args.name
    if args.lang:
        payload["lang"] = args.lang

    _run(payload)


if __name__ == "__main__":
    main()
