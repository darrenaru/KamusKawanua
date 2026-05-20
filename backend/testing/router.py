from fastapi import APIRouter, HTTPException

from backend.testing.schemas import (
    EvaluationBestModelsResponse,
    IndoBertTestingRequest,
    IndoBertTestingResponse,
    TestingModelListResponse,
    TestingPredictRequest,
    TestingPredictResponse,
)
from backend.testing.service import (
    get_available_testing_models,
    get_best_models_by_algorithm,
    predict_with_testing_model,
    test_indobert_model,
    test_mbert_model,
)


router = APIRouter(prefix="/testing", tags=["testing"])


@router.get("/models", response_model=TestingModelListResponse)
def testing_models():
    try:
        items = get_available_testing_models()
        return {
            "status": "ok",
            "total": len(items),
            "items": items,
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/indobert", response_model=IndoBertTestingResponse)
def testing_indobert(req: IndoBertTestingRequest):
    try:
        return test_indobert_model(
            dataset_id=req.dataset_id,
            model_name=req.model_name,
            model_id=req.model_id,
            max_length=req.max_length,
            limit=req.limit,
            save_result=req.save_result,
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/mbert", response_model=IndoBertTestingResponse)
def testing_mbert(req: IndoBertTestingRequest):
    try:
        return test_mbert_model(
            dataset_id=req.dataset_id,
            model_name=req.model_name,
            model_id=req.model_id,
            max_length=req.max_length,
            limit=req.limit,
            save_result=req.save_result,
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/predict", response_model=TestingPredictResponse)
def testing_predict(req: TestingPredictRequest):
    try:
        return predict_with_testing_model(
            algorithm=req.algorithm,
            model_name=req.model_name,
            text=req.text,
            max_length=req.max_length,
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/evaluation/best-models", response_model=EvaluationBestModelsResponse)
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
