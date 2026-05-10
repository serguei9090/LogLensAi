# Backend Function Reference: LogLensAi

## `api.py` — Main Application & JSON-RPC Dispatch

### Application Class (`App`)
- `__init__(...)` — Initializes the application singleton, creating the database, log store, parsers, AI provider, ingestion server, anomaly detector, clustering worker, and hybrid runner
- `_init_ai_provider(settings)` — Initializes the AI provider using the factory based on settings
- `method_get_ingestion_jobs(workspace_id)` — Fetch all ingestion jobs for a workspace
- `method_get_clustering_status(_workspace_id)` — Fetch current clustering worker status and backlog
- `method_set_clustering_mode(mode, _workspace_id)` — Set clustering worker mode (auto, manual, burst)
- `method_set_clustering_paused(paused, _workspace_id)` — Explicitly pause or resume the clustering worker
- `method_delete_logs(workspace_id, source_id)` — Delete logs for a workspace or specific source
- `method_factory_reset()` — Total wipe of all backend persistent state (DB, AI state, Drain clusters)
- `_start_mcp_server()` — Starts the MCP server in a background thread using FastMCP SSE
- `_stop_mcp_server()` — Signals the MCP server to shut down
- `stop_async()` — Async version of stop to handle async components
- `stop()` — Gracefully shut down all background components
- `dispatch(req)` — Main JSON-RPC request dispatcher that routes to method handlers
- `_parse_filters(filters)` — Maps filter entries to SQL WHERE clauses and parameters
- `_build_filter_clause(field, op, value)` — Maps filter operators to SQL clauses and parameters
- `_build_logs_where_clause(...)` — Constructs the WHERE clause and parameters for log queries
- `_hydrate_log(log_dict)` — Fetch raw log content for a single log dictionary using the Fast-Path mmap service
- `_get_logs_internal(...)` — Unified internal log fetcher with temporal offset calibration
- `_build_distribution_where_clause(params)` — Constructs the WHERE clause and parameters for log distribution queries
- `_apply_temporal_offsets(workspace_id, logs)` — Apply global temporal offsets to a list of logs
- `method_get_logs(**kwargs)` — Fetch logs normally for a workspace/source
- `method_export_logs(**kwargs)` — Export matching logs to a file (CSV or JSON)
- `method_get_log_distribution(**kwargs)` — Fetch timeline distribution of logs aggregated by time bucket and level
- `method_get_anomalies(workspace_id, time_range)` — Fetch recently detected cluster anomalies from the database
- `method_get_fused_logs(**kwargs)` — Fetch interleaved logs for Fusion mode based on enabled sources with Timezone normalization
- `method_update_fusion_config(**kwargs)` — Save source orchestration settings (Enabled toggles, Timezones)
- `method_get_sample_lines(workspace_id, source_id, limit)` — Fetch raw lines from a source to help a user define a pattern
- `method_update_source_parser(workspace_id, source_id, parser_config)` — Update the regex/pattern configuration for a specific log source
- `method_get_log_content(**kwargs)` — Fetch raw log content for a list of line_ids (O(1) mmap)
- `method_get_fusion_config(**kwargs)` — Retrieve current Fusion orchestration setup
- `method_start_tail(filepath, workspace_id, source_id)` — Start live tailing of a local file for a workspace
- `method_start_ssh_tail(...)` — Start live tailing of a remote file over SSH
- `_stop_all_workspace_tailers(workspace_id)` — Internal helper to stop all tailers for a workspace
- `method_stop_tail(filepath, workspace_id, source_id)` — Stop one or all live stream tailers for a workspace
- `method_read_file(filepath)` — Reads the full content of a local file
- `_ingest_single_log(_cursor, log, custom_rules)` — Extracts clustering logic into a reusable helper
- `method_ingest_logs(logs)` — High-speed batch ingestion — Disk-First / Fast-Path
- `_bg_ingest_logs(workspace_id, source_id, logs, job_id)` — Background worker for batch ingestion
- `method_ingest_local_file(workspace_id, source_id, filepath)` — Optimised ingestion — Disk-First / Fast-Path
- `_bg_ingest_local_file(workspace_id, source_id, filepath, job_id)` — Background worker for local file ingestion

---

## `db.py` — Database Layer & Schema Management

### LogDatabase Class
- `__new__(db_path)` — Singleton factory that creates or returns the database instance
- `_init_db(db_path)` — Initializes the database connection with WAL recovery fallback
- `_create_tables()` — Creates all database tables and indexes
- `_setup_schema(cursor)` — Initial table and sequence creation
- `_run_migrations(cursor)` — Handle schema evolution for existing databases
- `_migrate_fast_path_schema(cursor)` — Migration: upgrade existing logs table to the Skinny / Fast-Path schema
- `_migrate_ingestion_columns(cursor)` — Adds columns required for asynchronous ingestion and clustering
- `_migrate_ingestion_jobs(cursor)` — Ensures source_id column exists in ingestion_jobs table
- `_migrate_indexes(cursor)` — Ensure all performance indexes exist on legacy databases
- `_migrate_ai_tables(cursor)` — Ensure AI session/message tables have latest columns
- `_migrate_fusion_pk(cursor)` — Migration for fusion_configs primary key
- `_migrate_fusion_time_shift(cursor)` — Adds time_shift_seconds to fusion_configs
- `_migrate_log_columns(cursor)` — Ensures log columns exist and sequences are created
- `_migrate_log_facets(cursor)` — Adds facets column to logs table
- `_initialize_cluster_cache(cursor)` — Initializes the clusters cache from existing logs
- `get_cursor()` — Returns a new cursor from the database connection
- `commit()` — Commits pending transactions to the database
- `reset()` — Class method to reset the database singleton instance
- `_get_filter_condition(field, op, value)` — Maps operator to SQL condition and parameter
- `_parse_filters(filters)` — Parses filter list into SQL WHERE clauses
- `_apply_temporal_offsets(workspace_id, logs)` — Apply global temporal offsets to a list of logs
- `_build_where_clauses(...)` — Constructs WHERE clauses and gathers parameters
- `_process_log_results(cursor)` — Converts raw cursor rows to a list of dicts with JSON parsing
- `query_logs(...)` — Main query interface for fetching logs with filtering and sorting
- `_get_facet_keys(workspace_id)` — Resolve priority and custom facet keys from settings
- `_get_facet_aggregations(workspace_id, keys, source_ids)` — Query top 10 unique values for each facet key
- `get_metadata_facets(workspace_id, source_ids)` — Return the top unique metadata facets across all logs in a workspace
- `delete_logs(workspace_id, source_id)` — Delete logs for a workspace. Optionally filter by source_id
- `create_folder(workspace_id, folder_id, name, parent_id)` — Create a folder in the hierarchy
- `update_folder(folder_id, name, parent_id)` — Update folder metadata
- `_get_all_subfolder_ids(folder_id)` — Recursively fetch all child folder IDs
- `delete_folder(folder_id)` — Delete a folder and promote its children to root
- `upsert_log_source(workspace_id, source_id, name, type, path, folder_id)` — Upsert (insert or update) a log source
- `update_log_source(source_id, **kwargs)` — Update log source fields dynamically
- `delete_log_source(source_id)` — Delete a log source and its associated logs
- `get_hierarchy(workspace_id)` — Returns the tree structure for a workspace
- `create_ingestion_job(workspace_id, source_id, total_lines)` — Create an ingestion job record
- `update_ingestion_progress(job_id, processed_lines, status)` — Update ingestion job progress
- `get_ingestion_jobs(workspace_id)` — Fetch all ingestion jobs for a workspace

---

## `parser.py` — Drain3 Pattern Clustering

### DrainParser Class
- `__init__(persistence_path, sim_th, max_children, max_clusters, masking_instructions)` — Initialize the Drain3 parser with configuration and persistence
- `_apply_masking_instructions(masking_instructions)` — Apply regex masking instructions to prevent false clusters
- `parse(log_line)` — Returns a dict with cluster_id and template for the given log line
- `get_clusters()` — Return list of clusters for easier consumption
- `save()` — Forces a state save if persistence is enabled

---

## `tailer.py` — File Tailing System

### FileTailer Class
- `__init__(filepath, workspace_id, parser, db, log_store, source_id)` — Initialize a workspace-specific subscriber to a SharedSource
- `running` property — Returns True if currently subscribed to a shared source
- `start()` — Subscribe to the shared source
- `stop()` — Unsubscribe from the shared source
- `_process_line_callback(line, line_id)` — Callback from SharedSource when a new line is detected
- `_process_line(line, line_id)` — Process a new log line: extract metadata and insert into database
- `_get_parser_config()` — Fetches and caches parser configuration for the source
- `_get_rules()` — Fetches custom facet extraction rules (global and workspace-specific)

---

## `ssh_loader.py` — SSH Remote Tailing

### SSHLoader Class
- `__init__(host, port, username, password, filepath, log_store, source_id)` — Initialize SSH connection and loader
- `start()` — Start the SSH tailing thread
- `_tail_loop()` — Main loop that tails a remote file over SSH and pushes lines to a SharedSource
- `stop()` — Stop the SSH loader and close connection

---

## `services/shared_core.py` — Shared Source Management

### SharedSource Class
- `__init__(source_id, filepath, log_store)` — Initialize a shared source for a single log file
- `subscribe(callback)` — Subscribe to new log lines
- `unsubscribe(callback)` — Unsubscribe from updates
- `_start_tailing()` — Start the background tailing thread
- `_stop_tailing()` — Stop the background tailing thread
- `cleanup()` — Final cleanup when source is removed
- `_run_tail()` — Background thread that tails a physical file line-by-line
- `push_line(line)` — Manually push a line into the shared source
- `push_batch(lines, line_ids)` — Broadcast a batch of lines that were already persisted to disk
- `_handle_new_line(line)` — Update the log store and broadcast to all active workspace subscribers

### SharedSourceManager Class
- `__new__(...)` — Singleton factory for SharedSource instances
- `__init__(log_store)` — Initialize the manager
- `get_source(source_id, filepath)` — Get or create a shared source for the given file
- `cleanup()` — Shutdown all active tailers

---

## `services/fast_path.py` — High-Performance Log Access

### MappedSource Class
- `__init__(log_path, idx_path)` — Initialize mmap objects for log and index files
- `_ensure_mapped()` — Lazy initialization of mmap objects with size caching
- `get_line(line_id)` — Fetch a single log line by its line_id using mmap
- `close()` — Close all mmap objects and file handles

### FastPathService Class
- `__init__(storage_dir, log_store)` — Initialize the singleton service
- `get_line(source_id, line_id)` — Fetch a single log line from a source
- `get_lines(source_id, line_ids)` — Fetch multiple log lines from a source
- `_get_source(source_id)` — Get or create a MappedSource for the given source_id
- `close_all()` — Close all mapped sources

---

## `services/log_file_store.py` — Disk-First Ingestion Layer

### SourceFileHandle Class
- `__init__(path, idx_path, existing_count)` — Initialize file handles for log and index files
- `write_line(raw)` — Append a single line and return its 0-based line_id
- `write_batch(raws)` — Append multiple lines and return their line_ids
- `close()` — Close both file handles
- `__del__()` — Cleanup on object destruction

### DiskLogStore Class
- `__init__(storage_dir)` — Initialize the storage manager
- `append_line(source_id, raw)` — Append a single line to a source
- `append_batch(source_id, raws)` — Append multiple lines to a source
- `get_hot_buffer(source_id)` — Returns the current Hot RAM Buffer for a source
- `file_path(source_id)` — Returns the full path to the log file for a source
- `get_lock(source_id)` — Returns the threading.Lock for a specific source for external sync
- `index_path(source_id)` — Returns the full path to the index file for a source
- `close_all()` — Close all file handles
- `get_handle(source_id)` — Public access to the source handle
- `_get_handle(source_id)` — Get or create a SourceFileHandle for the given source_id
- `_ensure_index(path, idx_path)` — Validates the index file or rebuilds it if missing/corrupt
- `_validate_index(path, idx_path, log_size)` — Checks if the index file is consistent with the log file
- `_rebuild_index(path, idx_path, resume_from, initial_count)` — Rebuilds the index file from the log file
- `_process_index_chunk(chunk, lf, idx, count)` — Scan chunk for newlines and write offsets to index

---

## `metadata_extractor.py` — Log Metadata Extraction

### Helper Functions
- `_get_timestamp_from_match(match, tz_offset)` — Extracts and normalizes timestamp from a regex match
- `_extract_base_metadata(raw_line, parser_config, tz_offset)` — Extracts timestamp, level, and message using provided configuration
- `_extract_heuristic_facets(raw_line)` — Extracts common facets using generic heuristics (IPs, UUIDs, methods, etc.)
- `_extract_context_facets(raw_line, facets)` — Extracts host, thread, logger information
- `_extract_kv_facets(raw_line, facets)` — Extracts general key=value pairs
- `_apply_custom_extractions(raw_line, custom_rules, facets)` — Applies user-defined regex extraction rules
- `_apply_single_custom_rule(raw_line, rule, facets)` — Applies a single custom extraction rule
- `extract_log_metadata(raw_line, custom_rules, parser_config, tz_offset)` — Main extraction function that applies all metadata extraction methods

---

## `workers/clustering.py` — Background Clustering Worker

### ClusteringWorker Class
- `__init__(app_instance, batch_size, interval)` — Initialize the background clustering worker
- `start()` — Start the clustering worker thread
- `stop()` — Stop the clustering worker thread
- `_run()` — Main worker loop that processes logs for Drain3 clustering
- `_hydrate_log_text(source_id, line_id, raw_text, now)` — Hydrates log text from fast_path if missing, handling quarantine
- `_get_parser_config(cursor, ws_id, source_id, parser_configs)` — Fetches and caches parser configuration
- `_process_batch(batch_size)` — Process a batch of unprocessed logs for clustering
- `_apply_batch_updates(cursor, updates, cluster_increments)` — Applies batch updates to logs and clusters tables
- `_update_ingestion_jobs(cursor, batch_counts)` — Updates ingestion job progress
- `_sync_job_statuses()` — Forcefully syncs ingestion job statuses when the worker is idle
- `_get_global_rules(cursor)` — Helper to fetch global extraction rules
- `get_status()` — Returns the current status of the clustering worker
- `set_mode(mode)` — Changes the operational mode of the worker
- `set_paused(paused)` — Explicitly pause or resume the worker
- `trigger_cycle()` — Manually trigger a single processing cycle

---

## `anomalies.py` — Volume Anomaly Detection

### AnomalyDetector Class
- `__init__(db, interval_seconds)` — Initialize the anomaly detector
- `start()` — Start the anomaly detection background worker
- `stop()` — Stop the anomaly detection worker
- `_run()` — Main loop that runs anomaly detection at the configured interval
- `detect_anomalies()` — Calculates cluster frequency and flags anomalies using Z-score
- `get_last_anomalies()` — Returns the list of anomalies detected in the last cycle

---

## `ingestion.py` — Live Ingestion Servers

### IngestionServer Class
- `__init__(app, syslog_port, http_port, syslog_enabled, http_enabled)` — Initialize the ingestion server
- `start()` — Start the syslog and HTTP listeners
- `stop()` — Stop all listeners
- `reconfigure(syslog_enabled, syslog_port, http_enabled, http_port)` — Dynamic restart if settings changed
- `refresh_streams()` — Fetch all active routing rules from the DB
- `_run_syslog()` — Background thread that listens for incoming logs via Syslog (UDP)
- `_run_http()` — Background thread that listens for incoming logs via HTTP (TCP)

---

## `query_parser.py` — LLQL Query Parser

### Parser Classes
- `ParseError(Exception)` — Custom exception for parsing errors
- `Node` — Abstract base class for query nodes
- `FieldNode(field, operator, value)` — Represents a field comparison node
- `RangeNode(field, start, end, inclusive_start, inclusive_end)` — Represents a range comparison node
- `SearchNode(term)` — Represents a text search node
- `AndNode(left, right)` — Represents a logical AND node
- `OrNode(left, right)` — Represents a logical OR node
- `NotNode(operand)` — Represents a logical NOT node
- `LLQLParser(query)` — Main parser that tokenizes and parses LLQL queries
- `parse_llql(query)` — Entry point for parsing LLQL queries into SQL

---

## `ai/base.py` — AI Provider Interface

### AIChatMessage Class
- `role` — 'user' | 'assistant' | 'system'
- `content` — The message content
- `context_logs` — Optional list of log IDs to include as context
- `timestamp` — Optional timestamp
- `provider_session_id` — Optional provider-specific session ID

### AIProvider (ABC)
- `__init__(api_key, system_prompt)` — Initialize the provider
- `list_models()` — Abstract method to fetch available models
- `chat(messages, model, session_id, provider_session_id, **kwargs)` — Abstract method to execute a chat session
- `chat_stream(messages, model, session_id, provider_session_id, **kwargs)` — Abstract method for streaming chat
- `analyze_logs(template, samples)` — Abstract method for one-off diagnostic analysis
- `test_connection()` — Abstract method to verify credentials and connectivity

---

## `ai/graph.py` — LangGraph State Machine

### MissionState TypedDict
- `workspace_id` — The workspace ID for the investigation
- `session_id` — The AI session ID
- `messages` — List of chat messages
- `model` — The model being used
- `reasoning` — Whether to enforce deep reasoning
- `next_node` — The next node to execute
- `status` — Current status of the investigation
- `metadata` — Additional metadata

### GraphManager Class
- `__init__(provider, tool_registry, db_path)` — Initialize the graph manager
- `initialize()` — Asynchronously initialize the graph and its checkpointer
- `close()` — Cleanly close the checkpointer
- `_build_graph()` — Constructs the LangGraph workflow
- `_node_reasoning(state)` — Node for AI reasoning and decision making
- `_node_tool_execution(state)` — Node for executing tools based on AI decision
- `_node_final_answer(state)` — Node for summarizing the findings
- `_should_continue(state)` — Edge logic to decide if more tool calls are needed
- `run(config, initial_state)` — Execute the graph

---

## `ai/runner.py` — Hybrid AI Orstration Runner

### HybridRunner Class
- `__init__(app_instance, provider, db_path)` — Initialize the hybrid runner with graph and tool registry
- `run_investigation(workspace_id, session_id, user_message, history, model, reasoning)` — Runs the LangGraph investigation and yields A2UI-compatible events

---

## `ai/tools.py` — AI Tool Registry

### ToolRegistry Class
- `__init__(app_instance)` — Initialize the tool registry
- `search_logs(ctx, params)` — Search and filter logs in the workspace
- `get_clusters(ctx, workspace_id)` — Get the top log clusters/patterns for a workspace
- `search_memory(ctx, workspace_id, query)` — Search the collective memory for similar issues and resolutions
- `get_facets(ctx, workspace_id)` — Get top unique metadata facets (IPs, users, etc.) for a workspace
- `get_hierarchy(ctx, workspace_id)` — Get the folder and source hierarchy for a workspace

---

## `ai/reasoning.py` — Backward-Compatibility Shim

### Helper Functions
- `parse_reasoning_blocks(text)` — Normalise any raw thinking markers in *text* into <think> tags
- `extract_thinking_content(text)` — Separates thinking content from the final response

---

## `ai/context.py` — Smart Context Manager

### SmartContextManager Class
- `filter_logs(logs, keep_levels)` — Filter logs to keep only specified log levels
- `summarize_logs(logs, threshold)` — Summarize logs with cluster deduplication
- `prepare_log_context(logs, max_tokens, keep_levels)` — Prepare a log context string for AI, respecting token limits

---

## `ai/thinking_parser.py` — Unified Thinking / Reasoning Stream Parser

### ThinkingMode Enum
- `NONE` — Model has no thinking/reasoning capability
- `CHANNEL_MARKERS` — Gemma 4 style: channel-switching tokens injected into the content stream
- `STANDARD_TAGS` — Model wraps reasoning in <think>…</think> tags inside the content field
- `GPT_O_SERIES` — OpenAI o1/o3/o4-mini: three-state thinking — thinking_tokens, summary, and output are separate fields

### Utility Functions
- `detect_thinking_mode(model_name)` — Return the ThinkingMode for a model name
- `clean_thinking_markers(text)` — Strip channel-switching markers and <think> blocks from text
- `parse_completed_response(raw, mode)` — Convert a fully accumulated response into <think>…</think>+answer form
- `_parse_channel_marker_response(raw)` — Internal: convert a Gemma 4 channel-marker response to normalised form
- `ThinkingStreamParser(mode)` — Stateful stream parser that emits normalised <think> chunks
- `ThinkingStreamParser.feed(content, native_thinking)` — Process one streaming token/chunk
- `ThinkingStreamParser.flush()` — Return any remaining buffered content and close open tags
- `_feed_channel_markers(content)` — Stateful processing for Gemma 4 channel-marker streams
- `_handle_native_thinking(native_thinking)` — Emit <think> wrapper around a pre-extracted thinking string
- `_maybe_close_thought(token)` — Detect text-phase resumption when in THOUGHT and no thought marker
- `_process_buffer(buffer, phase, emitted_think)` — Scan buffer for the next phase-transition marker
- `_scan_for_thought_start(buffer, emitted_think)` — TEXT phase: look for the first thought-start marker
- `_scan_for_text_start(buffer, emitted_think)` — THOUGHT phase: look for the first text-start marker

---

## `ai/ollama.py` — Ollama AI Provider

### OllamaProvider Class
- `__init__(host, system_prompt, model)` — Initialize the Ollama provider
- `list_models()` — Fetches available models from the local Ollama instance
- `_format_messages(messages, reasoning)` — Prepares the message list for the Ollama payload
- `chat(messages, model, session_id, provider_session_id, reasoning, **kwargs)` — Sends a message to Ollama (non-streaming)
- `chat_stream(messages, model, session_id, provider_session_id, reasoning, **kwargs)` — Streams response using Ollama's /api/chat endpoint
- `analyze_logs(template, samples, model)` — Specific one-off analysis for log clusters using Ollama
- `test_connection()` — Verify the local Ollama connection

---

## `ai/ai_studio.py` — Google AI Studio Provider

### AIStudioProvider Class
- `__init__(api_key, system_prompt, model)` — Initialize the AI Studio provider with caching
- `_patch_registry()` — Manually register missing model variants in ADK to prevent ValueErrors
- `list_models()` — Fetches available Gemini models from the API with caching
- `_get_target_model_and_mode(model)` — Validates the model name and determines the thinking mode
- `_prepare_messages(messages, target_model, reasoning)` — Injects system instructions or thinking tokens based on model capabilities
- `_prepare_adk_session(session_service, session_id, messages)` — Creates an ADK session and populates it with historical conversation events
- `chat(messages, model, session_id, provider_session_id, reasoning, **kwargs)` — Sends a message to Gemini via ADK Agent
- `chat_stream(messages, model, session_id, provider_session_id, reasoning, **kwargs)` — Streaming version using ADK Runner
- `analyze_logs(template, samples)` — Specific one-off analysis for log clusters
- `test_connection()` — Verify the Google AI Studio API Key

---

## `ai/openai_compatible.py` — OpenAI-Compatible Provider

### OpenAICompatibleProvider Class
- `__init__(api_key, system_prompt, host, model)` — Initialize the provider for any OpenAI-compatible API
- `list_models()` — Fetch available models from the provider (OpenAI or LM Studio)
- `chat(messages, model, session_id, provider_session_id, **kwargs)` — Execute a chat session
- `chat_stream(messages, model, session_id, provider_session_id, **kwargs)` — Streaming chat
- `analyze_logs(template, samples)` — One-off analysis
- `test_connection()` — Verify the OpenAI compatible connection

---

## `ai/gemini_cli.py` — Gemini CLI Provider

### GeminiCLIProvider Class
- `__init__(host, system_prompt, model)` — Initialize the provider with A2A Hot Mode support
- `_extract_json(output)` — Helper to find and parse the FIRST valid JSON object in a string
- `list_models()` — Returns available model names
- `_get_or_create_task(session, session_id, existing_task_id, model)` — Fetch existing taskId (from cache or DB) or create a new one
- `chat(messages, model, session_id, provider_session_id, **kwargs)` — Execute chat using A2A Hot Mode if available, falling back to Cold Mode
- `_chat_hot(session_id, messages, existing_task_id, model)` — Core Hot Mode logic via A2A Server
- `chat_stream(messages, model, session_id, provider_session_id, reasoning, **kwargs)` — Streaming version of hot mode chat
- `_prepare_hot_prompt(messages, is_new_task)` — Helper to prepare the prompt, injecting history if auto-healing is needed
- `_parse_sse_stream(reader)` — Robustly parse Server Sent Events (SSE) stream from A2A server
- `_parse_sse_stream_gen(content_stream)` — Asynchronous generator to yield chunks directly from SSE source
- `_parse_json_chunk(json_str)` — Robustly extracts agent text from a single JSON chunk
- `_sync_to_disk(session_id, messages)` — Persist session history to local JSON files for redundancy
- `_chat_cold(messages, model)` — Original Cold Mode logic as a fallback
- `analyze_logs(template, samples)` — Diagnostic analysis remains cold for now as it's typically a one-off
- `test_connection()` — Verify the Gemini CLI connectivity (A2A Hot Mode)

---

## `mcp_server.py` — MCP Tool Server

### Tool Functions
- `get_app()` — Returns the global app instance reference
- `init_mcp(app_instance)` — Initialize the MCP server with the app instance
- `ls_sources(workspace_id)` — List all available log sources for a given workspace
- `query_logs(workspace_id, query, limit)` — Query logs with text matching in the workspace
- `get_pattern_summary(workspace_id)` — Get a summary of the most frequent Drain3 cluster patterns in the workspace
- `analyze_cluster(workspace_id, cluster_id)` — Analyze a specific log cluster using AI to determine summary, root cause, and recommendations
- `get_anomalies(workspace_id)` — Retrieve statistical outliers and rare log patterns from the workspace
- `save_memory(workspace_id, issue_signature, resolution)` — Save a learned resolution to the workspace long-term memory
- `search_memory(workspace_id, query, limit)` — Search the workspace long-term memory for an issue signature or resolution

---

## `models.py` — Pydantic API Models

### Request/Response Models
- `FacetExtractionRule(name, regex, group, enabled)` — Custom facet extraction rule definition
- `JSONRPCRequest(jsonrpc, id, method, params)` — Base JSON-RPC request model
- `JSONRPCResponse(jsonrpc, id, result, error)` — Base JSON-RPC response model
- `LogFilter(field, value, operator)` — Filter entry model
- `GetLogsRequest(...)` — Model for get_logs request
- `StartTailRequest(...)` — Model for start_tail request
- `FolderCreateRequest(...)` — Model for create_folder request
- `FolderUpdateRequest(...)` — Model for update_folder request
- `FolderDeleteRequest(...)` — Model for delete_folder request
- `SourceMoveRequest(...)` — Model for source_move request
- `SourceUpdateRequest(...)` — Model for source_update request
- `CreateLogSourceRequest(...)` — Model for create_log_source request
- `DeleteLogSourceRequest(...)` — Model for delete_log_source request
- `GetHierarchyRequest(...)` — Model for get_hierarchy request
- `HierarchySource(id, name, type, path)` — Hierarchy source model
- `HierarchyNode(id, name, type, children, sources)` — Hierarchy node model
- `HierarchyResponse(workspace_id, root)` — Hierarchy response model
- `StartSSHTailRequest(...)` — Model for start_ssh_tail request
- `IngestLogEntry(workspace_id, source_id, raw_text, timestamp, level, message)` — Single log entry model
- `IngestLogsRequest(logs)` — Model for ingest_logs request
- `IngestLocalFileRequest(...)` — Model for ingest_local_file request
- `UpdateCommentRequest(...)` — Model for update_log_comment request
- `GetWorkspaceSourcesRequest(...)` — Model for get_workspace_sources request
- `ReadFileRequest(...)` — Model for read_file request
- `FusionSourceConfig(...)` — Model for fusion config source entry
- `TemporalOffsetEntry(...)` — Model for temporal offset entry
- `UpdateTemporalOffsetsRequest(...)` — Model for update_temporal_offsets request
- `GetTemporalOffsetsRequest(...)` — Model for get_temporal_offsets request
- `UpdateFusionConfigRequest(...)` — Model for update_fusion_config request
- `GetFusionConfigRequest(...)` — Model for get_fusion_config request
- `GetSampleLinesRequest(...)` — Model for get_sample_lines request
- `UpdateSourceParserRequest(...)` — Model for update_source_parser request
- `GetFusedLogsRequest(...)` — Model for get_fused_logs request
- `GetAnomaliesRequest(...)` — Model for get_anomalies request
- `GetDashboardStatsRequest(...)` — Model for get_dashboard_stats request
- `GetIngestionJobsRequest(...)` — Model for get_ingestion_jobs request
- `GetClusteringStatusRequest(...)` — Model for get_clustering_status request
- `GetClusteringStatusResponse(mode, running, paused, backlog, processed_session)` — Clustering status response model
- `SetClusteringModeRequest(...)` — Model for set_clustering_mode request
- `SetClusteringPausedRequest(...)` — Model for set_clustering_paused request
- `GetLogDistributionRequest(...)` — Model for get_log_distribution request
- `GetMetadataFacetsRequest(...)` — Model for get_metadata_facets request
- `ExportLogsRequest(...)` — Model for export_logs request
- `TestAiConnectionRequest(...)` — Model for test_ai_connection request
- `AnalyzeClusterRequest(...)` — Model for analyze_cluster request
- `SendAiMessageRequest(...)` — Model for send_ai_message request
- `GetAiSessionsRequest(...)` — Model for get_ai_sessions request
- `GetAiMessagesRequest(...)` — Model for get_ai_messages request
- `SaveMemoryRequest(...)` — Model for save_memory request
- `SearchMemoryRequest(...)` — Model for search_memory request
- `GetSettingsRequest(...)` — Model for get_settings request
- `UpdateSettingsRequest(...)` — Model for update_settings request
- `GetLogStreamsRequest(...)` — Model for get_log_streams request
- `CreateLogStreamRequest(...)` — Model for create_log_stream request
- `DeleteLogStreamRequest(...)` — Model for delete_log_stream request
- `GenerateExtractionRegexRequest(...)` — Model for generate_facet_regex request
- `DeleteLogsRequest(...)` — Model for delete_logs request
- `PurgeInactiveWorkspacesRequest(...)` — Model for purge_inactive_workspaces request
- `GetLogContentRequest(...)` — Model for get_log_content request

---

## `main.py` — Application Entry Point

### Main Functions
- `main()` — Parse command-line arguments and dispatch to HTTP or stdio mode

---

## Summary

The backend architecture follows a **Hexagonal design pattern** with:
- **Ports**: JSON-RPC API (api.py) and HTTP/Syslog ingestion (ingestion.py)
- **Adapters**: SharedSourceManager, FastPathService, LogDatabase
- **Core**: ClusteringWorker, AnomalyDetector, DrainParser, MetadataExtractor
- **AI Layer**: Provider factory (Ollama, AI Studio, OpenAI, Gemini CLI) unified through ThinkingStreamParser

All methods are validated by **Pydantic models** in `models.py` before execution. The **Disk-First / Fast-Path** architecture ensures efficient log storage and retrieval using mmap-based random access.