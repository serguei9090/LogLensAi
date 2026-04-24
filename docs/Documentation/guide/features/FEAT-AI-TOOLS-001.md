# FEAT-AI-TOOLS-001: Advanced AI Copilot Tools & Memory

## Phase 1: The Spec

### Description
This feature drastically expands the AI Copilot capabilities in LogLensAi by providing the AI with executable skills, a long-term associative memory system, and deeper context integration with the workspace. It also introduces a "Show Thinking" UI element (similar to Gemini/Ollama structured thought output) and user-facing autocomplete for `/` commands in the chat interface.

### 1. Frontend Requirements (UI/UX)
- **Chat Input Autocomplete (`ChatInput.tsx` / `Autocomplete.tsx`)**:
  - Detect the `/` character to trigger an autocomplete overlay.
  - List available skills (e.g., `/search`, `/memory`, `/context`).
  - Allow the user to manually override or append specific skill commands to the prompt.
- **Thinking Block (`ThinkingBlock.tsx` Refactor)**:
  - Match the provided visual mockup.
  - Render an expandable/collapsible "Show thinking" accordion within AI messages.
  - Display the model's `<think>...</think>` internal process clearly formatted (step-by-step).
- **Settings Panel (`SettingsPanel.tsx`)**:
  - Add a "Skills & Memory" section to enable/disable specific AI tools.
- **Orchestration Hub**:
  - Add a "Workspace Global Context" toggle switch next to fusion controls, allowing the user to dictate whether the AI should automatically ingest the entire workspace state (or just the active tab).

### 2. Backend Requirements (Sidecar / AI Logic)
- **Tool Mapping & Registration (`ai.py` / `mcp_server.py`)**:
  - Expose tools as JSON Schema functions to the AI provider.
  - Implement **Log Search Tool**:
    - `search_logs(query: str, log_type: str, time_range: tuple, source: str = "all")`
    - Capable of querying `DuckDB` iteratively, looking for specific ERRORs, INFOs, timestamps, restricting to the current file or broadcasting to the entire workspace.
- **Memory Subsystem (`memory.py` / `db.py`)**:
  - Create `ai_memory` table in DuckDB to store knowledge graph items or Key-Value "lessons learned".
  - Expose tools:
    - `save_memory(issue_signature: str, resolution: str)`
    - `search_memory(context: str)`
  - Implement a pre-hook where the AI automatically runs `search_memory` based on the user's initial problem description to see if a fix is already known.
- **System Prompt Refactor**:
  - Update the base ADK prompt to instruct the model on when to autonomously trigger tools, save memory, and when to wrap internal reasoning in `<think>` tags.

### 3. Acceptance Criteria
- [ ] Users can type `/` in the chat input and see a popover of available skills.
- [ ] The AI can successfully invoke `search_logs` to filter for specifically requested log levels or time boundaries without the user writing regex or SQL.
- [ ] The AI can invoke `save_memory` when a user confirms a fix, and successfully retrieves it in a subsequent session if asked.
- [ ] The chat UI visually extracts `<think>` blocks into the "Show thinking" collapsible accordion, presenting the final output below it.
- [ ] The "Workspace Global Context" toggle successfully alters the system prompt's injected file context.

---

### Phase 2: Approval
Please review this specification. Let me know if you would like any modifications before we proceed to **Phase 3 (Ticketing/Planning)**.
