## Log Ingestion Workflow

```mermaid
graph TD
    subgraph File_A_Flow [File A Ingestion]
        A[User Initiates Upload for File A] --> B[Frontend: Select File A]
        B --> C[Frontend: Call JSON-RPC ingest_logs for File A]
        C --> D[Sidecar: Receive Request]
        D --> E[Sidecar: Store in DuckDB Workspace A]
        E --> F[Sidecar: Return Status]
        F --> G[Frontend: Update UI - File A Ready]
    end

    subgraph File_B_Flow [File B Parallel Ingestion]
        H[User Initiates Upload for File B] --> I[Frontend: Select File B]
        I --> J[Frontend: Call ingest_logs for File B]
        J --> K[Sidecar: Parallel Thread Processing]
        K --> L[Sidecar: Store in DuckDB Workspace B]
        L --> M[Sidecar: Return Status]
        M --> N[Frontend: Update UI - File B Ready]
    end

    subgraph User_Interaction [Analysis & UI State]
        G --> O[User Starts Analysis on File A]
        O --> P[Frontend: Investigation Page A]
        
        N --> R[Background Loading for B]
        R --> S[Loading Indicator for B]
        S --> T[User Switches Workspaces]
        T --> U[Zustand Store: Activate Workspace B]
    end

    subgraph Technical_Notes [Concurrency Logic]
        V[Concurrency Notes] --> W[Separate Threads per Upload]
        W --> X[DuckDB: get_cursor Access]
        X --> Y[UI Responsiveness Maintained]
    end