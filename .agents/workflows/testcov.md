---
description: Test Coverage Expansion Workflow (Sequential Gap Closing)
---

# 🧬 Test Coverage Expansion (testcov)

This workflow targets "Coverage Gaps" identified in `docs/architecture/testing.md`. It implements tests sequentially, ensuring each unit is verified before moving to the next.

// turbo-all
1. **Gap Analysis**:
   - Read `docs/architecture/testing.md`.
   - Identify the first entry with a `❌` or `Coverage Gap` status.
   - Priority: 1. `Critical Gap` | 2. `Frontend Organisms` | 3. `Backend Logic`.

2. **Task Focus**:
   - Pick exactly **ONE** target component or logic block.
   - Analyze its implementation (interfaces, props, state).

3. **Implementation Phase**:
   - Create/Update the corresponding test file:
     - **Frontend**: `src/components/**/__tests__/<Component>.test.tsx` (using Vitest)
     - **Backend**: `sidecar/tests/test_<module>.py` (using Pytest)
   - Follow "ADK Testing Standards" (No mocks for internal logic, only external deps).

4. **Verification**:
   - Run the test suite:
     - Frontend: `bun run test`
     - Backend: `uv run pytest <test_filepath>`
   - Ensure the test is fast and isolated.

5. **Closing the Gap**:
   - If tests pass, update `docs/architecture/testing.md`:
     - Change `❌` to `✅`.
     - Update status to `Ready`.
   - Document any "Lessons Learned" if the test revealed a bug.

6. **Sequential Transition**:
   - Return to Step 1 and pick the next gap.
   - DO NOT start multiple gaps simultaneously.
