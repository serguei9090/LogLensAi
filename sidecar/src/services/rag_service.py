import datetime
import logging
import os
import uuid

import numpy as np

logger = logging.getLogger(__name__)


class RagService:
    """
    Semantic Memory Layer using LanceDB and ONNX quantized Nomic-Embed-Text-v1.5.
    Provides long-term RAG memory for the AI.
    """

    def __init__(self, data_dir: str):
        self.data_dir = data_dir
        self.lancedb_dir = os.path.join(data_dir, "lancedb")
        os.makedirs(self.lancedb_dir, exist_ok=True)

        self._tokenizer = None
        self._session = None
        self._db = None
        self._table = None
        self._model_loaded = False

    def _init_db(self):
        if self._db is not None:
            return

        import lancedb  # noqa: PLC0415
        import pyarrow as pa  # noqa: PLC0415

        self._db = lancedb.connect(self.lancedb_dir)

        # Define Schema
        schema = pa.schema(
            [
                pa.field("id", pa.string()),
                pa.field("workspace_id", pa.string()),
                pa.field("issue_signature", pa.string()),
                pa.field("resolution", pa.string()),
                pa.field("created_at", pa.string()),
                pa.field("vector", lancedb.vector(768)),
            ]
        )

        try:
            self._table = self._db.open_table("ai_memory")
        except Exception:
            self._table = self._db.create_table("ai_memory", schema=schema)

    def _ensure_model(self):
        if self._model_loaded:
            return

        logger.info("[RAG] Checking for nomic-embed-text-v1.5 (ONNX int8)...")
        import onnxruntime as ort  # noqa: PLC0415
        from huggingface_hub import snapshot_download  # noqa: PLC0415
        from tokenizers import Tokenizer  # noqa: PLC0415

        model_dir = snapshot_download(
            repo_id="nomic-ai/nomic-embed-text-v1.5",
            revision="main",
            allow_patterns=["onnx/model_int8.onnx", "tokenizer.json", "config.json"],
        )

        logger.info("[RAG] Loading Tokenizer and ONNX Session...")
        self._tokenizer = Tokenizer.from_file(os.path.join(model_dir, "tokenizer.json"))
        self._session = ort.InferenceSession(
            os.path.join(model_dir, "onnx", "model_int8.onnx"), providers=["CPUExecutionProvider"]
        )
        self._model_loaded = True
        logger.info("[RAG] Model loaded successfully.")

    def _embed(self, text: str, is_query: bool = False) -> list[float]:  # noqa: FBT001, FBT002
        """Embed text using Nomic model."""
        self._ensure_model()

        # Nomic uses prefixes
        prefix = "search_query: " if is_query else "search_document: "
        encoded = self._tokenizer.encode(prefix + text)

        input_ids = np.array([encoded.ids], dtype=np.int64)
        attention_mask = np.array([encoded.attention_mask], dtype=np.int64)

        inputs = {
            "input_ids": input_ids,
            "token_type_ids": np.zeros_like(input_ids),
            "attention_mask": attention_mask,
        }

        outputs = self._session.run(None, inputs)
        embeddings = outputs[0]

        # Mean pooling
        input_mask_expanded = np.expand_dims(attention_mask, -1).astype(float)
        sum_embeddings = np.sum(embeddings * input_mask_expanded, axis=1)
        sum_mask = np.clip(np.sum(input_mask_expanded, axis=1), a_min=1e-9, a_max=None)
        pooled = sum_embeddings / sum_mask

        # Normalize
        norm = np.linalg.norm(pooled, axis=1, keepdims=True)
        normalized = pooled / norm

        return normalized[0].tolist()

    def save_memory(self, workspace_id: str, issue_signature: str, resolution: str) -> dict:
        """Save a new memory via embedding and LanceDB."""
        self._init_db()
        logger.info("[RAG] Saving memory for workspace %s", workspace_id)

        # Embed the issue signature as a document
        vector = self._embed(issue_signature, is_query=False)

        data = [
            {
                "id": str(uuid.uuid4()),
                "workspace_id": workspace_id,
                "issue_signature": issue_signature,
                "resolution": resolution,
                "created_at": datetime.datetime.now(datetime.UTC).strftime("%Y-%m-%d %H:%M:%S"),  # noqa: E501
                "vector": vector,
            }
        ]

        self._table.add(data)
        logger.info("[RAG] Memory saved successfully.")
        return {"status": "ok"}

    def search_memory(self, workspace_id: str, query: str, limit: int = 5) -> list[dict]:
        """Semantically search the workspace memory."""
        self._init_db()
        logger.info("[RAG] Searching memory in %s for: %s", workspace_id, query)

        # Embed the query
        vector = self._embed(query, is_query=True)

        # We need to filter by workspace_id
        # Vector search using LanceDB
        try:
            results = (
                self._table.search(vector)
                .where(f"workspace_id = '{workspace_id}'")
                .limit(limit)
                .to_list()
            )

            return [
                {
                    "issue_signature": row["issue_signature"],
                    "resolution": row["resolution"],
                    "created_at": row["created_at"],
                    "distance": row.get("_distance", 0.0),
                }
                for row in results
            ]
        except Exception:
            logger.exception("[RAG] Search failed:")
            return []
