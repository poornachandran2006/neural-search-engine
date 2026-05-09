import pickle
import json
from pathlib import Path
from datetime import datetime, timezone
from typing import Callable

from rank_bm25 import BM25Okapi
from qdrant_client.models import PointStruct
from groq import Groq

from app.core.config import settings
from app.core.logging import get_logger
from app.core.exceptions import IngestError
from app.db.qdrant import get_qdrant_client
from app.services.ingestion.loader import load_document, compute_file_sha256
from app.services.ingestion.chunker import chunk_raw_pages, TextChunk
from app.services.ingestion.embedder import embed_texts

logger = get_logger(__name__)

BM25_INDEX_PATH = Path("/app/bm25_index.pkl")


def _get_existing_hashes() -> set[str]:
    client = get_qdrant_client()
    existing: set[str] = set()
    offset = None

    while True:
        results, offset = client.scroll(
            collection_name=settings.qdrant_collection,
            scroll_filter=None,
            limit=1000,
            offset=offset,
            with_payload=["sha256"],
            with_vectors=False,
        )
        for point in results:
            if point.payload and "sha256" in point.payload:
                existing.add(point.payload["sha256"])
        if offset is None:
            break

    return existing


def _upsert_chunks(chunks: list[TextChunk], embeddings: list[list[float]]) -> int:
    client = get_qdrant_client()
    now = datetime.now(timezone.utc).isoformat()

    points = [
        PointStruct(
            id=int(chunk.sha256[:16], 16),
            vector=embedding,
            payload={
                "text": chunk.text,
                "source_file": chunk.source_file,
                "chunk_index": chunk.chunk_index,
                "page_number": chunk.page_number,
                "file_type": chunk.file_type,
                "sha256": chunk.sha256,
                "token_count": chunk.token_count,
                "ingested_at": now,
            },
        )
        for chunk, embedding in zip(chunks, embeddings)
    ]

    client.upsert(
        collection_name=settings.qdrant_collection,
        points=points,
        wait=True,
    )
    return len(points)


def rebuild_bm25_index() -> None:
    client = get_qdrant_client()
    all_texts: list[str] = []
    all_ids: list[int] = []
    offset = None

    while True:
        results, offset = client.scroll(
            collection_name=settings.qdrant_collection,
            limit=1000,
            offset=offset,
            with_payload=["text"],
            with_vectors=False,
        )
        for point in results:
            if point.payload and "text" in point.payload:
                all_texts.append(point.payload["text"])
                all_ids.append(point.id)
        if offset is None:
            break

    if not all_texts:
        logger.warning("bm25_rebuild_skipped", reason="no_chunks_in_qdrant")
        return

    tokenized = [text.lower().split() for text in all_texts]
    bm25 = BM25Okapi(tokenized)

    index_data = {"bm25": bm25, "texts": all_texts, "ids": all_ids}
    BM25_INDEX_PATH.write_bytes(pickle.dumps(index_data))
    logger.info("bm25_index_rebuilt", total_docs=len(all_texts))


def load_bm25_index() -> dict | None:
    if not BM25_INDEX_PATH.exists():
        return None
    return pickle.loads(BM25_INDEX_PATH.read_bytes())


def _generate_suggestions(chunks: list[TextChunk]) -> list[str]:
    try:
        sample_chunks = chunks[:5]
        context = "\n\n".join(c.text for c in sample_chunks)

        prompt = f"""You are analyzing a document. Based on the following excerpt, generate exactly 5 specific questions that a user could ask and that can be answered from this document.

Return ONLY a JSON array of 5 question strings. No explanation, no preamble, no markdown.

Example format:
["Question 1?", "Question 2?", "Question 3?", "Question 4?", "Question 5?"]

Document excerpt:
{context[:3000]}"""

        client = Groq(api_key=settings.groq_api_key)
        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": prompt}],
            temperature=0,
            max_tokens=300,
        )

        raw = response.choices[0].message.content.strip()
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        suggestions = json.loads(raw.strip())

        if isinstance(suggestions, list):
            return [str(s) for s in suggestions[:5]]
        return []

    except Exception as e:
        logger.warning("suggestion_generation_failed", error=str(e))
        return []


async def run_ingestion_pipeline(
    file_path: Path,
    progress_callback: Callable[[str, str], None] | None = None,
) -> dict:
    """
    Full ingestion pipeline for a single document.
    progress_callback(stage, detail) is called at each step so the
    caller can write progress to Redis for the frontend to poll.
    """
    source_file = file_path.name

    async def _progress(stage: str, detail: str = "") -> None:
        if progress_callback:
            await progress_callback(stage, detail)

    logger.info("ingestion_started", file=source_file)
    await _progress("loading", f"Reading {source_file}")

    raw_chunks = load_document(file_path)
    if not raw_chunks:
        raise IngestError(f"No text could be extracted from {source_file}")

    await _progress("chunking", f"Splitting into 512-token chunks")
    text_chunks = chunk_raw_pages(raw_chunks)
    if not text_chunks:
        raise IngestError(f"Chunking produced no output for {source_file}")

    existing_hashes = _get_existing_hashes()
    new_chunks = [c for c in text_chunks if c.sha256 not in existing_hashes]
    skipped = len(text_chunks) - len(new_chunks)

    logger.info(
        "deduplication_complete",
        total=len(text_chunks),
        new=len(new_chunks),
        skipped=skipped,
    )

    upserted = 0
    if new_chunks:
        await _progress("embedding", f"Generating embeddings for {len(new_chunks)} chunks")
        texts = [c.text for c in new_chunks]
        embeddings = embed_texts(texts)

        await _progress("storing", f"Upserting to Qdrant and rebuilding BM25 index")
        upserted = _upsert_chunks(new_chunks, embeddings)
        rebuild_bm25_index()

    await _progress("suggestions", "Generating suggested questions")
    logger.info("generating_suggestions", file=source_file)
    suggestions = _generate_suggestions(text_chunks)
    logger.info("suggestions_generated", count=len(suggestions))

    await _progress("done", "Ingestion complete")
    logger.info(
        "ingestion_complete",
        file=source_file,
        total_chunks=len(text_chunks),
        upserted=upserted,
        skipped=skipped,
    )

    return {
        "source_file": source_file,
        "total_chunks": len(text_chunks),
        "upserted": upserted,
        "skipped": skipped,
        "sha256": compute_file_sha256(file_path),
        "suggestions": suggestions,
    }