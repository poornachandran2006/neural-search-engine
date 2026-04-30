import hashlib
from pathlib import Path
from dataclasses import dataclass, field

import fitz  # PyMuPDF
import docx
from app.core.logging import get_logger

logger = get_logger(__name__)

SUPPORTED_EXTENSIONS = {".pdf", ".txt", ".docx"}


@dataclass
class RawChunk:
    """
    A single page or section of text extracted from a document,
    before chunking. Carries metadata forward through the pipeline.
    """
    text: str
    source_file: str
    page_number: int
    file_type: str
    extra: dict = field(default_factory=dict)

    def is_empty(self) -> bool:
        return not self.text.strip()


def _load_pdf(path: Path) -> list[RawChunk]:
    chunks: list[RawChunk] = []
    doc = fitz.open(str(path))
    try:
        for page_num, page in enumerate(doc, start=1):
            text = page.get_text("text").strip()
            if not text:
                continue
            chunks.append(RawChunk(
                text=text,
                source_file=path.name,
                page_number=page_num,
                file_type="pdf",
                extra={"total_pages": doc.page_count},
            ))
    finally:
        doc.close()

    logger.info("pdf_loaded", file=path.name, pages=len(chunks))
    return chunks


def _load_txt(path: Path) -> list[RawChunk]:
    text = path.read_text(encoding="utf-8", errors="replace").strip()
    if not text:
        return []

    logger.info("txt_loaded", file=path.name, chars=len(text))
    return [RawChunk(
        text=text,
        source_file=path.name,
        page_number=1,
        file_type="txt",
    )]


def _load_docx(path: Path) -> list[RawChunk]:
    doc = docx.Document(str(path))
    chunks: list[RawChunk] = []
    current_text: list[str] = []
    page_number = 1

    for para in doc.paragraphs:
        # Word doesn't expose page numbers in python-docx;
        # we use paragraph breaks as logical page boundaries (~50 paras per page)
        current_text.append(para.text)

        if len(current_text) >= 50:
            text = "\n".join(current_text).strip()
            if text:
                chunks.append(RawChunk(
                    text=text,
                    source_file=path.name,
                    page_number=page_number,
                    file_type="docx",
                ))
            page_number += 1
            current_text = []

    # Flush remaining paragraphs
    if current_text:
        text = "\n".join(current_text).strip()
        if text:
            chunks.append(RawChunk(
                text=text,
                source_file=path.name,
                page_number=page_number,
                file_type="docx",
            ))

    logger.info("docx_loaded", file=path.name, sections=len(chunks))
    return chunks


def load_document(path: Path) -> list[RawChunk]:
    """
    Entry point. Dispatches to the correct loader based on file extension.
    Returns an empty list (not an exception) for unsupported types.
    """
    ext = path.suffix.lower()

    if ext not in SUPPORTED_EXTENSIONS:
        logger.warning("unsupported_file_type", file=path.name, ext=ext)
        return []

    if not path.exists():
        logger.error("file_not_found", file=str(path))
        return []

    loaders = {
        ".pdf": _load_pdf,
        ".txt": _load_txt,
        ".docx": _load_docx,
    }

    try:
        return loaders[ext](path)
    except Exception as e:
        logger.error("load_failed", file=path.name, error=str(e), exc_info=True)
        raise


def compute_file_sha256(path: Path) -> str:
    """SHA-256 of the entire file — used to detect if the file was already ingested."""
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for block in iter(lambda: f.read(65536), b""):
            h.update(block)
    return h.hexdigest()