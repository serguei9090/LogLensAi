# FIX-CORE-001: Restore AIChatMessage Export

The Python sidecar failed to start due to a missing `AIChatMessage` export in `sidecar/src/ai/__init__.py`. This regression was introduced during an automated linting cleanup.

## Root Cause
Ruff identified `from .base import AIChatMessage` as an unused import in `__init__.py` because it was not used within the file itself. However, it was intended as a public export for the `src.ai` package, used by `src.api`.

## Resolution
1. **Restore the import**: Re-add `from .base import AIChatMessage`.
2. **Explicit Exports**: Implement the `__all__` dunder variable to explicitly mark `AIChatMessage` and `AIProviderFactory` as the public interface, preventing linters from flagging them as unused in the future.

## Verification Plan
1. **Manual Run**: Execute `bun run dev:api` to ensure the sidecar starts without `ImportError`.
2. **Lint Check**: Run `ruff` to ensure the new `__all__` pattern is respected.
