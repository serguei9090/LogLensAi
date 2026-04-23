# Project Summary: LogLensAi

LogLensAi is an advanced, high-performance desktop application designed for professional log analysis, anomaly detection, and cluster-based pattern recognition. It bridges the gap between raw unstructured logs and actionable engineering insights.

## Core Purpose
Engineering teams often struggle with high-volume logs during incidents. LogLensAi provides a localized, AI-powered workbench that can ingest millions of lines, cluster them into templates, and use LLMs to perform root-cause analysis without sending sensitive data to the cloud (when used with local providers).

## Key Features
- **Cluster-Based Analysis**: Uses Drain3 to automatically group similar log lines into templates, reducing noise by up to 99%.
- **Hybrid AI Orchestration**: A state-preserving state machine (LangGraph) that manages complex investigations across various AI providers (Gemini, Ollama, OpenAI).
- **A2UI Interactive Protocol**: AI responses can include embedded UI elements (filters, search actions) that the user can interact with directly.
- **Remote Log Tailing**: Seamlessly tail logs from remote servers via SSH.
- **SQL-Powered Search**: Uses DuckDB for lightning-fast querying and filtering of log data.
- **Virtualization**: Handles millions of rows smoothly using TanStack Virtual.

## User Personas
- **SRE / DevOps**: For rapid incident response and log aggregation.
- **Security Researchers**: For detecting unusual patterns or access attempts.
- **Software Developers**: For local debugging and performance analysis.
