# Antigravity Workflow Commands Plan

## Objective
Create a 1:1 mapping of all Antigravity Markdown workflows located in `.agents/workflows/` to executable Gemini CLI commands in `.gemini/commands/`. This will allow developers to trigger specific, standardized processes (e.g., `/dev:feature "Build login page"`) directly from the CLI.

## Key Components

1. **Mapping Structure**:
   - Source: `.agents/workflows/<category>/<workflow_name>.md`
   - Destination: `.gemini/commands/<category>/<workflow_name>.toml`
   - Command Trigger: `/<category>:<workflow_name>` (e.g., `/audits:project-audit`)

2. **Command Payload Design (Dynamic Injection)**:
   Each generated `.toml` command file will use the `@{path}` dynamic injection feature. This ensures the command always runs the latest version of the markdown workflow without needing manual updates.
   
   **Template**:
   ```toml
   description = "Executes the <workflow_name> workflow."
   prompt = """
   You are executing an Antigravity workflow. Follow the instructions provided in the workflow definition strictly.
   
   ### Workflow Definition
   @{I:\\01-Master_Code\\Apps\\LogLensAi\\.agents\\workflows\\<category>\\<workflow_name>.md}
   
   ### Task Arguments
   {{args}}
   
   Execute the workflow for the provided arguments.
   """
   ```

## Implementation Steps
1. **Analyze Source Directory**: Use the `list_directory` tool to enumerate all categories (e.g., `dev`, `audits`, `ops`) and the markdown files within them under `.agents/workflows/`.
2. **Create Command Directories**: Ensure the corresponding category directories exist under `.gemini/commands/`.
3. **Generate `.toml` Files**: Iterate through the identified workflows and write the templated `.toml` files to their respective locations in `.gemini/commands/`.
4. **Verification**: Run `ls -R .gemini/commands` to ensure the structure matches `.agents/workflows` and manually inspect one generated `.toml` file.
