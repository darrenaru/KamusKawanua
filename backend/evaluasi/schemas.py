from typing import Any

from pydantic import BaseModel


class EvaluationBestModelsResponse(BaseModel):
    """Items are full `models` rows (best per canonical algorithm) plus dataset_name."""

    status: str
    total: int
    items: list[dict[str, Any]]
