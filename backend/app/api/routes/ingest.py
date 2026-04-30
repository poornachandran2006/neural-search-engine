import shutil
import tempfile
from pathlib import Path

from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging import get_logger
from app.core.exceptions import IngestError
from app.db.postgres import get_db
from app.models.orm import Document
from app.models.response import IngestResponse
from app.services.ingestion.pipeline import run_ingestion_pipeline

logger = get_logger(__name__)
router = APIRouter(prefix="/ingest", tags=["ingestion"])

ALLOWED_EXTENSIONS = {".pdf", ".txt", ".docx"}
MAX_FILE_SIZE_MB = 50


@router.post("", response_model=IngestResponse)
async def ingest_document(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
):
    # Validate extension
    suffix = Path(file.filename).suffix.lower()
    if suffix not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=415,
            detail=f"Unsupported file type '{suffix}'. Allowed: {ALLOWED_EXTENSIONS}",
        )

    # Write to a temp file — pipeline needs a real path, not a stream
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        shutil.copyfileobj(file.file, tmp)
        tmp_path = Path(tmp.name)

    try:
        # Rename temp file to original filename so loader logs are meaningful
        named_path = tmp_path.parent / file.filename
        tmp_path.rename(named_path)

        result = await run_ingestion_pipeline(named_path)

        # Persist ingestion record to PostgreSQL
        doc = Document(
            filename=result["source_file"],
            file_type=suffix.lstrip("."),
            chunk_count=result["total_chunks"],
            upserted_count=result["upserted"],
            skipped_count=result["skipped"],
            sha256=result["sha256"],
        )
        db.add(doc)
        await db.commit()
        await db.refresh(doc)

        logger.info("ingest_route_complete", doc_id=doc.id, file=file.filename)

        return IngestResponse(
            document_id=doc.id,
            source_file=result["source_file"],
            total_chunks=result["total_chunks"],
            upserted=result["upserted"],
            skipped=result["skipped"],
            sha256=result["sha256"],
            message=f"Ingested {result['upserted']} new chunks ({result['skipped']} duplicates skipped).",
        )

    except IngestError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        logger.error("ingest_route_failed", file=file.filename, error=str(e), exc_info=True)
        raise HTTPException(status_code=500, detail="Ingestion failed. Check server logs.")
    finally:
        # Always clean up temp file
        try:
            named_path.unlink(missing_ok=True)
        except Exception:
            pass