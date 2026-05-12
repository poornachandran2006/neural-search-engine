import hashlib
import re
from dataclasses import dataclass

import numpy as np
import tiktoken
from langchain.text_splitter import RecursiveCharacterTextSplitter

from app.core.config import settings
from app.core.logging import get_logger
from app.services.ingestion.loader import RawChunk

logger = get_logger(__name__)

# Load tokenizer once at module level — expensive operation
_tokenizer = tiktoken.get_encoding("cl100k_base")


def _count_tokens(text: str) -> int:
    return len(_tokenizer.encode(text, disallowed_special=()))


def _compute_sha256(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def _cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
    """Cosine similarity between two 1-D numpy vectors."""
    denom = np.linalg.norm(a) * np.linalg.norm(b)
    if denom == 0:
        return 0.0
    return float(np.dot(a, b) / denom)


@dataclass
class TextChunk:
    """
    A single chunk ready for embedding and Qdrant upsert.
    sha256 is computed from the chunk text — used for deduplication.
    """
    text: str
    source_file: str
    chunk_index: int
    page_number: int
    file_type: str
    sha256: str
    token_count: int


# ─── Recursive chunker (original) ────────────────────────────────────────────

def _recursive_split(text: str) -> list[str]:
    """
    Splits a single text string using LangChain RecursiveCharacterTextSplitter.
    Token-aware via tiktoken. Used both as the primary recursive strategy
    and as a fallback inside the semantic chunker for oversized chunks.
    """
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=settings.chunk_size,
        chunk_overlap=settings.chunk_overlap,
        length_function=_count_tokens,
        separators=["\n\n", "\n", ". ", " ", ""],
    )
    return [s.strip() for s in splitter.split_text(text) if s.strip()]


# ─── Semantic chunker ─────────────────────────────────────────────────────────

def _split_into_sentences(text: str) -> list[str]:
    """
    Splits text into sentences using regex.
    Handles common abbreviations by requiring the next word to start
    with a capital letter after a period.
    """
    # Split on period/exclamation/question followed by whitespace + capital
    sentence_endings = re.compile(r'(?<=[.!?])\s+(?=[A-Z])')
    sentences = sentence_endings.split(text)
    # Also split on newlines — treat each paragraph line as a sentence boundary
    result = []
    for s in sentences:
        parts = s.split('\n')
        result.extend(p.strip() for p in parts if p.strip())
    return result


def _embed_sentences(sentences: list[str]) -> np.ndarray:
    """
    Embeds a list of sentences using the Gemini embedding API.
    Returns a 2-D numpy array of shape (n_sentences, embedding_dim).
    Uses the same embedder infrastructure as the ingestion pipeline.
    """
    import google.generativeai as genai
    genai.configure(api_key=settings.gemini_api_key)

    embeddings = []
    # Gemini batch limit is 100 — process in batches
    batch_size = 100
    for i in range(0, len(sentences), batch_size):
        batch = sentences[i:i + batch_size]
        result = genai.embed_content(
            model=settings.embedding_model,
            content=batch,
            task_type="retrieval_document",
        )
        embeddings.extend(result["embedding"])

    return np.array(embeddings, dtype=np.float32)


def _semantic_split(text: str) -> list[str]:
    """
    Semantic chunking algorithm:

    1. Split document into sentences
    2. Embed every sentence with Gemini
    3. Compute cosine similarity between adjacent sentence pairs
    4. A sharp similarity drop (below threshold) = topic boundary = chunk split
    5. If any resulting chunk exceeds chunk_size tokens, fall back to
       recursive splitting on that chunk only

    Why this is better than recursive:
    RecursiveCharacterTextSplitter cuts at fixed token counts. A 512-token
    boundary might land mid-paragraph, splitting a complete thought across
    two chunks. Semantic chunking ensures each chunk contains one complete
    topic, improving retrieval precision.
    """
    sentences = _split_into_sentences(text)

    if len(sentences) <= 1:
        # Nothing to compare — fall back to recursive
        return _recursive_split(text)

    logger.info("semantic_chunking_started", sentence_count=len(sentences))

    # Embed all sentences in one batched call
    embeddings = _embed_sentences(sentences)

    # Compute similarity between every adjacent pair
    similarities = []
    for i in range(len(sentences) - 1):
        sim = _cosine_similarity(embeddings[i], embeddings[i + 1])
        similarities.append(sim)

    # Find breakpoints — positions where similarity drops below threshold
    threshold = settings.semantic_breakpoint_threshold
    breakpoints = {i + 1 for i, sim in enumerate(similarities) if sim < threshold}

    # Group sentences into chunks using breakpoints
    raw_chunks: list[str] = []
    current_sentences: list[str] = []

    for i, sentence in enumerate(sentences):
        if i in breakpoints and current_sentences:
            raw_chunks.append(" ".join(current_sentences))
            current_sentences = [sentence]
        else:
            current_sentences.append(sentence)

    if current_sentences:
        raw_chunks.append(" ".join(current_sentences))

    # Token ceiling — oversized semantic chunks get recursively split
    final_chunks: list[str] = []
    for chunk in raw_chunks:
        if _count_tokens(chunk) > settings.chunk_size:
            # This chunk is too long — split it recursively
            sub_chunks = _recursive_split(chunk)
            final_chunks.extend(sub_chunks)
        else:
            final_chunks.append(chunk)

    logger.info(
        "semantic_chunking_complete",
        sentence_count=len(sentences),
        raw_semantic_chunks=len(raw_chunks),
        final_chunks=len(final_chunks),
    )

    return final_chunks


# ─── Public entry point ───────────────────────────────────────────────────────

def chunk_raw_pages(raw_chunks: list[RawChunk]) -> list[TextChunk]:
    """
    Takes the raw pages/sections from the loader and splits them into chunks.

    Strategy is controlled by settings.chunking_strategy:
      "recursive" — original LangChain RecursiveCharacterTextSplitter (default)
      "semantic"  — sentence embedding similarity with recursive fallback

    Both strategies produce identical TextChunk objects — the rest of the
    pipeline sees no difference.
    """
    strategy = settings.chunking_strategy.lower()
    split_fn = _semantic_split if strategy == "semantic" else _recursive_split

    logger.info("chunking_started", strategy=strategy)

    text_chunks: list[TextChunk] = []
    global_index = 0

    for raw in raw_chunks:
        if raw.is_empty():
            continue

        splits = split_fn(raw.text)

        for split_text in splits:
            split_text = split_text.strip()
            if not split_text:
                continue

            token_count = _count_tokens(split_text)
            sha256 = _compute_sha256(split_text)

            text_chunks.append(TextChunk(
                text=split_text,
                source_file=raw.source_file,
                chunk_index=global_index,
                page_number=raw.page_number,
                file_type=raw.file_type,
                sha256=sha256,
                token_count=token_count,
            ))
            global_index += 1

    logger.info(
        "chunking_complete",
        strategy=strategy,
        source=raw_chunks[0].source_file if raw_chunks else "unknown",
        input_pages=len(raw_chunks),
        output_chunks=len(text_chunks),
    )
    return text_chunks