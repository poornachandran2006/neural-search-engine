from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from app.db.postgres import get_db
from app.models.orm import Document
from app.core.logging import get_logger

logger = get_logger(__name__)
router = APIRouter(prefix="/documents", tags=["documents"])


@router.get("")
async def list_documents(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Document).order_by(desc(Document.ingested_at))
    )
    docs = result.scalars().all()
    return [
        {
            "id": d.id,
            "filename": d.filename,
            "file_type": d.file_type,
            "chunk_count": d.chunk_count,
            "upserted_count": d.upserted_count,
            "skipped_count": d.skipped_count,
            "sha256": d.sha256,
            "ingested_at": d.ingested_at,
            "suggestions": d.suggestions or [],
            "summary": d.summary or "",
        }
        for d in docs
    ]


@router.get("/{document_id}")
async def get_document(document_id: str, db: AsyncSession = Depends(get_db)):
    from fastapi import HTTPException
    result = await db.execute(select(Document).where(Document.id == document_id))
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    return {
        "id": doc.id,
        "filename": doc.filename,
        "file_type": doc.file_type,
        "chunk_count": doc.chunk_count,
        "upserted_count": doc.upserted_count,
        "skipped_count": doc.skipped_count,
        "sha256": doc.sha256,
        "ingested_at": doc.ingested_at,
        "suggestions": doc.suggestions or [],
        "summary": doc.summary or "",
    }