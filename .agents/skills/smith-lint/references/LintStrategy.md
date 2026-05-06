# Lint Strategy

## Priority Order

1. Use project-defined commands:
   - `package.json` scripts such as `lint`, `check`, `format`, `typecheck`.
   - task runners documented in `README.md`, `justfile`, `Makefile`, or `lefthook.yaml`.
2. Use project-local package runners:
   - JS/TS: `bunx`, `npx`, `pnpm exec`, `yarn`.
   - Python: `uv run`, `python -m`.
3. Use global tools only when no local path exists.
4. Use syntax checks as fallback when no linter exists.

## Fix Then Check

When the user asks to fix:

1. Run fix-capable tools.
2. Run check-only tools.
3. Manually resolve remaining issues only after reading the affected files.
4. Re-run checks.

## Tool Notes

- `ruff format` is formatting; `ruff check --fix` fixes lint.
- `biome check --write` can format and fix safe lint issues.
- `eslint --fix` may leave semantic issues that require manual edits.
- `cargo fmt` formats; `cargo clippy` and `cargo check` verify.
- `dart format` formats; `flutter analyze` or `dart analyze` verifies.

## Guardrails

- Prefer commands that exist in the repository.
- Do not install missing tools unless the user asks.
- Do not change lockfiles unless lint tooling itself requires normal package-manager execution.
- Keep output concise but preserve failing command names and exit codes.

