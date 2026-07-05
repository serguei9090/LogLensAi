# LogLensAi — Current Feature Inventory

A factual, exhaustive list of features and capabilities currently implemented in LogLensAi. No migration guidance is included — this is purely a record of what the application does today.

---

## 1. Log Ingestion

### 1.1 Local File Ingestion
- Accepts any local file path and reads it line-by-line in chunks
- Tracks progress in lines processed vs total lines
- Jobs are queued in a serial worker so multiple files are processed one at a time
- On crash or restart, interrupted jobs are automatically detected and re-queued from the beginning (clean resume)
- Duplicate cluster constraint errors are handled gracefully mid-ingestion

### 1.2 Live File Tailing
- Monitors a growing local log file and continuously appends new lines
- Polling-based tail that detects new content without file locking
- Tailing can be started and stopped independently per source

### 1.3 SSH Remote Tailing
- Opens an SSH connection to a remote server
- Executes `tail -f` on a remote log file path
- Streams new lines back into the workspace in real time
- Supports username/password authentication

### 1.4 UDP Syslog Listener
- Binds a configurable UDP port to receive syslog packets
- Routes incoming log lines to a named workspace and source
- Can be enabled or disabled globally in settings

### 1.5 HTTP Push Ingestion
- Exposes a local HTTP endpoint (`POST /ingest/{workspace}/{source}`) for log shippers
- Accepts raw newline-delimited log batches
- Port is configurable in settings

### 1.6 Manual Log Paste
- User can paste raw log text directly into the UI
- Processed and stored identically to file ingestion

### 1.7 Ingestion Job Queue
- All file ingestion jobs are serialized (one active job at a time per app instance)
- Job status is tracked: `queued`, `pending`, `processing`, `completed`, `failed`
- Queue position is surfaced to the UI per source
- Failed jobs are marked and not retried automatically

---

## 2. Log Processing & Parsing

### 2.1 Multi-line Log Detection
- Detects when a new log entry starts vs continuation lines (e.g. stack traces)
- Uses heuristic regex patterns on timestamps and known prefixes

### 2.2 Timestamp Extraction
- Extracts and normalizes timestamps from raw log text
- Supports a wide range of datetime formats
- Falls back to ingestion timestamp when no timestamp is found

### 2.3 Log Level Detection
- Detects standard log levels: `DEBUG`, `INFO`, `WARN`, `WARNING`, `ERROR`, `FATAL`, `CRITICAL`, `TRACE`
- Normalization maps aliases (e.g. `WARNING` → `WARN`)
- Level stored as structured field per log row

### 2.4 Facet Extraction
- Custom named capture groups via user-defined regex patterns
- Extracted facet values are stored as a JSON map per log row
- Facets are surfaced as filterable fields in queries

### 2.5 AI-Assisted Facet Regex Generation
- User selects text from a log line in the UI
- AI generates a regex pattern that captures that field automatically
- Regex is saved and applied to all subsequent ingestion

### 2.6 Per-Source Parser Configuration
- Each log source can have a custom parser configuration
- Parser config stores per-source regex overrides and timestamp format hints

### 2.7 Raw Log Storage
- Raw log text is stored separately from metadata on disk (one flat file per source)
- DuckDB stores only pointers (line offsets) rather than duplicating raw text
- Raw content is hydrated on read via memory-mapped fast-path reads

---

## 3. Log Clustering (Drain3 Algorithm)

### 3.1 Template Mining
- Drain3 algorithm mines recurring patterns from log messages in real time
- Variable tokens (IPs, IDs, numbers) are replaced with `<*>` wildcards
- Each unique template is assigned a stable cluster ID

### 3.2 Cluster Assignment
- Every ingested log line is assigned a cluster ID at write time
- Cluster IDs are stored as a structured field per log row for fast filtering

### 3.3 Cluster Modes
- **Auto**: Clustering runs continuously as new logs arrive
- **Manual**: Clustering paused; user triggers clustering on demand
- **Burst**: Clustering runs in a single high-throughput pass
- Mode is configurable per session and persisted in settings

### 3.4 Cluster Worker
- Dedicated background thread pulls unclustered logs in batches
- Processes at over 80,000 lines/second single-threaded
- Backlog size and current mode exposed via status API

### 3.5 Drain3 Configuration
- Maximum number of clusters (`max_clusters`)
- Similarity threshold for template matching
- Prefix tree depth setting
- Variable masking patterns (e.g. mask IPs, UUIDs before clustering)
- Template scope: global (shared across all sources) or per-workspace
- Drain3 template state is persisted to disk and reloaded on startup

### 3.6 Pattern Cache Reset
- User can wipe all Drain3 learned templates for a workspace or globally
- Triggers re-clustering of all existing logs

---

## 4. Log Querying & Filtering

### 4.1 LLQL — Log Lens Query Language
- Custom query syntax that maps to structured SQL queries
- Supports field-specific searches: `level:ERROR`, `message:timeout`
- Supports boolean operators: `AND`, `OR`, `NOT`
- Supports wildcard and phrase matching
- Parsed on the backend into DuckDB SQL

### 4.2 Structured Filters
- Filter by: log level, cluster ID, source ID, custom facets, has comment
- Operators: `contains`, `not_contains`, `equals`, `not_equals`, `starts_with`, `regex`
- Multiple filters on the same field are combined with OR; different fields with AND

### 4.3 Time-Range Filtering
- Filter logs to a specific start and end timestamp
- Time ranges are applied server-side before pagination
- Preset ranges: Last 15 min, 1 hour, 6 hours, 24 hours, 7 days, All Time

### 4.4 Sort Controls
- Sort by: timestamp, ID, log level
- Sort direction: ascending or descending

### 4.5 Paginated Retrieval
- Offset-based pagination with configurable page size
- Total log count returned with each response
- Infinite-scroll load-more in the UI (loads next page automatically on scroll)

### 4.6 Facet Counts
- Returns top values and counts for each facet field in the current result set
- Used to populate filter panels without a full table scan

---

## 5. Log Fusion (Multi-Source Merge)

### 5.1 Chronological Merge
- Multiple log sources can be fused into a single chronologically interleaved view
- Each source contributes its logs with its own temporal offset applied

### 5.2 Temporal Offsets
- Each source can have a time-shift offset to align clocks between servers
- Offsets are stored per source in the database
- Adjustable in the UI per source

### 5.3 Fusion Configuration
- User selects which sources to include in the fused view
- Per-source weights or priorities are configurable

---

## 6. Dashboard & Analytics

### 6.1 Log Volume Over Time
- Time-series chart of log line counts bucketed automatically by time interval
- Interval is dynamically chosen based on the selected time range (1 sec → 30 days)

### 6.2 Log Level Distribution
- Breakdown of log counts by level (pie/bar chart)

### 6.3 Top Clusters
- Ranked list of the most active Drain3 clusters by volume

### 6.4 Error Rate Trends
- Tracks rate of ERROR/FATAL logs over time

### 6.5 Log Distribution Query
- Backend query that computes time-bucketed log counts with level breakdown
- Used by the dashboard charts

---

## 7. Anomaly Detection

### 7.1 Automated Anomaly Scoring
- Background detector runs continuously against clustered log data
- Detects unusual spikes in cluster frequency or error levels
- Assigns an anomaly score to clusters that deviate from baseline

### 7.2 Anomaly Surfacing
- Anomalous clusters are flagged in the log table and cluster list
- Users can view the top anomalous clusters for a workspace

---

## 8. Workspace & Source Management

### 8.1 Multiple Workspaces
- Unlimited named workspaces, each with isolated storage and settings
- Workspaces are switched without data loss

### 8.2 Folder Hierarchy
- Folders can be created inside a workspace to organize sources
- Nested folder structures supported
- Folders can be renamed, moved, and deleted

### 8.3 Log Sources
- Each source has: name, type, path/connection details
- Sources can be renamed, moved between folders, and deleted
- Deleting a source removes its logs and storage files
- Sources track `is_uploaded` state (whether ingestion has completed)

### 8.4 Workspace Deletion
- Deletes all database records and physical storage for a workspace
- Automatically stops any active tailers for that workspace

### 8.5 Inactive Workspace Purge
- Batch operation to purge workspaces that have no recent activity

---

## 9. AI Diagnostic Features

### 9.1 Conversational AI Sessions
- Persistent chat sessions where the user converses with the AI about their logs
- Each session has a name (auto-generated or user-renamed)
- Session history is stored in SQLite and survives restarts

### 9.2 Multiple AI Sessions
- Multiple independent chat sessions can exist per workspace
- Sessions can be listed, renamed, and deleted

### 9.3 AI Provider Support
- **Ollama** — local self-hosted models (Llama, Gemma, Mistral, etc.)
- **Google Gemini** — cloud API with API key
- **OpenAI** — cloud API with API key
- Provider is switchable in settings without restarting

### 9.4 AI Model Selection
- Dynamically lists available models from the configured provider
- User selects a specific model version per provider

### 9.5 Cluster Root Cause Analysis
- User selects a specific Drain3 cluster from the UI
- AI receives the cluster template, a sample of matching log lines, and surrounding context
- Returns a structured analysis: human-readable summary, root cause hypothesis, recommended actions

### 9.6 Smart Context Injection
- Relevant log lines surrounding an error or query are automatically selected and trimmed to fit within the AI's token budget
- Context window is managed dynamically to avoid truncation

### 9.7 AI Memory (RAG)
- Users and AI can save named memory entries (diagnostics, runbooks, known issues)
- Memories are indexed and semantically searchable
- Relevant memories are auto-injected into AI prompts

### 9.8 AI-Assisted Regex Generation
- AI generates facet extraction regex patterns from a selected log sample

### 9.9 LangGraph State Machine
- AI interactions run through a graph-based state machine for structured reasoning
- Supports tool calls within the AI loop (querying logs, fetching clusters, retrieving memory)
- Streaming responses are pushed to the UI incrementally

### 9.10 AI Session Mapping
- Maps AI session IDs to source IDs so the AI has context about which log source is being discussed

---

## 10. Log Table UI Features

### 10.1 Virtualized Log Table
- Renders millions of log rows at native speed using virtual scrolling
- Only visible rows are in the DOM at any time

### 10.2 Expandable Row Detail
- Click any log row to expand it and see the full raw message and all metadata fields

### 10.3 Multi-Row Selection
- Select individual rows, shift-click for range selection, ctrl/cmd-click for additive selection

### 10.4 Column Management
- Toggle visibility of individual columns
- Resize columns by dragging
- Column order is persisted per session

### 10.5 Highlight Rules
- User defines keyword or regex patterns with associated colors
- Matching rows are visually highlighted in the table

### 10.6 Text Selection → Filter / Facet
- User can select text within a log message
- Toolbar appears offering: add as filter, add as exact facet, add as AI-generated facet

### 10.7 Log Comments
- User can add a plain-text comment to any individual log row
- Comments are stored in the database and displayed inline

### 10.8 Ingestion Overlay
- While a log file is being indexed, the log table shows a progress overlay
- Displays lines processed vs total, percentage, and a progress bar
- Queue position shown when the file is waiting behind another active ingestion

### 10.9 Auto-Scroll (Tailing Mode)
- While live tailing is active, the table automatically scrolls to the latest row

---

## 11. Log Export & Deletion

### 11.1 Log Export
- Export currently filtered log rows to a downloadable file
- Applies all active filters, time range, and query to the export

### 11.2 Log Deletion
- Delete log rows for a workspace or a specific source
- Applies filters optionally to delete a subset of rows

### 11.3 Raw File Viewer
- Read and display the original raw content of a local log file as plain text

---

## 12. MCP Server (Model Context Protocol)

- Optionally starts a FastMCP SSE server on a configurable port
- Exposes sidecar capabilities as MCP tools to external AI agents and IDE integrations
- Enable/disable via settings; starts in a background daemon thread

---

## 13. Application Settings

### 13.1 AI Provider Settings
- Provider (Ollama / Gemini / OpenAI)
- API key
- Model selection
- System prompt override
- Temperature

### 13.2 Drain3 Settings
- Max clusters
- Similarity threshold
- Tree depth
- Variable masking patterns
- Template scope (global / per-workspace)

### 13.3 Custom Facet Extractions
- List of named regex patterns for custom field extraction
- Enable/disable per facet
- Order is preserved

### 13.4 Ingestion Port Settings
- Syslog UDP port
- HTTP push port
- Enable/disable each listener independently

### 13.5 MCP Server Settings
- Enable/disable MCP server
- MCP server port

### 13.6 Reset & Maintenance
- **Reset to Defaults**: Resets all settings to factory defaults
- **Reset Pattern Cache**: Wipes all Drain3 learned templates
- **Factory Reset**: Deletes all data (DuckDB, SQLite, storage files, drain state) and re-initializes the application from scratch
