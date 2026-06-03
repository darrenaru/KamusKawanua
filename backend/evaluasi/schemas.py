from typing import Any

from pydantic import BaseModel


class EvaluationBestModelsResponse(BaseModel):
    """Items are full `models` rows (best per canonical algorithm) plus dataset_name."""

    status: str
    total: int
    items: list[dict[str, Any]]


class EvaluationModelsMetricsResponse(BaseModel):
    """Items are full `models` rows plus canonical algorithm, dataset name, and latest testing_result."""

    status: str
    total: int
    items: list[dict[str, Any]]


class ModelEpochMetricsResponse(BaseModel):
    """Per-epoch training metrics for one model (`model_epoch_metrics`)."""

    status: str
    total: int
    items: list[dict[str, Any]]


class TrainingLogLookupResponse(BaseModel):
    """Latest training_logs entry for a model name (+ optional algorithm filter)."""

    status: str
    log: dict[str, Any] | None
