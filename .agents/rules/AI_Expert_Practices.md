---
trigger: always_on
description: Expert-level best practices for high-performance AI collaboration.
---

# AI-Native Software Engineering: Expert Best Practices

To achieve the best results when collaborating with an AI Agent in the Morphic Framework, adhere to these "AI-Native" expert practices:

## 1. Context Injection & Pruning
- **Prompt Caching Optimization**: Keep your `AGENTS.md` and rules concise but high-signal. Use "Mnemonic Anchors" (short, memorable terms like "Parity Law") to trigger complex behaviors with minimal tokens.
- **Context Awareness**: Before a major task, explicitly ask the AI to "Summarize the current state of `docs/track/TODO.md` and `CodeDebt.md`" to ensure its short-term memory is aligned with the long-term project files.

## 2. The "Double-Check" Loop (Verification Protocol)
- **Empirical Validation**: Never accept a fix from an AI without a corresponding test case. The AI must first reproduce the bug with a test, then fix it, then verify.
- **Self-Correction Step**: Force the AI to "Reflect on this implementation against `SoftwareStandards.md`" before it commits the code. This triggers a higher-order reasoning pass.

## 3. Modular "Small-Batch" Engineering
- **Surgical Edits**: Avoid asking the AI to "Refactor the whole project." Instead, use a "Feature-Silo" approach. Refactor one module, verify, then move to the next.
- **Stateless Logic**: AI excels at writing pure, stateless functions. Architect your system to minimize global state, making it easier for the AI to reason about individual components.

## 4. Documentation-as-Code (DaC)
- **Living Specs**: Treat your `TODO.md` and `AGENTS.md` as "code." If the AI deviates from a rule, don't just tell it—update the rule in `.agents/rules/` to be more explicit.
- **Traceability**: Every AI-generated file should ideally reference the `TODO(ID)` that triggered its creation, ensuring a clear audit trail from requirement to implementation.
