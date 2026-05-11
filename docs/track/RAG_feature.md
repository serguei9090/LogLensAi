# RAG Memory Layer Specification

## 🎯 Concept & Purpose
The RAG (Retrieval-Augmented Generation) feature will serve as the "Long-Term Memory" for the AI investigator in LogLensAi. 

Currently, the AI can analyze a cluster, but it has no persistence across sessions. By implementing a vector-based RAG layer, the AI can store "Lessons Learned", resolved issues, and root-cause analyses. When a similar log pattern or anomaly occurs in the future, the system will semantically retrieve the past resolution and automatically suggest it to the user.

## 🗄️ Database Selection: LanceDB vs. ChromaDB

### **LanceDB (Recommended for LogLensAi)**
*   **Pros:** 
    *   Embedded directly within the Python process (like DuckDB).
    *   Zero-copy integrations with PyArrow and Pandas (which we are already using for our blazing-fast DuckDB ingestion).
    *   Stores data on disk using the Lance format, meaning it handles larger-than-RAM datasets effortlessly.
*   **Cons:** Newer ecosystem compared to Chroma.

### **ChromaDB**
*   **Pros:** Extremely popular, massive community support, easy to integrate with LangChain/LangGraph.
*   **Cons:** Can be heavier; running it purely embedded inside a Tauri app can sometimes introduce complex dependency bloat (especially around SQLite versions).

**Verdict:** We will use **LanceDB** to maintain our high-performance, embedded, zero-dependency philosophy. It will sit alongside DuckDB in the `data/storage` directory.

## 💾 What Data Should Be Saved?
To make the RAG memory highly effective, we should not store raw logs. Instead, we should store structured "Insight Records".

An ideal Memory Record should contain:
1.  **Issue Signature (The Embedding Target):** The core log template, the cluster ID, or the exact error stack trace.
2.  **Context Tags (Metadata Filters):** `workspace_id`, `source_id`, `service_name`, `severity`.
3.  **Root Cause Summary:** A brief, AI-generated summary of *why* the issue happened.
4.  **Resolution / Remediation:** The steps taken by the user or the AI to fix the problem (e.g., "Restarted the Redis container", "Increased timeout to 60s").
5.  **Timestamp:** When the lesson was learned.

## 🔄 Workflow
1.  **Trigger:** User asks the AI "Why did this happen?" and the AI provides a solution. The user clicks a "Save to Memory" button.
2.  **Embedding:** The sidecar uses a local embedding model (e.g., `nomic-embed-text` via Ollama) to convert the "Issue Signature" into a vector.
3.  **Storage:** The vector and the text metadata are appended to the LanceDB table.
4.  **Retrieval:** When a new anomaly triggers, the sidecar automatically embeds the new error log, searches LanceDB for the nearest neighbor, and injects the "Past Resolution" into the AI's prompt as context.
