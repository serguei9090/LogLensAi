import os
import sys
import argparse

# Ensure the 'src' directory is in the python path
src_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "src")
if src_path not in sys.path:
    sys.path.insert(0, src_path)

from api import run_http, run_stdio  # noqa: E402

VERSION = "0.1.0"

def main():
    parser = argparse.ArgumentParser(description="LogLensAi Python Sidecar - ADK Compliant")
    parser.add_argument("--version", action="version", version=f"LogLensAi Sidecar {VERSION}")
    
    group = parser.add_mutually_exclusive_group()
    group.add_argument("--stdio", action="store_true", help="Run in JSON-RPC stdio mode (default)")
    group.add_argument("--http", action="store_true", help="Run in HTTP mode")
    group.add_argument("--dev", action="store_true", help="Alias for --http (legacy support)")
    
    parser.add_argument("--port", type=int, default=5000, help="Port for HTTP mode (default: 5000)")
    parser.add_argument("--db", type=str, default="loglens.duckdb", help="Path to DuckDB file")

    args = parser.parse_args()

    if args.http or args.dev:
        run_http(port=args.port)
    else:
        run_stdio()

if __name__ == "__main__":
    main()
