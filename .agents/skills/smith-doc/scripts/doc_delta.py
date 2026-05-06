from __future__ import annotations

import argparse
import re
import subprocess
from pathlib import Path


ROOT = Path(__file__).resolve().parents[4]
MARKER = ROOT / "docs" / "track" / "documentation-sync.md"
MARKER_RE = re.compile(r"^Last documented commit:\s*([0-9a-fA-F]+)\s*$", re.MULTILINE)


def run_git(args: list[str], *, allow_failure: bool = False) -> str | None:
    completed = subprocess.run(
        ["git", *args],
        cwd=ROOT,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        check=False,
    )
    if completed.returncode != 0:
        if allow_failure:
            return None
        raise SystemExit(completed.stderr.strip() or f"git {' '.join(args)} failed")
    return completed.stdout.strip()


def marker_commit() -> str | None:
    if not MARKER.exists():
        return None
    match = MARKER_RE.search(MARKER.read_text(encoding="utf-8"))
    return match.group(1) if match else None


def first_commit() -> str | None:
    output = run_git(["rev-list", "--max-parents=0", "HEAD"], allow_failure=True)
    if not output:
        return None
    commits = [line.strip() for line in output.splitlines() if line.strip()]
    return commits[-1] if commits else None


def main() -> int:
    parser = argparse.ArgumentParser(description="Show commits and changed files since the documentation sync marker.")
    parser.add_argument("--base", help="Base commit. Defaults to docs/track/documentation-sync.md marker.")
    parser.add_argument("--summary", action="store_true", help="Print commit range, commits, changed files, and working tree state.")
    args = parser.parse_args()

    head = run_git(["rev-parse", "HEAD"], allow_failure=True)
    status = run_git(["status", "--short"], allow_failure=True) or "(not a git repository)"

    if not head:
        print("base: (none)")
        print("head:  (none)")
        print("range: (no commits yet)")
        print("\ncommits:")
        print("(none)")
        print("\nchanged files:")
        print("(none)")
        print("\nworking tree:")
        print(status or "(clean)")
        return 0

    base = args.base
    if not base:
        marker = marker_commit()
        if marker:
            base = marker
        else:
            # No marker, force full scan from initial commit
            base = first_commit()
            print("No documentation sync marker found. Starting full repository scan.")
    if not base:
        raise SystemExit("Could not determine a base commit.")

    commit_range = f"{base}..HEAD"
    print(f"base: {base}")
    print(f"head:  {head}")
    print(f"range: {commit_range}")

    print("\ncommits:")
    commits = run_git(["log", "--oneline", commit_range])
    print(commits or "(none)")

    print("\nchanged files:")
    changed = run_git(["diff", "--name-status", commit_range])
    print(changed or "(none)")

    print("\nworking tree:")
    print(status or "(clean)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
