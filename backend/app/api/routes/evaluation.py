import json
from pathlib import Path
from fastapi import APIRouter, BackgroundTasks, HTTPException, Depends
from sqlalchemy import select, func, case
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.logging import get_logger
from app.db.postgres import get_db
from app.models.orm import Message
from app.services.evaluation.benchmark import run_benchmark, RESULTS_PATH

logger = get_logger(__name__)
router = APIRouter(prefix="/evaluation", tags=["evaluation"])

_benchmark_running = False


@router.post("/run")
async def trigger_benchmark(background_tasks: BackgroundTasks):
    """
    Triggers benchmark run in the background.
    Returns immediately — poll /evaluation/results for completion.
    """
    global _benchmark_running
    if _benchmark_running:
        raise HTTPException(status_code=409, detail="Benchmark already running")

    async def _run():
        global _benchmark_running
        _benchmark_running = True
        try:
            await run_benchmark()
        finally:
            _benchmark_running = False

    background_tasks.add_task(_run)
    return {"status": "started", "message": "Benchmark running in background. Poll /evaluation/results."}


@router.get("/results")
async def get_results():
    """Returns the latest benchmark results from disk."""
    if not RESULTS_PATH.exists():
        raise HTTPException(
            status_code=404,
            detail="No benchmark results found. Run POST /evaluation/run first."
        )
    return json.loads(RESULTS_PATH.read_text())


@router.get("/status")
async def get_status():
    return {"running": _benchmark_running}

@router.get("/analytics")
async def get_analytics(db: AsyncSession = Depends(get_db)):
    """
    Aggregates real query analytics from the messages table.
    Only counts assistant messages that have analytics data recorded.
    """
    result = await db.execute(
        select(
            func.count(Message.id).label("total_queries"),
            func.avg(Message.latency_ms).label("avg_latency_ms"),
            func.avg(Message.retrieval_score).label("avg_retrieval_score"),
            func.sum(case((Message.cache_hit == True, 1), else_=0)).label("cache_hits"),
        ).where(
            Message.role == "assistant",
            Message.latency_ms.isnot(None),
        )
    )
    row = result.one()

    # Intent distribution
    intent_result = await db.execute(
        select(Message.intent, func.count(Message.id).label("count"))
        .where(Message.role == "assistant", Message.intent.isnot(None))
        .group_by(Message.intent)
    )
    intent_rows = intent_result.all()

    total = row.total_queries or 0
    cache_hits = int(row.cache_hits or 0)

    return {
        "total_queries": total,
        "avg_latency_ms": round(float(row.avg_latency_ms or 0), 1),
        "avg_retrieval_score": round(float(row.avg_retrieval_score or 0), 3),
        "cache_hit_rate": round(cache_hits / total, 3) if total > 0 else 0.0,
        "cache_hits": cache_hits,
        "intent_distribution": {
            r.intent: r.count for r in intent_rows
        },
    }