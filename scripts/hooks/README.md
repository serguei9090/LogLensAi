# Git Hook Agent Triggers (`scripts/hooks`)

## Overview
Post-commit automation helper that inspects files modified in the latest git commit (`HEAD`) and launches configured `gemini` CLI agent tasks asynchronously in detached background processes, recording execution logs under `scripts/hooks/logs/`.

## Interface
- `[agent_triggers.py:AGENTS]`: Module-level list of agent configuration dictionaries (`name`, `description`, `prompt_template`, `enabled`), currently defining `doc-agent` (`enabled: True`).
- `[agent_triggers.py:run_command]`: Runs a subprocess command (`subprocess.run(..., check=True, capture_output=True, text=True)`) and returns stripped `stdout`, or `None` on `subprocess.CalledProcessError`.
- `[agent_triggers.py:get_changed_files]`: Queries `git diff-tree --no-commit-id --name-only -r HEAD` via `run_command` to return changed file paths from `HEAD`.
- `[agent_triggers.py:get_log_file]`: Creates `scripts/hooks/logs` if absent and opens `scripts/hooks/logs/agent_triggers.log` in UTF-8 append mode.
- `[agent_triggers.py:trigger_agent]`: Formats `agent_config["prompt_template"]` with bulleted `files`, writes launch/error entries to `log_file`, and starts a detached background `gemini -y -p ...` process via `subprocess.Popen`.
- `[agent_triggers.py:main]`: CLI entry point accepting `--agent <name>` (`argparse.ArgumentParser`), retrieving `HEAD` changed files, logging commit metadata, and invoking `trigger_agent` for matching enabled (or explicitly targeted) entries in `AGENTS`.

## Invariants
- `[agent_triggers.py:main]`: Exits immediately without creating or appending to `agent_triggers.log` if `get_changed_files()` returns empty or `None`. When `--agent` is omitted, only `AGENTS` entries with `enabled=True` run; when `--agent` is specified, any entry matching `agent_config["name"] == args.agent` runs regardless of `enabled`.
- `[agent_triggers.py:get_log_file]`: Assumes the working directory is the repository root because the log directory path is fixed to `os.path.join("scripts", "hooks", "logs")`.
- `[agent_triggers.py:get_changed_files]`, `[agent_triggers.py:trigger_agent]`: Require `git` and the `gemini` CLI on `PATH`; `trigger_agent` formats `prompt` directly into a shell command string (`shell=(os.name == "nt")`).

## Side Effects
- `[agent_triggers.py:get_changed_files]`: Spawns a `git diff-tree` subprocess reading `HEAD`.
- `[agent_triggers.py:get_log_file]`, `[agent_triggers.py:main]`, `[agent_triggers.py:trigger_agent]`: Creates `scripts/hooks/logs/` if missing and appends timestamps, commit file lists, errors, and child process `stdout`/`stderr` to `scripts/hooks/logs/agent_triggers.log`.
- `[agent_triggers.py:trigger_agent]`: Spawns detached background `gemini` processes (`DETACHED_PROCESS | CREATE_NO_WINDOW` on Windows; `start_new_session=True` on POSIX) and prints a confirmation message to stdout.

## Verification
- Run: `N/A` (no automated test suite; verify CLI options via `uv run scripts/hooks/agent_triggers.py --help`).
