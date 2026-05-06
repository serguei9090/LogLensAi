from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable


ROOT = Path.cwd()
IGNORED_PARTS = {
    ".git",
    ".agents",
    ".gemini",
    ".venv",
    "__pycache__",
    "build",
    "dist",
    "docs",
    "node_modules",
    "target",
}


@dataclass(frozen=True)
class CommandSpec:
    label: str
    command: list[str]
    fix: bool = False
    check: bool = True
    reason: str = ""


def exists(path: str) -> bool:
    return (ROOT / path).exists()


def any_files(patterns: Iterable[str]) -> bool:
    for pattern in patterns:
        for path in ROOT.glob(pattern):
            if path.is_file() and not (set(path.relative_to(ROOT).parts) & IGNORED_PARTS):
                return True
    return False


def which(command: str) -> bool:
    return shutil.which(command) is not None


def load_package_json() -> dict:
    package = ROOT / "package.json"
    if not package.exists():
        return {}
    try:
        return json.loads(package.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return {}


def package_runner() -> str | None:
    if exists("bun.lockb") or exists("bun.lock"):
        return "bun"
    if exists("pnpm-lock.yaml"):
        return "pnpm"
    if exists("yarn.lock"):
        return "yarn"
    if exists("package-lock.json"):
        return "npm"
    if which("bun"):
        return "bun"
    if which("pnpm"):
        return "pnpm"
    if which("yarn"):
        return "yarn"
    if which("npm"):
        return "npm"
    return None


def script_command(runner: str, script: str) -> list[str]:
    if runner in {"bun", "yarn", "pnpm"}:
        return [runner, "run", script]
    return [runner, "run", script]


def exec_command(runner: str, tool: str, args: list[str]) -> list[str]:
    if runner == "bun":
        return ["bunx", tool, *args]
    if runner == "pnpm":
        return ["pnpm", "exec", tool, *args]
    if runner == "yarn":
        return ["yarn", "exec", tool, *args]
    return ["npx", tool, *args]


def detect_python() -> tuple[list[str], list[CommandSpec]]:
    if not (exists("pyproject.toml") or exists("requirements.txt") or any_files(["**/*.py"])):
        return [], []

    project = ["python"]
    commands: list[CommandSpec] = []
    has_uv = exists("uv.lock") or which("uv")
    ruff_cmd = ["uv", "run", "ruff"] if has_uv else ["ruff"]

    if has_uv or which("ruff"):
        commands.append(CommandSpec("python:ruff-check", [*ruff_cmd, "check", "."], check=True))
        commands.append(CommandSpec("python:ruff-fix", [*ruff_cmd, "check", "--fix", "."], fix=True, check=False))
        commands.append(CommandSpec("python:ruff-format", [*ruff_cmd, "format", "."], fix=True, check=False))
    else:
        commands.append(CommandSpec("python:compileall", [sys.executable, "-m", "compileall", "."], check=True, reason="ruff unavailable"))

    return project, commands


def detect_js() -> tuple[list[str], list[CommandSpec]]:
    package = load_package_json()
    if not package and not any_files(["**/*.ts", "**/*.tsx", "**/*.js", "**/*.jsx"]):
        return [], []

    project = ["javascript/typescript"]
    commands: list[CommandSpec] = []
    runner = package_runner()
    scripts = package.get("scripts", {}) if package else {}

    for script in ("lint", "check", "typecheck", "test:lint"):
        if runner and script in scripts:
            commands.append(CommandSpec(f"js:script:{script}", script_command(runner, script), check=True))

    for script in ("lint:fix", "format", "format:fix"):
        if runner and script in scripts:
            commands.append(CommandSpec(f"js:script:{script}", script_command(runner, script), fix=True, check=False))

    deps = {**package.get("dependencies", {}), **package.get("devDependencies", {})} if package else {}

    if runner and ("@biomejs/biome" in deps or exists("biome.json") or exists("biome.jsonc")):
        commands.append(CommandSpec("js:biome-check", exec_command(runner, "biome", ["check", "."]), check=True))
        commands.append(CommandSpec("js:biome-write", exec_command(runner, "biome", ["check", "--write", "."]), fix=True, check=False))
    elif which("biome"):
        commands.append(CommandSpec("js:biome-check-global", ["biome", "check", "."], check=True))
        commands.append(CommandSpec("js:biome-write-global", ["biome", "check", "--write", "."], fix=True, check=False))

    if runner and ("eslint" in deps or exists(".eslintrc") or exists("eslint.config.js") or exists("eslint.config.mjs")):
        commands.append(CommandSpec("js:eslint", exec_command(runner, "eslint", ["."]), check=True))
        commands.append(CommandSpec("js:eslint-fix", exec_command(runner, "eslint", [".", "--fix"]), fix=True, check=False))
    elif which("eslint"):
        commands.append(CommandSpec("js:eslint-global", ["eslint", "."], check=True))
        commands.append(CommandSpec("js:eslint-fix-global", ["eslint", ".", "--fix"], fix=True, check=False))

    if runner and ("typescript" in deps or exists("tsconfig.json")):
        commands.append(CommandSpec("js:tsc", exec_command(runner, "tsc", ["--noEmit"]), check=True))

    return project, dedupe(commands)


def detect_flutter() -> tuple[list[str], list[CommandSpec]]:
    if not (exists("pubspec.yaml") or any_files(["lib/**/*.dart", "test/**/*.dart"])):
        return [], []

    project = ["flutter/dart"]
    commands: list[CommandSpec] = []
    if which("flutter") and exists("pubspec.yaml"):
        commands.append(CommandSpec("flutter:analyze", ["flutter", "analyze"], check=True))
        commands.append(CommandSpec("flutter:format", ["dart", "format", "."], fix=True, check=False))
    elif which("dart"):
        commands.append(CommandSpec("dart:analyze", ["dart", "analyze"], check=True))
        commands.append(CommandSpec("dart:format", ["dart", "format", "."], fix=True, check=False))
    return project, commands


def detect_rust() -> tuple[list[str], list[CommandSpec]]:
    if not (exists("Cargo.toml") or any_files(["**/*.rs"])):
        return [], []

    project = ["rust"]
    commands: list[CommandSpec] = []
    if which("cargo"):
        commands.append(CommandSpec("rust:fmt-check", ["cargo", "fmt", "--all", "--", "--check"], check=True))
        commands.append(CommandSpec("rust:fmt", ["cargo", "fmt", "--all"], fix=True, check=False))
        commands.append(CommandSpec("rust:clippy", ["cargo", "clippy", "--all-targets", "--all-features", "--", "-D", "warnings"], check=True))
        commands.append(CommandSpec("rust:check", ["cargo", "check", "--all-targets", "--all-features"], check=True))
    return project, commands


def dedupe(commands: list[CommandSpec]) -> list[CommandSpec]:
    seen: set[tuple[str, ...]] = set()
    result: list[CommandSpec] = []
    for command in commands:
        key = tuple(command.command)
        if key in seen:
            continue
        seen.add(key)
        result.append(command)
    return result


def command_available(command: CommandSpec) -> bool:
    return which(command.command[0])


def run(command: CommandSpec) -> int:
    print(f"\n[{command.label}] {' '.join(command.command)}")
    completed = subprocess.run(command.command, cwd=ROOT)
    if completed.returncode != 0:
        print(f"[failed] {command.label} exited {completed.returncode}")
    return completed.returncode


def main() -> int:
    parser = argparse.ArgumentParser(description="Detect project lint tools and run lint checks or safe fixes.")
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--check", action="store_true", help="Run check-only lint commands.")
    mode.add_argument("--fix", action="store_true", help="Run safe auto-fix commands, then check commands.")
    mode.add_argument("--plan", action="store_true", help="Print detected project types and selected commands without running.")
    args = parser.parse_args()

    detectors = [detect_python, detect_js, detect_flutter, detect_rust]
    project_types: list[str] = []
    commands: list[CommandSpec] = []
    for detector in detectors:
        projects, detected = detector()
        project_types.extend(projects)
        commands.extend(detected)

    commands = [command for command in dedupe(commands) if command_available(command)]

    print("project types:", ", ".join(project_types) if project_types else "(none detected)")
    if not commands:
        print("No lint/check commands found.")
        return 1

    fix_commands = [command for command in commands if command.fix]
    check_commands = [command for command in commands if command.check]

    print("\nselected commands:")
    for command in commands:
        kind = "fix" if command.fix else "check"
        suffix = f" ({command.reason})" if command.reason else ""
        print(f"- {kind}: {command.label}: {' '.join(command.command)}{suffix}")

    if args.plan:
        return 0

    exit_code = 0
    if args.fix:
        for command in fix_commands:
            exit_code |= run(command)
        for command in check_commands:
            exit_code |= run(command)
    else:
        for command in check_commands:
            exit_code |= run(command)

    return exit_code


if __name__ == "__main__":
    raise SystemExit(main())
