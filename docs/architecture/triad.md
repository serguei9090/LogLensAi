# AI Agentic Workflow Visualization

This diagram illustrates the interaction between the **Antigravity Command Center**, the **Gemini Subagents**, and the **Jules Remote Agent**.

```mermaid
graph TD
    User([User Request]) --> Antigravity{"Antigravity<br/>(Main Command Center)"}

    subgraph "Local Execution Layer"
        Antigravity -->|Standard Tasks| GeminiCLI["Gemini CLI<br/>(Subagents)"]
        GeminiCLI -->|Edit/Lint/Doc| Workspace[(Local Codebase)]
    end

    subgraph "Remote Asynchronous Layer"
        Antigravity -->|Commit & Push| GitHub[(GitHub/Origin)]
        GitHub -->|jules remote new... --record| Jules["Jules CLI<br/>(Remote Agent)"]
        Jules -->|Process Task| RemoteEnv[Cloud Environment]
        RemoteEnv -->|Apply Patch| Workspace
    end

    subgraph "Persistence & Standards"
        Workspace -->|Sync| Rules[.agents/rules]
        Workspace -->|Record| Tracking[docs/track/TODO.md]
        Rules -->|Informs| Antigravity
    end

    subgraph "Self-Optimization & Evolution"
        Antigravity -->|Reflection| AutoImprove["/auto-improve workflow"]
        Antigravity -->|Strategic Growth| SelfEvolve["/self-evolve workflow"]
        AutoImprove & SelfEvolve -->|Refine & Expand| Rules
        SelfEvolve -->|Add New| Skills[.agents/skills]
        SelfEvolve -->|Fine-tune| Subagents[.gemini/agents]
    end
```

## Workflow Use Cases

This section contains detailed diagrams illustrating how **Antigravity** resolves specific engineering challenges.

### 1. The Surgical Strike (High-Speed Local Edit)
Used for atomic code changes, linting, and documentation where immediate feedback is required.

```mermaid
graph TD
    User([User Request]) --> Antigravity{Antigravity}
    Antigravity -->|Identify Small Task| GeminiCLI["Gemini CLI (@doc-agent/@lint-agent)"]
    
    subgraph "Execution Layer"
        GeminiCLI -->|Modify/Format| Workspace[(Local Workspace)]
    end
    
    subgraph "Validation Layer"
        Workspace -->|Pre-commit Hook| Biome/Ruff{Linter/Formatter}
        Biome/Ruff -->|Pass/Telemetery| Antigravity
    end
```

---

### 2. The Deep Refactor (Manifest-based Remote Handoff)
Used for multi-file refactors and long-running feature builds that require asynchronous autonomy.

```mermaid
graph TD
    Antigravity{Antigravity} -->|Plan Refactor| TaskManifest[handoff.json]
    TaskManifest -->|git add & commit| LocalRepo[(Local Repo)]
    LocalRepo -->|git push origin| RemoteRepo[(Remote Repo)]
    RemoteRepo -->|jules remote new... --record| JulesCLI["Jules CLI (Remote Agent)"]
    
    subgraph "Asynchronous Cloud Loop"
        JulesCLI -->|Clone & Code| CloudEnv["Remote Sandbox"]
        CloudEnv -->|Recursive Test/Fix| CloudEnv
        CloudEnv -->|Generate Patch| Patch["patch.diff"]
    end
    
    Patch -->|jules remote pull --apply| Workspace[(Local Workspace)]
    Workspace -->|Log Success| JULES_MD["docs/track/JULES.md"]
```

---

### 3. The Autonomous Evolution & Audit (Proactive Growth)
How the framework improves its own rules and detects architectural drift.

```mermaid
graph TD
    Auditor["@auditor-agent"] -->|Background Sweep| Workspace[(Local Workspace)]
    
    subgraph "Evolution Loop"
        Auditor -->|Detect Drift| AuditReport["docs/evolution/audit_report.md"]
        AuditReport -->|Input| AutoImprove["/auto-improve workflow"]
        AutoImprove -->|Context Decay| Rules[.agents/rules]
        Rules -->|Refine Rules| Rules
    end
    
    subgraph "Telemetry Analysis"
        Telemetry[(telemetry.csv)] -->|Low-Signal Check| AutoImprove
    end
```

---

### 4. The Interoperability HAL (Universal Portability)
Standardizing environment setup across different developer machines and shells.

```mermaid
graph TD
    HAL[agents.yaml] -->|Path Resolution| Antigravity{Antigravity}
    
    subgraph "Environment Abstraction"
        Antigravity -->|shell_command| HAL_Script["scripts/hal-check.ps1"]
        HAL_Script -->|Verify Binaries| Toolchain["uv/bun/git/biome"]
    end
    
    Toolchain -->|Ready| Execution[Standardized Run]
```
