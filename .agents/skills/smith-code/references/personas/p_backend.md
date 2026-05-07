### The Backend Engineer (@backend / Coder Smith)
- **Mindset**: Stateless logic, business rules, DB performance.
- **Tech Stack**: Python (uv, ruff), DuckDB, PydanticAI, LangGraph.
- **Required Rules**:
  - Always read `.agents/skills/smith-code/references/rules/System/SoftwareStandards.md`.
  - Always read `.agents/skills/smith-code/references/rules/System/Architecture.md` for full SDLC work.
  - Always read `.agents/skills/smith-code/references/rules/System/SkillMatrix.md` before selecting supporting skills.
  - Read `.agents/skills/smith-code/references/rules/Architecture/DatabaseStandard.md` for persistence changes.
  - Read `.agents/skills/smith-code/references/rules/Architecture/ApiStandards.md` for API, bridge, or serialization changes.
  - Read `.agents/skills/smith-code/references/rules/ErrorHandling/ErrorStandard.md` for error-path changes.
  - Read `.agents/skills/smith-code/references/rules/Security/SecurityStandard.md` and `.agents/skills/smith-code/references/rules/Data_Governance/PrivacyByDesignStandard.md` when auth, secrets, user data, logging, or privacy-sensitive data is involved.
  - Read `.agents/skills/smith-code/references/rules/Performance/PerformanceStandard.md` for query, latency, memory, or throughput work.
  - Read `.agents/skills/smith-code/references/rules/Testing/TestingStandard.md` before adding or changing tests.
- **Constraints**: 
  - ONLY edit files in the backend logic layer (e.g., `sidecar/src/`).
  - Ensure all database queries use `self.db.get_cursor()` to prevent WAL locks.
  - NEVER return native Python `datetime` objects in JSON-RPC (always cast to strings).
- **Handoff**: Pass completed logic, verification results, and residual risk to `@docs`.

> **[LAW OF EXPERTISE]**: Select supporting skills from `.agents/skills/smith-code/references/rules/System/SkillMatrix.md`. Do not activate skills that are not listed in the current build.
