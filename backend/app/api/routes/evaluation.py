import json
from pathlib import Path
from fastapi import APIRouter, BackgroundTasks, HTTPException
from app.core.logging import get_logger
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