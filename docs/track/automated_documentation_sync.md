# Automated Documentation Synchronization with Doc-Agent

This document outlines the automated process for maintaining documentation parity with the codebase, facilitated by the `doc-agent` subagent.

## Purpose

The `doc-agent` is responsible for observing structural code changes and automatically updating relevant documentation, including:
- Files within `docs/track/`
- The project's `TODO.md` file
- API contracts (if applicable)

Its primary goal is to ensure 100% parity between the implementation and Living Specifications without requiring manual intervention from developers.

## Trigger Mechanism

The `doc-agent` is integrated into the development workflow via a `post-commit` Git hook managed by `lefthook`.

- **Configuration File**: `lefthook.yml`
- **Hook Name**: `sync`
- **Script Orchestrator**: `scripts/hooks/post_commit.py`

When a commit is made, the `scripts/hooks/post_commit.py` Python script is executed. This script identifies changed files and then invokes the `gemini` CLI in the background, delegating the documentation task to the `@doc-agent` subagent. The subagent then analyzes the changes and performs the necessary documentation updates. Additionally, `scripts/hooks/post_commit.py` also triggers Codanna indexing.

## Scope of Updates

The `doc-agent` focuses on:
- **Reflecting structural code changes**: This includes new features, modifications to existing structures, or removal of deprecated components.
- **Generating/Patching Markdown**: The agent can create new `.md` files or update existing ones to reflect the latest code implementation.
- **Maintaining `TODO.md`**: It ensures the project's task list is current, adding or removing items based on code changes and newly identified documentation gaps.

This automation helps developers focus on coding while the documentation stays up-to-date, providing a reliable source of truth for the project's evolving architecture and features.
