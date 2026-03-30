---
name: skill-creator
description: Specialized skill for creating and maintaining modular Agent Skills. Use this when you need to define new capabilities, multi-step workflows, or automated scripts for the AI assistant.
---

# Skill Creator Skill

This skill provides expert guidance for creating effective Agent Skills in the `.agents/skills/` directory.

## Skill Anatomy

Every skill consists of a required `SKILL.md` file and optional bundled resources:

```
skill-name/
├── SKILL.md (required)
│   ├── YAML frontmatter (name, description)
│   └── Markdown instructions (procedures, tools)
├── scripts/          - Executable code (Python/Bash/etc.)
├── references/       - Documentation to be loaded as needed
└── assets/           - Files used in output (templates, icons)
```

## SKILL.md Requirements

### 1. Frontmatter (YAML)
- `name`: Unique identifier for the skill.
- `description`: CLEAR, concise summary. This is the primary triggering mechanism. It must describe WHAT the skill does and WHEN to use it.

### 2. Body (Markdown)
- **High Signal**: Only add context the AI doesn't already have.
- **Workflow-Centric**: Focus on sequential steps, tool usage, and conditional logic.
## Resources Reference

- **`references/output-patterns.md`**: Best practices for consistent AI output (Templates, Examples).
- **`references/workflows.md`**: Patterns for sequential and conditional workflows.
- **`scripts/init_skill.py`**: Python script to bootstrap a new skill directory.
- **`scripts/quick_validate.py`**: Script to verify skill structure and frontmatter.

## Creation Workflow

1. **Understand Patterns**: Identify a recurring task or workflow that requires specialized knowledge or tools.
2. **Plan Resources**: Determine what scripts, references, or assets are needed.
3. **Initialize**: Use `scripts/init_skill.py <name> --path .agents/skills/`.
4. **Draft SKILL.md**: Write the triggering description and the procedural body.
5. **Implement Resources**: Use patterns from `references/` for high-quality output.
6. **Integrate**: Add the new skill to the project's `AGENTS.md` context.
