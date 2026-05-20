from fastapi import APIRouter, HTTPException

from backend.evaluasi.schemas import EvaluationBestModelsResponse, EvaluationModelsMetricsResponse
from backend.evaluasi.service import get_best_models_by_algorithm, get_models_metrics


router = APIRouter(prefix="/evaluasi", tags=["evaluasi"])


@router.get("/best-models", response_model=EvaluationBestModelsResponse)
def evaluation_best_models():
    try:
        items = get_best_models_by_algorithm()
        return {
            "status": "ok",
            "total": len(items),
            "items": items,
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/models-metrics", response_model=EvaluationModelsMetricsResponse)
def evaluation_models_metrics():
    try:
        items = get_models_metrics()
        return {
            "status": "ok",
            "total": len(items),
            "items": items,
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
