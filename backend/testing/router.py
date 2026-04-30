from fastapi import APIRouter, HTTPException

from backend.testing.schemas import (
    IndoBertTestingRequest,
    IndoBertTestingResponse,
    TestingModelListResponse,
)
from backend.testing.service import (
    get_available_testing_models,
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
