# Protocol: Disaster Recovery & Rollback

## 1. Objective
To maintain 99.9% availability by defining explicit steps to recover from bad deployments, data corruption, or severe logic regressions.

## 2. Triggers
*   **Severity 1 (Critical):** Production is down.
*   **Severity 2 (High):** Core feature (Login, Checkout) broken.
*   **Data Loss:** Accidental `DROP TABLE` or schema corruption.

## 3. Immediate Action: The "Stop the Bleeding" Phase
1.  **Acknowledge:** Post in `#incidents` channel (Slack/Teams).
2.  **Freeze:** Pause all CI/CD pipelines to prevent further bad code from shipping.
    *   `lefthook` (if local) helps, but cloud pipeline pause is critical.

## 4. Rollback Strategy

### Scenario A: Bad Code (Stateless)
*   **Method:** "Revert Commit" or "Redeploy Previous Tag".
*   **Command:** `git revert HEAD` (if detected immediately) or `git checkout tags/v1.0.4`.
*   **Action:**
    1.  Checkout last known stable commit.
    2.  Increment Patch Version (e.g., 1.0.5 -> 1.0.6-hotfix).
    3.  Force push / Deploy.

### Scenario B: Bad Schema (Database Migration)
*   **Pre-Requisite:** You MUST have backups (PITR - Point In Time Recovery) enabled.
*   **Method:** "Down Migration" vs "Restore".
    *   *Minor Drift:* Use Prisma/TypeORM `migration down` if safe.
    *   *Data Loss:* **DO NOT** run migrations. Initiate Full Restore from Backup (Time: T-minus 5 mins before deployment).

## 5. Post-Mortem (The "Learning" Phase)
*   **Requirement:** Within 24 hours of resolution.
*   **Artifact:** Create `Reports/Incident_{YYYY-MM-DD}.md`.
*   **Content:**
    *   Timeline of events.
    *   Root Cause Analysis (5 Whys).
    *   Corrective Actions (e.g., "Add E2E test for Checkout").

## 6. Agent Instructions
If the user says "Production is broken!" or "Undo that!", you **MUST**:
1.  Check `plan_history_log.md` to see what changed last.
2.  Switch to **Verification Mode**.
3.  Offer to execute `git revert`.
