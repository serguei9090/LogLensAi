"""
Codanna proxy: smart index dispatcher
Why: Lefthook and AI agents call this with a list of staged files.
     It routes to the correct codanna index command:
       - Any .md / .txt → codanna documents index
       - Any code file  → codanna index .
     Running both when only docs changed wastes time; this prevents that.

Usage (lefthook / CI):
    uv run python scripts/codanna/index.py [file1 file2 ...]

Usage (full re-index, no args):
    uv run python scripts/codanna/index.py
"""
import subprocess
import sys
from pathlib import Path

# Extensions treated as documentation (not code)
DOC_EXTENSIONS = {".md", ".mdx", ".txt", ".rst", ".adoc"}


def _run(cmd: list[str], label: str) -> int:
    print(f"  [{label}] running: {' '.join(cmd)}")
    result = subprocess.run(cmd)
    return result.returncode


def main() -> None:
    staged: list[str] = sys.argv[1:]

    if "--latest" in staged:
        try:
            cmd = ["git", "diff-tree", "--no-commit-id", "--name-only", "-r", "HEAD"]
            result = subprocess.check_output(cmd, encoding="utf-8")
            staged = [f.strip() for f in result.splitlines() if f.strip()]
            if not staged:
                print("  [!] No files found in the latest commit.")
                sys.exit(0)
        except Exception as e:
            print(f"  [✗] Failed to get files from git: {e}")
            sys.exit(1)

    if not staged:
        # No args → full re-index of both code and docs
        print("\n[codanna:index] Full re-index (no staged files provided)")
        rc1 = _run(["codanna", "index", "."], "code-index")
        rc2 = _run(["codanna", "documents", "index"], "docs-index")
        sys.exit(max(rc1, rc2))

    # Classify staged files
    paths = [Path(f) for f in staged]
    has_docs = any(p.suffix.lower() in DOC_EXTENSIONS for p in paths)
    has_code = any(p.suffix.lower() not in DOC_EXTENSIONS for p in paths)

    exit_code = 0

    if has_code:
        rc = _run(["codanna", "index", "."], "code-index")
        exit_code = max(exit_code, rc)

    if has_docs:
        rc = _run(["codanna", "documents", "index"], "docs-index")
        exit_code = max(exit_code, rc)

    sys.exit(exit_code)


if __name__ == "__main__":
    main()
