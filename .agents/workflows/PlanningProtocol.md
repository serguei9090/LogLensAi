# Two-Tier Planning Protocol

## 1. Executive Summary
**Objective**: Determine the optimal balance between "Direct Execution" and "Agentic Planning" for coding tasks.
A **"Plan-First" approach is mandated** for 95% of agentic tasks to reduce hallucinations, load context, and provide recovery checkpoints.

## 2. Tier 1: The "Fast Track" (Volatile)
*   **Use Case**: Formatting, Single-line CSS fixes, Comments, Typos (tasks < 5 lines / 1 file).
*   **File**: `.agent/plans/fastPlan.md` (Always exists, constantly overwritten).
*   **Process**:
    1.  User requests simple change.
    2.  Agent quickly writes 3-5 lines into `fastPlan.md` outlining the file target and the regex/line change.
    3.  Agent executes code.
    4.  **Archiving**: Content of `fastPlan.md` is appended to `.agent/plans/archive/daily_log.md`.
        *   **CRITICAL**: Insert a Timestamp Header (e.g., `\n---\n### [19:30:00] Run Cycle\n`) before appending.
        *   The `fastPlan.md` is then cleared.

## 3. Tier 2: The "Deep Dive" (Persistent)
*   **Use Case**: New Features, Refactoring, Multi-file edits, Logic changes.
*   **Naming Convention**: `Plan_{Description}_{Random6Digits}.md`
    *   Example: `Plan_AuthLogic_928371.md` or `Plan_Auth_Logic_928371.md`
    *   Allowed characters: Alphanumeric and Underscores.
*   **Process**:
    1.  **Create**: Agent creates the file in `.agent/plans/active/`.
    2.  **Populate**: Fills "Context Analysis", "Proposed Changes", "Verification Steps".
    3.  **Approve**: User (or Auto-Approver) confirms.
    4.  **Execute**: Agent works through the plan.
    5.  **Archive**: See below.

## 4. Archiving Process
When a plan is marked **DONE**:
1.  **Target Directory**: `.agent/plans/archive/{YYYY-MM-DD}/` (Created dynamically).
2.  **Action**: Move the `Plan_*.md` file from `active/` to `archive/{YYYY-MM-DD}/`.
3.  **Index Update**: A central `.agent/plans/plan_history_log.md` is updated with a one-line summary:
    *   `[YYYY-MM-DD] Plan_Description_123456: Summary of Action (Success/Fail).`
