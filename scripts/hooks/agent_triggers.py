"""
Agent Trigger Helper for LogLensAi.
This script captures changed files from the latest commit and triggers 
one or more Gemini subagents in the background.

To add a new agent:
Add a new dictionary to the AGENTS list in the main() function.
"""
import argparse
import datetime
import os
import subprocess

# --- CONFIGURATION: ADD NEW AGENTS HERE ---
AGENTS = [
    {
        "name": "doc-agent",
        "description": "Updates documentation and tracking files",
        "prompt_template": "Run @doc-agent to update docs/track/ and TODOC based on these changed files:\n{files_list}",
        "enabled": True,
    },
    # Example of how to add a new agent:
    # {
    #     "name": "test-agent",
    #     "description": "Generates tests for changed files",
    #     "prompt_template": "Run @test-agent to generate vitest cases for these files:\n{files_list}",
    #     "enabled": False,
    # },
]
# ------------------------------------------

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
    except subprocess.CalledProcessError:
        return None

def get_changed_files():
    """Get list of files changed in the HEAD commit."""
    return run_command(["git", "diff-tree", "--no-commit-id", "--name-only", "-r", "HEAD"])

def get_log_file():
    """Ensure the log directory exists and return an open file handle."""
    log_dir = os.path.join("scripts", "hooks", "logs")
    os.makedirs(log_dir, exist_ok=True)
    return open(os.path.join(log_dir, "agent_triggers.log"), "a", encoding="utf-8")

def trigger_agent(agent_config, files, log_file):
    """Invoke a specific Gemini subagent in the background."""
    name = agent_config["name"]
    template = agent_config["prompt_template"]
    
    # Format files list for the prompt
    files_list = "\n".join(f"- {f}" for f in files.splitlines())
    prompt = template.format(files_list=files_list)
    
    log_file.write(f"[{datetime.datetime.now()}] Backgrounding @{name}...\n")
    log_file.flush()
    
    # Backgrounding flags
    kwargs = {
        "shell": (os.name == 'nt'),
        "stdout": log_file,
        "stderr": log_file,
        "stdin": subprocess.DEVNULL,
    }
    
    if os.name == 'nt':
        kwargs["creationflags"] = subprocess.DETACHED_PROCESS | subprocess.CREATE_NO_WINDOW
    else:
        kwargs["start_new_session"] = True

    try:
        # Wrap in a shell command to provide log markers
        if os.name == 'nt':
            cmd = f"echo [Agent {name} Start] & gemini -y -p \"{prompt}\" & echo [Agent {name} End]"
        else:
            cmd = f"echo '[Agent {name} Start]' && gemini -y -p '{prompt}' && echo '[Agent {name} End]'"
        
        subprocess.Popen(cmd, **kwargs)
    except Exception as e:
        log_file.write(f"[{datetime.datetime.now()}] ERROR: Failed to launch {name}: {e}\n")
        log_file.flush()

def main():
    parser = argparse.ArgumentParser(description="LogLensAi Agent Trigger Hook")
    parser.add_argument("--agent", help="Trigger a specific agent by name (default: all enabled)")
    args = parser.parse_args()

    files = get_changed_files()
    if not files:
        return

    with get_log_file() as log_file:
        log_file.write(f"\n--- Agent Trigger Launcher: {datetime.datetime.now()} ---\n")
        log_file.write(f"Commit Files: {files.splitlines()}\n")
        log_file.flush()

        for agent_config in AGENTS:
            # Skip if not enabled and no specific agent requested
            if not agent_config["enabled"] and not args.agent:
                continue
            
            # If specific agent requested, skip others
            if args.agent and agent_config["name"] != args.agent:
                continue

            trigger_agent(agent_config, files, log_file)

    print("Agent tasks triggered. Check scripts/hooks/logs/agent_triggers.log for status.")

if __name__ == "__main__":
    main()
