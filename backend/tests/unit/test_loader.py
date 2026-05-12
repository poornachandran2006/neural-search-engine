import pytest
from pathlib import Path
from app.services.ingestion.loader import RawChunk, load_document, SUPPORTED_EXTENSIONS


# ─── RawChunk ─────────────────────────────────────────────────────────────────

def test_raw_chunk_is_empty_blank():
    chunk = RawChunk(text="   ", source_file="f.pdf", page_number=1, file_type="pdf")
    assert chunk.is_empty() is True


def test_raw_chunk_is_empty_empty_string():
    chunk = RawChunk(text="", source_file="f.pdf", page_number=1, file_type="pdf")
    assert chunk.is_empty() is True


def test_raw_chunk_not_empty():
    chunk = RawChunk(text="hello", source_file="f.pdf", page_number=1, file_type="pdf")
    assert chunk.is_empty() is False


def test_raw_chunk_default_extra():
    chunk = RawChunk(text="hi", source_file="f.pdf", page_number=1, file_type="pdf")
    assert chunk.extra == {}


# ─── load_document — unsupported type ────────────────────────────────────────

def test_load_document_unsupported_extension(tmp_path):
    f = tmp_path / "file.xyz"
    f.write_text("content")
    result = load_document(f)
    assert result == []


def test_load_document_missing_file(tmp_path):
    f = tmp_path / "missing.pdf"
    result = load_document(f)
    assert result == []


# ─── load_document — txt ─────────────────────────────────────────────────────

def test_load_txt_returns_one_chunk(tmp_path):
    f = tmp_path / "test.txt"
    f.write_text("Hello world. This is a test document.")
    result = load_document(f)
    assert len(result) == 1
    assert result[0].file_type == "txt"
    assert result[0].source_file == "test.txt"
    assert result[0].page_number == 1


def test_load_txt_empty_file(tmp_path):
    f = tmp_path / "empty.txt"
    f.write_text("")
    result = load_document(f)
    assert result == []


def test_load_txt_content_preserved(tmp_path):
    f = tmp_path / "test.txt"
    f.write_text("Neural search engine test content.")
    result = load_document(f)
    assert "Neural search engine" in result[0].text


# ─── SUPPORTED_EXTENSIONS ────────────────────────────────────────────────────

def test_supported_extensions_contains_pdf():
    assert ".pdf" in SUPPORTED_EXTENSIONS


def test_supported_extensions_contains_txt():
    assert ".txt" in SUPPORTED_EXTENSIONS


def test_supported_extensions_contains_docx():
    assert ".docx" in SUPPORTED_EXTENSIONS