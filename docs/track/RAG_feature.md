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

## 🧠 Embedding Model Management
To ensure a frictionless, "batteries-included" experience for the user, LogLensAi will manage the embedding model autonomously:
*   **Model Choice (`nomic-embed-text-v1.5`):** We officially mandate the use of the **ONNX quantized version of `nomic-embed-text-v1.5`**. 
    *   *Context Window:* It supports an 8192-token context window, meaning it will never silently truncate large JSON payloads or Java stack traces (unlike MiniLM which is capped at 256 tokens).
    *   *Code Awareness:* It was trained heavily on code and technical vocabulary, understanding semantic links between errors that general text models miss.
    *   *Performance:* Using the ONNX quantized weights, it is compressed to ~150MB and runs blazing fast natively on the CPU.
*   **Auto-Download Strategy:** When the sidecar initializes the RAG service, it will verify if the local embedding model weights exist in the `data/models` directory.
*   **Frictionless Setup:** If the model is missing, the backend will automatically download and cache it via the `onnxruntime` and `huggingface_hub` libraries on the first run. The user does not need to manually configure Ollama or manage Python environments to enable semantic search.

## 🔄 Workflow
1.  **Trigger:** User asks the AI "Why did this happen?" and the AI provides a solution. The user clicks a "Save to Memory" button.
2.  **Embedding:** The sidecar uses the local `nomic-embed-text-v1.5` ONNX model to convert the "Issue Signature" into a 768-dimensional vector (or smaller via Matryoshka representations).
3.  **Storage:** The vector and the text metadata are appended to the LanceDB table.
4.  **Retrieval:** When a new anomaly triggers, the sidecar automatically embeds the new error log, searches LanceDB for the nearest neighbor, and injects the "Past Resolution" into the AI's prompt as context.
