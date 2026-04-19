# Code Quality Framework (v2)

## 1. Core Principles (Invariants)
*   **One Tool:** Use `Biome` for both Linting and Formatting. (Speed > Granularity).
*   **Zero Bugs:** Reliability Rating MUST be A.
*   **Zero Debt:** Technical Debt Ratio < 5%.
*   **Local Enforcement:** Hooks (Lefthook) must catch errors BEFORE they reach CI.

## 2. Workflow (The Quality Gate)
1.  **Pre-Commit:**
    *   `biome check --files-ignore-unknown=true` (Format + Lint).
    *   `gitleaks` (Secrets).
2.  **Pre-Push:**
    *   `[PKG_MANAGER] test` (Unit Integrity).
3.  **CI Analysis:**
    *   Biome CI Check.
    *   SonarQube Scan (Deep Analysis - Optional).
4.  **Merge Check:**
    *   If Quality Gate fails -> PR Blocked.

## 3. Toolchain (Strict)
*   **Orchestrator:** `Lefthook` (Fast, parallel, Go-based).
*   **Engine:** `Biome` (Rust-based, replaces ESLint + Prettier).
*   **Commit Msg:** `Commitlint` (Conventional Commits).

## 4. Forbidden Patterns (Strict)
1.  **Bypassing Hooks:** `git commit --no-verify`. **BANNED.**
2.  **Complex Functions:** Cyclomatic Complexity > 15. Refactor immediately.
3.  **Console Logs:** Committing `console.log` to production code.
4.  **Ignored Tests:** Using `.skip` on failing tests instead of fixing them.

## 5. Golden Example (Lefthook Configuration)
```yaml
# lefthook.yml
pre-commit:
  parallel: true
  commands:
    # 1. Secret Scan (Blocker)
    secrets:
      run: gitleaks protect --staged
    
    # 2. Biome (Format & Lint)
    check:
      glob: "*.{js,ts,tsx,json,css}"
      run: [EXECUTE_CMD] @biomejs/biome check --files-ignore-unknown=true {staged_files}

commit-msg:
  commands:
    # 3. Message Standard (feat: ...)
    commitlint:
      run: [EXECUTE_CMD] commitlint --edit {1}
```
