---
description: Standardized Git Push Pipeline for Antigravity Agent
---

# Git Push Workflow (`/git-push`)

This workflow defines the standard procedure for staging, committing, updating changelogs, and pushing code to the remote repository.

## Step 1: Quality Assurance
Before committing any code, ensure it aligns with the project's quality standards.

// turbo
1. Run linter and formatter checks using Biome and Ruff to ensure no errors are being pushed.
```bash
bunx @biomejs/biome check --write src && uv run ruff check sidecar && uv run ruff format sidecar
```

## Step 2: Update the Changelog
Maintain an accurate history of changes.

1. Ensure the recent work is properly documented in `docs/track/CHANGELOG.md` or `docs/track/LessonsLearned.md`. If a changelog file doesn't exist, create one or document the major updates in the relevant tracking file.

## Step 3: Stage Changes
Add all the relevant completed files to the git staging area.

// turbo
1. Add the files:
```bash
git add .
```

## Step 4: Conventional Commit
Create a commit message following the [Conventional Commits](https://www.conventionalcommits.org/) format.

**Standard Prefixes:**
- `feat:` A new feature
- `fix:` A bug fix
- `docs:` Documentation only changes
- `style:` Changes that do not affect the meaning of the code (white-space, formatting, missing semi-colons, etc)
- `refactor:` A code change that neither fixes a bug nor adds a feature
- `perf:` A code change that improves performance
- `test:` Adding missing tests or correcting existing tests
- `chore:` Changes to the build process or auxiliary tools and libraries such as documentation generation

*Make sure your commit message is concise and accurate about the changes made across the stack.*

1. Run the commit command with the determined prefix and message. Example:
```bash
git commit -m "feat(ai-tools): implement slash command autocomplete and context toggles"
```

## Step 5: Push to Remote
Push the changes to the active branch on the remote repository.

1. Push to the remote repository:
```bash
git push origin HEAD
```
