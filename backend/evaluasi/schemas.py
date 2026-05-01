from pydantic import BaseModel


class EvaluationBestModelItem(BaseModel):
    id: int
    algoritma: str
    nama_model: str
    dataset_id: int | None = None
    dataset_name: str | None = None
    split_ratio: str | None = None
    accuracy: float
    precision: float | None = None
    recall: float | None = None
    f1_score: float | None = None
    created_at: str | None = None


class EvaluationBestModelsResponse(BaseModel):
    status: str
    total: int
    items: list[EvaluationBestModelItem]
