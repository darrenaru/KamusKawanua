import os
import threading

from fastapi import APIRouter, HTTPException

from backend.processing.schemas import (
    IndoBertPredictRequest,
    IndoBertPredictResponse,
    IndoBertTrainRequest,
    IndoBertTrainResponse,
)
from backend.checkpoint_verify import verify_trained_model_dir
from backend.processing.service import (
    _safe_name,
    predict_indobert_softmax,
    predict_mbert_softmax,
    predict_xlm_r_softmax,
    train_indobert_softmax,
    train_mbert_softmax,
    train_xlm_r_softmax,
)
from backend.processing.progress import append_metric, create_job, get_job, update_job


router = APIRouter(prefix="/processing", tags=["processing"])


@router.post("/train/indobert", response_model=IndoBertTrainResponse)
def train_indobert(req: IndoBertTrainRequest):
    try:
        result = train_indobert_softmax(
            dataset_id=req.dataset_id,
            model_name=req.model_name,
            split_ratio=req.split_ratio,
            lr=req.lr,
            epoch=req.epoch,
            batch_size=req.batch_size,
            max_length=req.max_length,
            weight_decay=req.weight_decay,
            warmup_ratio=req.warmup_ratio,
            dropout=req.dropout,
            grad_accum=req.grad_accum,
            early_stopping_patience=req.early_stopping_patience,
            seed=req.seed,
            fast_mode=req.fast_mode,
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/train/indobert/async")
def train_indobert_async(req: IndoBertTrainRequest):
    job = create_job(total_epochs=req.epoch)

    def _run():
        update_job(job.job_id, status="running", message="starting")
        try:
            result = train_indobert_softmax(
                dataset_id=req.dataset_id,
                model_name=req.model_name,
                split_ratio=req.split_ratio,
                lr=req.lr,
                epoch=req.epoch,
                batch_size=req.batch_size,
                max_length=req.max_length,
                weight_decay=req.weight_decay,
                warmup_ratio=req.warmup_ratio,
                dropout=req.dropout,
                grad_accum=req.grad_accum,
                early_stopping_patience=req.early_stopping_patience,
                seed=req.seed,
                fast_mode=req.fast_mode,
                on_epoch_end=lambda m: append_metric(job.job_id, m),
            )
            update_job(job.job_id, status="done", result=result, message="done")
        except Exception as e:
            update_job(job.job_id, status="error", error=str(e), message="error")

    t = threading.Thread(target=_run, daemon=True)
    t.start()
    return {"job_id": job.job_id, "status": job.status, "total_epochs": req.epoch}


@router.get("/train/status/{job_id}")
def train_status(job_id: str):
    job = get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="job_id not found")
    return {
        "job_id": job.job_id,
        "status": job.status,
        "message": job.message,
        "total_epochs": job.total_epochs,
        "current_epoch": job.current_epoch,
        "metrics": job.metrics,
        "result": job.result if job.status == "done" else None,
        "error": job.error if job.status == "error" else None,
    }


@router.post("/predict/indobert", response_model=IndoBertPredictResponse)
def predict_indobert(req: IndoBertPredictRequest):
    try:
        return predict_indobert_softmax(
            text=req.text, model_name=req.model_name, max_length=req.max_length
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/train/mbert", response_model=IndoBertTrainResponse)
def train_mbert(req: IndoBertTrainRequest):
    try:
        result = train_mbert_softmax(
            dataset_id=req.dataset_id,
            model_name=req.model_name,
            split_ratio=req.split_ratio,
            lr=req.lr,
            epoch=req.epoch,
            batch_size=req.batch_size,
            max_length=req.max_length,
            weight_decay=req.weight_decay,
            warmup_ratio=req.warmup_ratio,
            dropout=req.dropout,
            grad_accum=req.grad_accum,
            early_stopping_patience=req.early_stopping_patience,
            seed=req.seed,
            fast_mode=req.fast_mode,
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/train/mbert/async")
def train_mbert_async(req: IndoBertTrainRequest):
    job = create_job(total_epochs=req.epoch)

    def _run():
        update_job(job.job_id, status="running", message="starting")
        try:
            result = train_mbert_softmax(
                dataset_id=req.dataset_id,
                model_name=req.model_name,
                split_ratio=req.split_ratio,
                lr=req.lr,
                epoch=req.epoch,
                batch_size=req.batch_size,
                max_length=req.max_length,
                weight_decay=req.weight_decay,
                warmup_ratio=req.warmup_ratio,
                dropout=req.dropout,
                grad_accum=req.grad_accum,
                early_stopping_patience=req.early_stopping_patience,
                seed=req.seed,
                fast_mode=req.fast_mode,
                on_epoch_end=lambda m: append_metric(job.job_id, m),
            )
            update_job(job.job_id, status="done", result=result, message="done")
        except Exception as e:
            update_job(job.job_id, status="error", error=str(e), message="error")

    t = threading.Thread(target=_run, daemon=True)
    t.start()
    return {"job_id": job.job_id, "status": job.status, "total_epochs": req.epoch}


@router.post("/predict/mbert", response_model=IndoBertPredictResponse)
def predict_mbert(req: IndoBertPredictRequest):
    try:
        return predict_mbert_softmax(
            text=req.text, model_name=req.model_name, max_length=req.max_length
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/train/xlm-r", response_model=IndoBertTrainResponse)
@router.post("/train/xlm-r-2", response_model=IndoBertTrainResponse, include_in_schema=False)
def train_xlm_r(req: IndoBertTrainRequest):
    try:
        result = train_xlm_r_softmax(
            dataset_id=req.dataset_id,
            model_name=req.model_name,
            split_ratio=req.split_ratio,
            lr=req.lr,
            epoch=req.epoch,
            batch_size=req.batch_size,
            max_length=req.max_length,
            weight_decay=req.weight_decay,
            warmup_ratio=req.warmup_ratio,
            dropout=req.dropout,
            grad_accum=req.grad_accum,
            early_stopping_patience=req.early_stopping_patience,
            seed=req.seed,
            fast_mode=req.fast_mode,
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/train/xlm-r/async")
@router.post("/train/xlm-r-2/async", include_in_schema=False)
def train_xlm_r_async(req: IndoBertTrainRequest):
    job = create_job(total_epochs=req.epoch)

    def _run():
        update_job(job.job_id, status="running", message="starting")
        try:
            result = train_xlm_r_softmax(
                dataset_id=req.dataset_id,
                model_name=req.model_name,
                split_ratio=req.split_ratio,
                lr=req.lr,
                epoch=req.epoch,
                batch_size=req.batch_size,
                max_length=req.max_length,
                weight_decay=req.weight_decay,
                warmup_ratio=req.warmup_ratio,
                dropout=req.dropout,
                grad_accum=req.grad_accum,
                early_stopping_patience=req.early_stopping_patience,
                seed=req.seed,
                fast_mode=req.fast_mode,
                on_epoch_end=lambda m: append_metric(job.job_id, m),
            )
            update_job(job.job_id, status="done", result=result, message="done")
        except Exception as e:
            update_job(job.job_id, status="error", error=str(e), message="error")

    t = threading.Thread(target=_run, daemon=True)
    t.start()
    return {"job_id": job.job_id, "status": job.status, "total_epochs": req.epoch}


@router.post("/predict/xlm-r", response_model=IndoBertPredictResponse)
@router.post("/predict/xlm-r-2", response_model=IndoBertPredictResponse, include_in_schema=False)
def predict_xlm_r(req: IndoBertPredictRequest):
    try:
        return predict_xlm_r_softmax(
            text=req.text, model_name=req.model_name, max_length=req.max_length
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/checkpoint/{model_name}/verify")
def verify_checkpoint(model_name: str):
    """Check that a trained_models folder has the files needed for predict/test."""
    base_dir = os.path.dirname(os.path.abspath(__file__))
    model_root = os.path.abspath(os.path.join(base_dir, "..", "trained_models"))
    model_dir = os.path.join(model_root, _safe_name(model_name))
    return verify_trained_model_dir(model_dir)

