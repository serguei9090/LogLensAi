---
trigger: always_on
description: Verification rule for project facts, code relationships, commands, and external APIs.
---

# Zero-Guesswork Protocol

## Core Law

Do not guess project facts when repository files, Codanna, command help, tests, or official documentation can verify them.

## Required Verification

| Situation | Required action |
| --- | --- |
| Unknown file location | Use `rg --files`, `rg`, or Codanna search. |
| Unknown symbol impact | Use Codanna impact/call tools when available, otherwise search callers with `rg`. |
| Unknown command behavior | Run `<command> --help` or read project scripts. |
| Unknown external API | Check local usage first, then official docs if needed. |
| Unknown task state | Run `bd ready` or inspect Beads state. |

## Allowed Inference

Inference is allowed for general software judgment, small non-critical implementation details, or when verification tools are unavailable. Label consequential unverified assumptions as inferred.

## No Silent Placeholders

- Do not leave placeholder implementation without creating follow-up work in `bd`.
- Do not remove symbols without checking usage.
- Do not overwrite files from memory; read before editing.
- Do not present skipped verification as completed verification.

