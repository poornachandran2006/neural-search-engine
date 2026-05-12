import pytest
from app.services.ingestion.chunker import (
    _count_tokens,
    _compute_sha256,
    _cosine_similarity,
    _split_into_sentences,
    _recursive_split,
    TextChunk,
    chunk_raw_pages,
)
from app.services.ingestion.loader import RawChunk
import numpy as np


# ─── _count_tokens ────────────────────────────────────────────────────────────

def test_count_tokens_empty():
    assert _count_tokens("") == 0


def test_count_tokens_single_word():
    count = _count_tokens("hello")
    assert count == 1


def test_count_tokens_increases_with_length():
    short = _count_tokens("hello")
    long = _count_tokens("hello world this is a longer sentence with more tokens")
    assert long > short


# ─── _compute_sha256 ──────────────────────────────────────────────────────────

def test_sha256_is_64_chars():
    result = _compute_sha256("some text")
    assert len(result) == 64


def test_sha256_deterministic():
    assert _compute_sha256("hello") == _compute_sha256("hello")


def test_sha256_different_inputs():
    assert _compute_sha256("hello") != _compute_sha256("world")


# ─── _cosine_similarity ───────────────────────────────────────────────────────

def test_cosine_identical_vectors():
    v = np.array([1.0, 0.0, 0.0])
    assert abs(_cosine_similarity(v, v) - 1.0) < 1e-6


def test_cosine_orthogonal_vectors():
    a = np.array([1.0, 0.0])
    b = np.array([0.0, 1.0])
    assert abs(_cosine_similarity(a, b)) < 1e-6


def test_cosine_zero_vector():
    a = np.array([0.0, 0.0])
    b = np.array([1.0, 0.0])
    assert _cosine_similarity(a, b) == 0.0


# ─── _split_into_sentences ────────────────────────────────────────────────────

def test_split_into_sentences_basic():
    text = "This is sentence one. This is sentence two."
    sentences = _split_into_sentences(text)
    assert len(sentences) >= 1


def test_split_into_sentences_empty():
    result = _split_into_sentences("")
    assert result == []


def test_split_into_sentences_newlines():
    text = "First paragraph.\nSecond paragraph."
    sentences = _split_into_sentences(text)
    assert len(sentences) >= 2


# ─── _recursive_split ─────────────────────────────────────────────────────────

def test_recursive_split_short_text():
    text = "This is a short text."
    result = _recursive_split(text)
    assert len(result) == 1
    assert result[0] == "This is a short text."


def test_recursive_split_no_empty_strings():
    text = "Hello world.\n\n\nAnother paragraph here."
    result = _recursive_split(text)
    for chunk in result:
        assert chunk.strip() != ""


def test_recursive_split_long_text():
    # 600 words — should produce at least 2 chunks with 512 token limit
    word = "information "
    text = word * 600
    result = _recursive_split(text)
    assert len(result) >= 2


# ─── chunk_raw_pages ──────────────────────────────────────────────────────────

def test_chunk_raw_pages_returns_text_chunks():
    raw = [RawChunk(
        text="This is a test document with some content for chunking.",
        source_file="test.pdf",
        page_number=1,
        file_type="pdf",
    )]
    result = chunk_raw_pages(raw)
    assert len(result) >= 1
    assert all(isinstance(c, TextChunk) for c in result)


def test_chunk_raw_pages_sets_source_file():
    raw = [RawChunk(
        text="Some content here.",
        source_file="myfile.pdf",
        page_number=1,
        file_type="pdf",
    )]
    result = chunk_raw_pages(raw)
    assert all(c.source_file == "myfile.pdf" for c in result)


def test_chunk_raw_pages_computes_sha256():
    raw = [RawChunk(
        text="Content for hashing test.",
        source_file="test.pdf",
        page_number=1,
        file_type="pdf",
    )]
    result = chunk_raw_pages(raw)
    assert all(len(c.sha256) == 64 for c in result)


def test_chunk_raw_pages_empty_input():
    result = chunk_raw_pages([])
    assert result == []


def test_chunk_raw_pages_skips_empty_raw_chunks():
    raw = [RawChunk(text="   ", source_file="test.pdf", page_number=1, file_type="pdf")]
    result = chunk_raw_pages(raw)
    assert result == []


def test_chunk_raw_pages_chunk_index_sequential():
    raw = [RawChunk(
        text="word " * 600,  # long enough to produce multiple chunks
        source_file="test.pdf",
        page_number=1,
        file_type="pdf",
    )]
    result = chunk_raw_pages(raw)
    indices = [c.chunk_index for c in result]
    assert indices == list(range(len(result)))