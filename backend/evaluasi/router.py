from fastapi import APIRouter, HTTPException, Query

from backend.evaluasi.schemas import (
    EvaluationBestModelsResponse,
    EvaluationModelsMetricsResponse,
    ModelEpochMetricsResponse,
    TrainingLogLookupResponse,
)
from backend.evaluasi.service import (
    find_training_log_for_model,
    get_best_models_by_algorithm,
    get_model_epochs,
    get_models_metrics,
)


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


@router.get("/model-epochs/{model_id}", response_model=ModelEpochMetricsResponse)
def evaluation_model_epochs(model_id: int):
    try:
        items = get_model_epochs(model_id)
        return {
            "status": "ok",
            "total": len(items),
            "items": items,
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/training-log", response_model=TrainingLogLookupResponse)
def evaluation_training_log(
    nama_model: str = Query(..., min_length=1),
    algoritma: str | None = Query(None),
):
    try:
        log = find_training_log_for_model(
            nama_model=nama_model,
            algoritma=algoritma,
        )
        return {"status": "ok", "log": log}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
