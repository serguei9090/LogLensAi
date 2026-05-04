"""
Codanna proxy: get_calls
Why: Wraps the symbol_id/name duality so the AI never has to remember
     which argument form is required.
Usage:
    uv run python scripts/codanna/calls.py <SymbolName>
    uv run python scripts/codanna/calls.py --id 1883
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
        "codanna", "mcp", "get_calls",
        "--args", json.dumps(args_dict),
        "--json",
    ]
    result = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8")

    if result.returncode != 0:
        print(f"[codanna:calls] ERROR: {result.stderr.strip()}", file=sys.stderr)
        sys.exit(result.returncode)

    try:
        payload = json.loads(result.stdout)
    except json.JSONDecodeError:
        print(result.stdout)
        return

    data = payload.get("data") or []
    items = data if isinstance(data, list) else [data]
    print(f"\n  Calls from '{args_dict.get('function_name') or args_dict.get('symbol_id')}':")
    for item in items:
        name = item.get("name") or str(item)
        file_ = item.get("file") or ""
        sid = item.get("symbol_id")
        sid_str = f" [symbol_id:{sid}]" if sid else ""
        print(f"    -> {name}{sid_str}  {file_}")

    hint = payload.get("system_message")
    if hint:
        print(f"\n💡 {hint}")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Codanna: get_calls — list what a symbol calls."
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
