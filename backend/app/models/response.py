from datetime import datetime
from pydantic import BaseModel


class SourceChunk(BaseModel):
    source_file: str
    page_number: int
    chunk_index: int
    score: float
    text_preview: str   # first 200 chars of the chunk


class IngestResponse(BaseModel):
    document_id: str
    source_file: str
    total_chunks: int
    upserted: int
    skipped: int
    sha256: str
    message: str


class DocumentRecord(BaseModel):
    id: str
    filename: str
    file_type: str
    chunk_count: int
    upserted_count: int
    sha256: str
    ingested_at: datetime


class ChatRecord(BaseModel):
    id: str
    title: str
    created_at: datetime
    updated_at: datetime


class MessageRecord(BaseModel):
    id: str
    chat_id: str
    role: str
    content: str
    sources: list[SourceChunk] | None
    created_at: datetime