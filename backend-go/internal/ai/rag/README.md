# rag

## Overview
Local vector retrieval and semantic memory subsystem powered by ONNX `nomic-embed-text-v1.5` (`768`-dim embeddings), a pure-Go BERT WordPiece tokenizer, DuckDB vector tables (`ai_memory` and `knowledge_documents`), `fsnotify` knowledge directory watching/ingestion, Hugging Face model downloading, and Markdown resolution export.

## Interface
- `[embed.go:EmbeddingDim]`, `[embed.go:Embedder]`, `[embed.go:NewEmbedder]`, `[embed.go:Embedder.Close]`, `[embed.go:Embedder.Embed]`: Mutex-guarded ONNX embedder (`EmbeddingDim = 768`).
- `[tokenizer.go:Tokenizer]`, `[tokenizer.go:LoadTokenizer]`, `[tokenizer.go:Tokenizer.Encode]`: Pure-Go BERT WordPiece tokenizer.
- `[modelfiles.go:NewEmbedderFromEnv]`: Resolves ONNX Runtime shared library and model/tokenizer paths (env vars -> HF hub cache -> download) to build an `*Embedder`.
- `[downloader.go:RAGTokenizerFileName]`, `[downloader.go:RAGModelFileName]`, `[downloader.go:RAGTokenizerApproxSize]`, `[downloader.go:RAGModelApproxSize]`, `[downloader.go:RAGTotalApproxSize]`, `[downloader.go:ModelDownloadState]`, `[downloader.go:ModelStateIdle]`, `[downloader.go:ModelStateDownloading]`, `[downloader.go:ModelStateReady]`, `[downloader.go:ModelStateError]`, `[downloader.go:ModelStatus]`, `[downloader.go:ModelManager]`, `[downloader.go:NewModelManager]`, `[downloader.go:ModelManager.SetBaseURL]`, `[downloader.go:ModelManager.GetPaths]`, `[downloader.go:ModelManager.RefreshStatus]`, `[downloader.go:ModelManager.GetStatus]`, `[downloader.go:ModelManager.StartDownload]`, `[downloader.go:ModelManager.DeleteModel]`: RAG model download and status manager.
- `[rag.go:MemoryResult]`, `[rag.go:Service]`, `[rag.go:NewService]`, `[rag.go:Service.SetExporter]`, `[rag.go:Service.VSSStatus]`, `[rag.go:Service.SaveMemory]`, `[rag.go:Service.SearchMemory]`: Semantic incident memory service backed by DuckDB `ai_memory`.
- `[knowledge.go:DocumentChunk]`, `[knowledge.go:KnowledgeSearchResult]`, `[knowledge.go:Service.IngestKnowledgeFile]`, `[knowledge.go:Service.SearchKnowledge]`, `[knowledge.go:RecursiveChunkText]`: Knowledge document chunking, ingestion, and cosine-similarity search over `knowledge_documents`.
- `[watcher.go:KnowledgeWatcher]`, `[watcher.go:NewKnowledgeWatcher]`, `[watcher.go:KnowledgeWatcher.Stop]`, `[watcher.go:KnowledgeWatcher.ScanAll]`: `fsnotify` watcher and scanner for local knowledge directories.
- `[markdown_export.go:SanitizeFilename]`, `[markdown_export.go:MemoryMarkdownExporter]`, `[markdown_export.go:NewMemoryMarkdownExporter]`, `[markdown_export.go:MemoryMarkdownExporter.ExportResolution]`: YAML-frontmatter Markdown exporter under `<knowledgeBaseDir>/Memory`.

## Invariants
- `[embed.go:Embedder]`, `[embed.go:Embedder.Embed]`, `[embed.go:meanPoolAndNormalize]`: Serializes ONNX `Run`/`Destroy` via `mu`; prefixes `"search_query: "` when `isQuery` is true else `"search_document: "`; rejects zero-token inputs; returns L2-normalized 768-dim embeddings.
- `[tokenizer.go:LoadTokenizer]`, `[tokenizer.go:Tokenizer.Encode]`, `[tokenizer.go:Tokenizer.wordpiece]`: Wraps sequences in `[CLS]` (`101`) ... `[SEP]` (`102`) without truncation and maps pretokens > 100 runes or missing subwords to `[UNK]` (`100`).
- `[rag.go:Service.SaveMemory]`, `[rag.go:Service.SearchMemory]`: Rejects embeddings whose length differs from `db.AIMemoryEmbeddingDim`; `SaveMemory` performs separate autocommitted `DELETE` and `INSERT` statements (not crash-atomic); `SearchMemory` defaults `limit <= 0` to `5` and requires `embedding IS NOT NULL`.
- `[knowledge.go:Service.IngestKnowledgeFile]`, `[knowledge.go:Service.SearchKnowledge]`, `[knowledge.go:RecursiveChunkText]`: Accepts `.md`, `.txt`, `.pdf`, `.png`, `.jpg`, `.jpeg`; chunks at `chunkSize=500`, `overlap=50`; deletes existing `(workspace_id, file_path)` rows before insert; `SearchKnowledge` defaults `limit <= 0` to `5` and computes `Score = 1.0 - Distance`.
- `[downloader.go:ModelManager.*]`, `[modelfiles.go:resolveModelFiles]`, `[modelfiles.go:downloadIfMissing]`: Resolves `<modelDir>/onnx/model_int8.onnx` and `<modelDir>/tokenizer.json`; downloads into `.part` files and atomically renames only on HTTP 200 completion.
- `[watcher.go:NewKnowledgeWatcher]`, `[watcher.go:KnowledgeWatcher.ScanAll]`, `[watcher.go:KnowledgeWatcher.Stop]`: `NewKnowledgeWatcher` registers subdirectory watches without starting `eventLoop`; `ScanAll` rejects concurrent runs via `isScanning`; `Stop` closes `stopCh` without `sync.Once` (calling twice panics).

## Side Effects
- `[embed.go:NewEmbedder]`, `[embed.go:Embedder.Embed]`, `[embed.go:Embedder.Close]`: Mutates global `onnxruntime_go` state (`SetSharedLibraryPath`, `InitializeEnvironment`), reads tokenizer JSON from disk, and manages native ONNX sessions and tensors.
- `[downloader.go:ModelManager.*]`, `[modelfiles.go:*]`: Reads `LOGLENS_ONNXRUNTIME_PATH`, `LOGLENS_RAG_MODEL_PATH`, `LOGLENS_RAG_TOKENIZER_PATH`, and `HF_HOME` env vars, reads/creates/deletes local files, and downloads weights via HTTP GET from Hugging Face (`nomic-ai/nomic-embed-text-v1.5`).
- `[rag.go:NewService]`, `[rag.go:Service.*]`, `[knowledge.go:Service.*]`: Executes `db.SetupVectorSearch`, reads/writes DuckDB `ai_memory` and `knowledge_documents`, reads disk documents, and prints export warnings via `fmt.Printf`.
- `[watcher.go:KnowledgeWatcher.*]`, `[markdown_export.go:*]`: Creates directories and resolution Markdown files on disk, opens/closes OS `fsnotify` watches, and logs errors via `log.Printf`.

## Verification
- Run: `go test ./...`
