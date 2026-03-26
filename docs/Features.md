# LogLensAi — Feature Definitions

> This document serves to define all the core features and advanced capabilities of the LogLensAi application.

---

## 1. Multi-Workspace Architecture
- **Concept**: A unified container structure allowing users to manage multiple, disparate log sources simultaneously without closing the app.
- **Features**:
   - Sidebar with a collapsible list of Active Workspaces.
   - Independent DuckDB context per workspace (queries are strictly scoped via `workspace_id`).
   - Create, Rename, and Delete functionality for workspaces.

## 2. Ingestion & Tailing (The Feed)
- **Concept**: The mechanisms by which LogLensAi consumes data and pipes it into the python sidecar.
- **Features**:
  - **Local Ingestion**: Load historical log files (`.log`, `.txt`) directly from the host machine.
  - **Live Tailing**: Toggle a "Tail" switch to keep the file open and stream new lines into the log view automatically.
  - **SSH Remote Tailing**: Connect securely to remote servers via SSH (Host, User, Port, Password/Key) to tail logs without downloading them manually.
  - **Manual Paste**: A simple raw text area to paste temporary log snippets for instantaneous parsing.

### 3. The "Investigation" View (Core)
- **Concept**: The central analysis page tailored for highly efficient reading and searching of massive log files.
- **Features**:
  - **Multi-Line Wrapping**: Support for a "Wrap" toggle in the toolbar. When enabled, long messages wrap and expand the row height; when disabled, they truncate with `...`.
  - **TanStack Virtualized Grid**: Render 1+ million rows seamlessly without crashing the DOM.
  - **Level Highlighting**: Logs are color-coded (Error = Red, Info = Blue, Debug = Purple) based on the strict theme palette.
  - **Log Row Annotations (Comments)**: Users can click a "Comment" icon on any log row to add sticky notes stored in the `LogAnnotations` DuckDB table.
  - **Log Toolbar**: A single, sticky command bar containing Search, Filters, and Highlights.

## 4. Advanced Search & Filtering
- **Concept**: Complex querying capabilities layered on top of the DuckDB storage engine.
- **Features**:
  - **Debounced Text Search**: Real-time regex and `ILIKE` searches against the `raw_text` field.
  - **Filter Builder**: A dedicated popover to define multi-conditional rules:
    - Target fields: `level`, `source_id`, `cluster_id`, `raw_text`, `has_comment`.
    - Logical operators: `=`, `!=`, `contains`, `not contains`, `starts with`.
    - Stackable: Construct logic like `level = ERROR AND has_comment = true` to isolate annotated issues.
  - **Highlight Builder**: Allows users to input persistent keywords and assign them a specific background color scheme from the theme. Whenever that keyword appears in a log, it acts like a visual marker.

## 5. Drain3 Log Clustering & AI Diagnostics
- **Concept**: Leveraging machine learning to reduce log noise and determine root causality.
- **Features**:
  - **Real-time Clustering**: As logs digest, the sidecar pipes them through `Drain3`, extracting templates replacing variable endpoints (e.g., `Failed password for * from *`).
  - **AI Problem Resolution (The Diagnostic Sheet)**: By clicking on a defined log cluster, users can invoke the local `gemini-cli`. The AI results open in a dedicated right-side **Diagnostic Sheet** (sidebar):
     - `summary`: High-level explanation of the cluster.
     - `root_cause`: The theorized backend failure.
     - `actions`: A bulleted list of remediation steps.

## 6. Granular Settings & Control
- **Concept**: Fine-tuning application logic and AI behavior to suit project-specific diagnostics.
- **Features**:
  - **Retractable Sections**: All settings are grouped into **Collapsible Cards** (AI Provider, Drain3, General) for a clean, modular UX.
  - **AI System Prompt**: A text area field in the AI section allowing users to customize the instructions sent to the model.
    - **Default Prompt**: A specialized "Log Analysis Specialist" prompt defining roles, target diagnostic outputs (summary, cause, actions), and log context awareness.
  - **Drain3 Knobs**: Expose the inner workings of clustering (`Similarity Threshold`, `Max Children`) with helpful tooltips.
  - **AI Provider Toggle**: A dropdown to specify the backend (OpenAI, Anthropic), with `gemini-cli` set as the local default.
  - **Viewing Comfort**: Controls for Log Row height (compact/comfortable) and global monospace font sizes.

---

## 🔵 Future Backlog (Post-MVP)
- **Dashboarding**: A "Bird's-Eye" view calculating metric spikes across 15m intervals utilizing Lucide Icons.
- **Annotated Logging**: Attaching persistent sticky-notes directly to specific log rows.
- **Chrono-Merge**: Splicing two separate log feeds together, interleaved linearly by their timestamps.
