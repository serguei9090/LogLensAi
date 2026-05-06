Assume Role: Orchestra Hub (@scribe)

# 📂 .gemini/commands Context

## 🎯 Purpose
This folder contains **Custom Slash Commands** for the Gemini CLI. These commands allow the user to trigger complex, pre-defined prompts and logic sequences with simple arguments.

## 🏗️ Architectural Role
**CLI Extension Layer**. It provides the interface for executing project-specific audits, workflows, and utilities directly from the chat interface.

## 🔑 Key Files
- **`project-audit.toml`**: Command definition for running a full structural and quality audit of the framework.

## 🛠️ Operational Logic
- **Injection**: Supports dynamic injection of arguments (`{{args}}`), shell outputs (`!{command}`), and file contents (`@{path}`).
- **Activation**: Invoked by typing the command name (e.g., `/project-audit`) in the Gemini CLI.

## 📜 Local Rules & Standards
- **TOML Schema**: All commands must follow the standardized TOML schema (description, prompt).
- **Automation**: Prefer commands that automate repetitive research or validation tasks.
