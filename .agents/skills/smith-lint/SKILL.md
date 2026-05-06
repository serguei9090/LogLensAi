---
name: smit-lint
description: Project lint detection and execution skill. Use when asked to lint, format, auto-fix lint issues, detect lint tools, clean code quality issues, or run checks for Python, JavaScript/TypeScript/React, Flutter/Dart, or Rust projects using project-local tools first and global tools only as fallback.
---

# Smit Lint

Smit Lint detects the project type and lint tooling, then runs the best available lint/check/fix command.

## Required Workflow

1. Read `references/LintStrategy.md`.
2. Run detection from the repository root:
   - Check only: `python .agents/skills/smit-lint/scripts/lint_runner.py --check`
   - Auto-fix: `python .agents/skills/smit-lint/scripts/lint_runner.py --fix`
   - Plan only: `python .agents/skills/smit-lint/scripts/lint_runner.py --plan`
3. Prefer project-local scripts and lockfile tools over global tools.
4. Review output and fix remaining issues manually when auto-fix cannot resolve them.
5. Re-run check mode after fix mode.

## Supported Project Types

| Project | Detection | Preferred tools |
| --- | --- | --- |
| Python | `pyproject.toml`, `requirements.txt`, `*.py` | project scripts, `uv run ruff`, `ruff`, `python -m compileall` |
| JS/TS/React | `package.json`, `*.tsx`, `vite`, `next`, `react` | package lint scripts, `biome`, `eslint`, `tsc` |
| Flutter/Dart | `pubspec.yaml`, `lib/*.dart` | `flutter analyze`, `dart analyze`, `dart format` |
| Rust | `Cargo.toml`, `*.rs` | `cargo fmt`, `cargo clippy`, `cargo check` |

## Fix Policy

- Safe auto-fix commands are allowed: `ruff --fix`, `biome check --write`, `eslint --fix`, `dart format`, `cargo fmt`.
- Do not run dependency upgrades as part of linting.
- Do not run destructive cleanup commands.
- Do not silently ignore lint failures. Report remaining errors with the command that produced them.

## Output Expectations

Report:

- detected project types,
- selected commands,
- commands that were skipped and why,
- whether auto-fix changed files,
- remaining failures and next manual fixes.

