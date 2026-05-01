from fastapi import APIRouter, HTTPException

from backend.evaluasi.schemas import EvaluationBestModelsResponse
from backend.evaluasi.service import get_best_models_by_algorithm


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
