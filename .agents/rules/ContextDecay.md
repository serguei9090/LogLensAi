---
trigger: model_decision
description: Protocol for identifying and archiving low-signal context to optimize token usage.
---
# Context Decay & Rule Pruning Protocol

To maintain high performance and low token usage, the Antigravity framework must undergo periodic "Context Cleansing."

## 1. Defining "Low Signal" Context
Context is considered "Stale" or "Low Signal" if:
- It exists in `.agents/rules/` but hasn't been triggered or referenced in the last 20 tasks.
- It contains redundant information that is already covered by a higher-level rule.
- It describes technologies or processes that are no longer part of the project's daily operations.

## 2. The Decay Audit
During the `/auto-improve` or `/self-evolve` workflows:
1.  **Analyze Task Frequency**: Check `telemetry.csv` and `docs/track/TODO.md` to see which domains (e.g., "Deployment," "Testing," "UI") are currently active.
2.  **Identified Redundancy**: If two rules (e.g., `Quality.md` and `StyleGuide.md`) both mention "Use camelCase," merge them into a single high-density rule.
3.  **Flag for Pruning**: Any rule flagged as "Stale" should be moved to `docs/archive/rules/` instead of being deleted.

## 3. Token Density Standards (Optimization)
- **Eliminate Fluff**: Use concise, declarative language. Avoid "In this project, we prefer to..." and use "Protocol: Use X."
- **Mnemonic Anchors**: Use short, unique terms to trigger complex behaviors instead of verbose descriptions.
- **Hierarchical Loading**: Ensure rules use `trigger: glob` or `trigger: manual` so they aren't loaded into every turn's context unless needed.
