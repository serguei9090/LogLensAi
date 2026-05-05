# Git `post-commit` Hook: `scripts/hooks/post_commit.py`

This document details the functionality and role of the `scripts/hooks/post_commit.py` script, which serves as a crucial orchestration layer within the LogLensAi project's Git `post-commit` hook. Managed by `lefthook`, this Python script ensures that automated tasks, such as documentation synchronization and code indexing, are performed after every commit.

## Purpose and Role

The primary responsibilities of `post_commit.py` include:
1.  **Identifying Changed Files**: It determines which files were modified in the latest commit.
2.  **Triggering `doc-agent`**: It invokes the `@doc-agent` subagent to automatically update documentation based on code changes.
3.  **Initiating Codanna Indexing**: It triggers the Codanna indexing process for the changed files.
4.  **Cross-Platform Execution**: Designed to work seamlessly across Windows, Linux, and macOS environments.

By offloading these tasks to a background process, the script ensures that the Git commit operation remains fast and responsive, while still maintaining documentation parity and code intelligence.

## Integration with `lefthook`

The `post_commit.py` script is executed via the `post-commit` hook defined in `lefthook.yml`:

```yaml
post-commit:
  commands:
    sync:
      run: uv run python scripts/hooks/post_commit.py --task all
```

The `--task all` argument ensures that both documentation synchronization and Codanna indexing are performed. Individual tasks can also be run using `--task docs` or `--task index`.

## Workflow Details

### 1. Identifying Changed Files

The script uses `git diff-tree` to obtain a list of files modified in the `HEAD` commit:

```python
def get_changed_files():
    """Get list of files changed in the HEAD commit."""
    return run_command(["git", "diff-tree", "--no-commit-id", "--name-only", "-r", "HEAD"])
```

### 2. Triggering `doc-agent`

After collecting the changed files, the script constructs a prompt and invokes the `gemini` CLI in the background to delegate the documentation task to the `@doc-agent` subagent. The `TODOC` keyword in the prompt explicitly signals the agent to consider updating `TODO.md`.

```python
def trigger_doc_agent(files, log_file):
    # ...
    prompt = f"Run @doc-agent to update docs/track/ and TODOC based on these changed files:\n{files_list}"
    # ...
    subprocess.Popen(["gemini", "-y", "-p", prompt], **kwargs)
```

The `doc-agent` analyzes the provided `files_list` and performs the necessary updates to `docs/track/` and `TODO.md` (or any other relevant documentation as per its configuration).

### 3. Initiating Codanna Indexing

Similarly, Codanna indexing is triggered for the changed files, running in the background to keep the code intelligence database up-to-date.

```python
def run_codanna_index(files, log_file):
    # ...
    cmd = ["uv", "run", "python", "scripts/codanna/index.py"] + files.splitlines()
    # ...
    subprocess.Popen(cmd, **kwargs)
```

### 4. Logging

All background processes initiated by `post_commit.py` log their output to `scripts/hooks/logs/post_commit.log`. This allows for asynchronous monitoring and debugging of the automated tasks.

```python
def get_log_file():
    log_dir = os.path.join("scripts", "hooks", "logs")
    os.makedirs(log_dir, exist_ok=True)
    return open(os.path.join(log_dir, "post_commit.log"), "a", encoding="utf-8")
```

Developers can check this log file for the status and output of `doc-agent` and Codanna indexing runs.

## Conclusion

The `post_commit.py` script embodies the project's commitment to automation and maintaining high-quality documentation and code intelligence. It ensures that critical post-commit tasks are reliably executed without interrupting the developer's flow.
