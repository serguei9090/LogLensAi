# Morphic Roadmap Sync Architecture

This diagram maps the relationship between the human-facing `TODO.md` and the AI-facing internal state in Gemini CLI, ensuring the "Parity Law" is strictly enforced.

```mermaid
graph TD
    subgraph UserSpace [Human Workspace]
        H_TODO["docs/track/TODO.md<br/>(Master Source of Truth)"]
        H_DEBT["docs/track/CodeDebt.md"]
        H_TODOC["docs/TODOC/<unique_id>.md"]
    end

    subgraph AgentRuntime [Gemini CLI Environment]
        A_TASK["Internal task.md<br/>(Ephemeral Execution State)"]
        A_RULES[".agents/rules/*.md<br/>(System Constraints)"]
        A_CONTEXT["AGENTS.md<br/>(System Prompt Injector)"]
    end

    subgraph ExecutionCycle [Plan-Act-Validate Loop]
        P1[Plan: Read TODO.md]
        P2[Act: Update internal task.md]
        P3[Validate: Verify Sync]
        P4[Finalize: Commit [x] to TODO.md]
    end

    %% Sync Relationships
    H_TODO -- "1. Context Load" --> P1
    A_RULES -- "2. Constraints Enforcement" --> P1
    A_CONTEXT -- "3. Initialization" --> A_TASK
    P1 -- "4. Logic Parity" --> A_TASK
    A_TASK -- "5. Execution" --> P2
    P2 -- "6. Report Status" --> P3
    P3 -- "7. Close Loop [x]" --> H_TODO
    
    %% Debt & Detail Logic
    P2 -- "If New Debt" --> H_DEBT
    P2 -- "If Missing Logic" --> H_TODOC
    H_TODOC -- "Reference" --> H_TODO

    %% Behavioral Notes
    style UserSpace fill:#f9f,stroke:#333,stroke-width:2px
    style AgentRuntime fill:#bbf,stroke:#333,stroke-width:2px
    style ExecutionCycle fill:#dfd,stroke:#333,stroke-width:2px
```

## How Sync works in Gemini CLI
1.  **Rule Ingestion**: Because the rules are in `.agents/rules/`, Gemini CLI automatically triggers them based on their `trigger` property (e.g., `always_on` or `glob`).
2.  **Parity Enforcement**: The `ProjectTracking.md` rule mandates that the agent check `docs/track/TODO.md` before starting any task. This forces the agent's internal `task.md` to be an exact copy of the active sprint in the `TODO.md`.
3.  **The "Act" behavioral pattern**: When Gemini CLI executes a sub-task, it uses the "Morphic" rules to ensure the code follows **DRY/SOLID** and the documentation follows the **TODO(ID)** protocol.
4.  **Automatic Rules Application**: Yes, when using Gemini CLI, any file in `.agents/rules/` or `.agents/workflows/` is treated as a foundational instruction. By placing these in the root of your project, you ensure the AI remains within the "Morphic" architectural guardrails throughout the entire session.
