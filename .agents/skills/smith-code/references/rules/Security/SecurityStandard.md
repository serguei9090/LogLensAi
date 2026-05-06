# Security Framework (v2)

## 1. Core Principles (Invariants)
*   **Shift Left:** Security is not a final check. It happens on every commit.
*   **Zero Secrets:** No API Key, Password, or Token shall ever enter `git`.
*   **Zero Criticals:** No Critical or High CVEs in production dependencies.
*   **Defense in Depth:** Validate Logic (SAST), Dependencies (SCA), and Infrastructure (Container).

## 2. Workflow (The Security Shield)
1.  **Local (Hooks):** `gitleaks` checks staged files. If secret found, Commit Blocked.
2.  **Logic (SAST):** `semgrep` scans for XSS/SQLi patterns.
3.  **Deps (SCA):** `trivy` scans `package.json`. If High CVE found, Upgrade required.
4.  **Container:** `trivy image` scans the final Docker artifact.

## 3. Toolchain (Strict)
*   **Secrets:** `gitleaks` (The Gatekeeper).
*   **Dependencies:** `trivy` (The Auditor).
*   **Logic:** `semgrep` (The Code Scanner).
*   **Dashboard:** `DefectDojo` (Optional Central View).

## 4. Forbidden Patterns (Strict)
1.  **Hardcoded Secrets:** `const KEY = "sk-123..."`. Use `.env`.
2.  **Ignored Vulnerabilities:** Failing to patch a Critical CVE for speed.
3.  **Blind Trust:** Using `dangerouslySetInnerHTML` without sanitation.
4.  **Root Containers:** Running Docker as `USER root`. Always use `USER node`.

## 5. Golden Example (Exclusion Policy)
```text
# .trivyignore
# Rationale: Only affecting Windows, we run Linux.
CVE-2023-1234
```

```yaml
# lefthook.yml segment
secrets:
  run: gitleaks protect --staged --verbose --redact
```
