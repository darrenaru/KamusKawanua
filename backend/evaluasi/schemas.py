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
    """Response containing epoch metrics for a specific model."""

    status: str
    total: int
    items: list[dict[str, Any]]
