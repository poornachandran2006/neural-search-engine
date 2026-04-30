import hashlib
from dataclasses import dataclass

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


def _compute_sha256(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def chunk_raw_pages(raw_chunks: list[RawChunk]) -> list[TextChunk]:
    """
    Takes the raw pages/sections from the loader and splits them into
    overlapping token-aware chunks using LangChain's RecursiveCharacterTextSplitter.

    Why RecursiveCharacterTextSplitter?
    It tries to split on paragraph breaks first, then sentences, then words —
    preserving semantic boundaries. Falls back to character splits only when needed.
    tiktoken length function makes every chunk exactly token-accurate.
    """
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=settings.chunk_size,        # 512 tokens
        chunk_overlap=settings.chunk_overlap,  # 64 tokens
        length_function=_count_tokens,
        separators=["\n\n", "\n", ". ", " ", ""],
    )

    text_chunks: list[TextChunk] = []
    global_index = 0

    for raw in raw_chunks:
        if raw.is_empty():
            continue

        splits = splitter.split_text(raw.text)

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
        source=raw_chunks[0].source_file if raw_chunks else "unknown",
        input_pages=len(raw_chunks),
        output_chunks=len(text_chunks),
    )
    return text_chunks