import shutil
import tempfile
import uuid
from pathlib import Path

from fastapi import APIRouter, UploadFile, File, HTTPException, Depends, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging import get_logger
from app.core.exceptions import IngestError
from app.db.postgres import get_db
from app.db.redis_cache import set_job_progress, get_job_progress
from app.models.orm import Document
from app.models.response import IngestResponse
from app.services.ingestion.pipeline import run_ingestion_pipeline

logger = get_logger(__name__)
router = APIRouter(prefix="/ingest", tags=["ingestion"])

ALLOWED_EXTENSIONS = {".pdf", ".txt", ".docx"}


@router.post("", response_model=IngestResponse)
async def ingest_document(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
):
    suffix = Path(file.filename).suffix.lower()
    if suffix not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=415,
            detail=f"Unsupported file type '{suffix}'. Allowed: {ALLOWED_EXTENSIONS}",
        )

    # Write upload to temp file immediately — file stream closes after request
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        shutil.copyfileobj(file.file, tmp)
        tmp_path = Path(tmp.name)

    named_path = tmp_path.parent / file.filename
    tmp_path.rename(named_path)

    job_id = str(uuid.uuid4())

    # Set initial job state in Redis immediately
    await set_job_progress(job_id, {
        "status": "running",
        "stage": "queued",
        "detail": "Waiting to start…",
        "result": None,
        "error": None,
    })

    # Run the actual ingestion as a background task
    background_tasks.add_task(
        _run_ingestion_background,
        job_id=job_id,
        named_path=named_path,
        suffix=suffix,
        original_filename=file.filename,
    )

    # Return job_id immediately — frontend polls /ingest/status/{job_id}
    return IngestResponse(
        document_id=job_id,
        source_file=file.filename,
        total_chunks=0,
        upserted=0,
        skipped=0,
        sha256="",
        suggestions=[],
        message="Ingestion started.",
        job_id=job_id,
        status="running",
    )


async def _run_ingestion_background(
    job_id: str,
    named_path: Path,
    suffix: str,
    original_filename: str,
) -> None:
    """Runs in background. Writes progress to Redis. Saves to PostgreSQL when done."""
    from app.db.postgres import AsyncSessionLocal

    async def progress_callback(stage: str, detail: str) -> None:
        await set_job_progress(job_id, {
            "status": "running",
            "stage": stage,
            "detail": detail,
            "result": None,
            "error": None,
        })

    try:
        result = await run_ingestion_pipeline(named_path, progress_callback)

        async with AsyncSessionLocal() as db:
            doc = Document(
                filename=result["source_file"],
                file_type=suffix.lstrip("."),
                chunk_count=result["total_chunks"],
                upserted_count=result["upserted"],
                skipped_count=result["skipped"],
                sha256=result["sha256"],
                suggestions=result.get("suggestions", []),
            )
            db.add(doc)
            await db.commit()
            await db.refresh(doc)

        await set_job_progress(job_id, {
            "status": "done",
            "stage": "done",
            "detail": "Ingestion complete",
            "result": {
                "document_id": doc.id,
                "source_file": result["source_file"],
                "total_chunks": result["total_chunks"],
                "upserted": result["upserted"],
                "skipped": result["skipped"],
                "sha256": result["sha256"],
                "suggestions": result.get("suggestions", []),
            },
            "error": None,
        })
        logger.info("background_ingestion_complete", job_id=job_id, file=original_filename)

    except Exception as e:
        logger.error("background_ingestion_failed", job_id=job_id, error=str(e), exc_info=True)
        await set_job_progress(job_id, {
            "status": "error",
            "stage": "error",
            "detail": str(e),
            "result": None,
            "error": str(e),
        })
    finally:
        try:
            named_path.unlink(missing_ok=True)
        except Exception:
            pass


@router.get("/status/{job_id}")
async def get_ingestion_status(job_id: str):
    job = await get_job_progress(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job