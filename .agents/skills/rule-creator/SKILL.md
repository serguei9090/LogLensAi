---
name: rule-creator
description: Specialized skill for creating and maintaining high-performance Agent Rules. Use this when you need to define new architectural guardrails, quality standards, or operational procedures for the AI.
---

# Rule Creator Skill

This skill provides expert guidance for creating effective Agent Rules in the `.agents/rules/` directory.

## Rule Structure Mandate

Every rule MUST follow this exact format:

```markdown
---
trigger: [always_on | glob | manual | model_decision]
globs: [Optional: *.js, src/**/*.py, etc. Required if trigger is glob]
description: [Short, high-signal summary of the rule's purpose]
---

# Rule Title

[Concise, imperative instructions and standards]
```

## Trigger Definitions

- **`always_on`**: The rule is injected into EVERY request. Use sparingly for core architectural laws.
- **`glob`**: Automatically triggered when files matching the `globs` pattern are in scope or modified.
- **`manual`**: The rule is only used when the user explicitly references it.
- **`model_decision`**: The agent decides when the rule is applicable based on the `description`.

## Core Principles for Rule Writing

1. **High Signal, Low Noise**: Use "Mnemonic Anchors" and avoid conversational filler. Every word must justify its token cost.
2. **Imperative Tone**: Use commands (e.g., "Enforce...", "Do not...", "Maintain...") rather than suggestions.
3. **Atomic Scope**: Each rule should focus on ONE specific domain (e.g., Architecture, Quality, or Testing).
4. **No Project Leaks**: Keep rules generalized. Avoid mentions of specific business logic or temporary project names unless it's a project-specific rule.

## Creation Workflow

1. **Identify the Need**: Determine if a new rule is required to solve a recurring quality issue or architectural drift.
2. **Define Trigger**: Select the most context-efficient trigger (always_on, glob, manual).
3. **Initialize**: Use `scripts/init_rule.py <rule-name> --trigger <trigger>`.
4. **Draft Instructions**: Write clear, senior-level engineering mandates.
5. **Validation**: Ensure the rule doesn't conflict with existing rules in `Architecture.md` or `SoftwareStandards.md`.
6. **Implement**: Refine the generated file in `.agents/rules/<RuleName>.md`.
