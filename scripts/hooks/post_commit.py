"""
Cross-platform Git hook helper for LogLensAi.
Handles:
  1. Capturing changed files from the latest commit.
  2. Triggering the Gemini @doc-agent subagent.
  3. Running Codanna indexing.

Usage:
    uv run python scripts/hooks/post_commit.py --task [docs|index|all]
"""
import subprocess
import sys
import argparse
import os

def run_command(cmd, shell=False):
    """Run a shell command and return stdout."""
    try:
        result = subprocess.run(
            cmd, 
            shell=shell, 
            check=True, 
            capture_output=True, 
            text=True
        )
        return result.stdout.strip()
    except subprocess.CalledProcessError as e:
        print(f"Error running command: {e}")
        if e.stderr:
            print(f"Stderr: {e.stderr}")
        return None

def get_changed_files():
    """Get list of files changed in the HEAD commit."""
    # --no-commit-id: don't print the commit hash
    # --name-only: only filenames
    # -r: recursive
    return run_command(["git", "diff-tree", "--no-commit-id", "--name-only", "-r", "HEAD"])

def get_log_file():
    """Ensure the log directory exists and return an open file handle."""
    log_dir = os.path.join("scripts", "hooks", "logs")
    os.makedirs(log_dir, exist_ok=True)
    return open(os.path.join(log_dir, "post_commit.log"), "a", encoding="utf-8")

def trigger_doc_agent(files, log_file):
    """Invoke the Gemini @doc-agent subagent in the background."""
    if not files:
        return
    
    # Format files list for the prompt
    files_list = "\n".join(f"- {f}" for f in files.splitlines())
    prompt = f"Run @doc-agent to update docs/track/ and TODOC based on these changed files:\n{files_list}"
    
    print(f"Backgrounding @doc-agent for {len(files.splitlines())} files...")
    
    # Backgrounding flags
    kwargs = {
        "shell": (os.name == 'nt'),
        "stdout": log_file,
        "stderr": log_file,
        "stdin": subprocess.DEVNULL,
    }
    
    if os.name == 'nt':
        # Windows: Run without window and detached
        kwargs["creationflags"] = subprocess.DETACHED_PROCESS | subprocess.CREATE_NO_WINDOW
    else:
        # Unix: Start in a new session
        kwargs["start_new_session"] = True

    subprocess.Popen(["gemini", "-y", "-p", prompt], **kwargs)

def run_codanna_index(files, log_file):
    """Run the codanna indexing script in the background."""
    if not files:
        return
    
    print("Backgrounding Codanna indexing...")
    cmd = ["uv", "run", "python", "scripts/codanna/index.py"] + files.splitlines()
    
    # Backgrounding flags (same as above)
    kwargs = {
        "stdout": log_file,
        "stderr": log_file,
        "stdin": subprocess.DEVNULL,
    }
    
    if os.name == 'nt':
        kwargs["creationflags"] = subprocess.DETACHED_PROCESS | subprocess.CREATE_NO_WINDOW
    else:
        kwargs["start_new_session"] = True

    subprocess.Popen(cmd, **kwargs)

def main():
    parser = argparse.ArgumentParser(description="LogLensAi Post-Commit Hooks")
    parser.add_argument("--task", choices=["docs", "index", "all"], default="all", help="Task to perform")
    args = parser.parse_args()

    files = get_changed_files()
    if not files:
        print("No files changed in this commit.")
        return

    # Open log file for the lifetime of the launcher script
    with get_log_file() as log_file:
        import datetime
        log_file.write(f"\n--- Post-Commit Run: {datetime.datetime.now()} ---\n")
        log_file.write(f"Files: {files.splitlines()}\n")
        log_file.flush()

        # We run both in background so the hook finishes immediately
        if args.task in ["index", "all"]:
            run_codanna_index(files, log_file)

        if args.task in ["docs", "all"]:
            trigger_doc_agent(files, log_file)

    print("Post-commit tasks triggered successfully. Check scripts/hooks/logs/post_commit.log for status.")

if __name__ == "__main__":
    main()
