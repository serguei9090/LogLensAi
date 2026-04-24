---
description: "Initialize or update folder-level Project Memory (GEMINI.md) for Deep Context."
---

> **Assume Role:** @scribe

# `/gemini-context` — Localized Context Generator

## 🎯 Purpose

Create or update a `GEMINI.md` file within a specific subfolder to ensure the Gemini CLI has precise, localized context about that folder's responsibility, architecture, and key interfaces.

---

## 📋 Pre-flight: Folder Analysis

1. **Target Identification**: Resolve the subfolder path provided in `{{args}}`.
2. **Structural Scan**: List the directory contents to identify:
   - Primary entry points (e.g., `index.ts`, `api.py`, `main.dart`).
   - Configuration files (e.g., `schema.prisma`, `tailwind.config.js`).
   - Sub-directories (e.g., `atoms/`, `services/`, `models/`).
3. **Logic Extraction**: Read the headers of key files to understand their architectural role.

---

## 🔧 Step 1 — Content Generation

Generate the `GEMINI.md` content using the following standard template:

### Standard Sub-Context Template

```md
# 📂 localized-folder-name Context

## 🎯 Purpose
[High-level summary of why this folder exists and what it handles.]

## 🏗️ Architectural Role
[Description of where this fits in the Hexagonal/Sidecar architecture. e.g., "Domain Layer (Port)", "Infrastructure (Adapter)", "UI Molecule Layer".]

## 🔑 Key Files & Exports
- **`file_name.ext`**: [Role and primary functions/classes exported.]
- **`another_file.ext`**: [Role.]

## 🛠️ Operational Logic
- **Data Flow**: [How data enters and leaves this folder.]
- **State Management**: [Does it hold state? How is it persisted?]
- **Concurrency**: [Is it async/thread-safe?]

## 📜 Local Rules & Standards
- [Any specific linting, naming, or testing rules for this folder.]

## 🔗 Dependencies
- **Internal**: [Which other project folders does this rely on?]
- **External**: [Third-party libraries used heavily here.]
```

---

## 📝 Step 2 — File Creation

1. **Write File**: Save the generated content as `<subfolder>/GEMINI.md`.
2. **Overwrite Policy**: If a `GEMINI.md` already exists, perform a "Semantic Merge" — preserve manually written descriptions while updating the "Key Files" and "Dependencies" sections.

---

## 🏁 Completion Checklist

- [ ] Subfolder `GEMINI.md` created/updated.
- [ ] Content reflects current reality of the files.
- [ ] Role correctly mapped to the project's global architecture.
- [ ] Summary shared with user: "Context generated for `<subfolder>`."

## 🚨 Mandatory Quality Standards
- **Assume Role Header**: Every file you create or edit MUST start with a `> **Assume Role:** @handle` header.
- **Semantic Commenting**: 
  - Every function MUST include a purpose, the architectural rationale, and a `Ref:` to the relevant spec file.
  - Every non-trivial variable MUST have an inline comment explaining **WHY** it exists.
- **TODO(ID) Protocol**: Any incomplete logic MUST use the strict syntax: 
  `// TODO(ID): [WHAT] ... [WHY] ... [EXPECTATION] ... [CONTEXT] See docs/track/specs/ID.md`