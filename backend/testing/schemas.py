from pydantic import BaseModel, Field


class IndoBertTestingRequest(BaseModel):
    dataset_id: int = Field(..., ge=1)
    model_name: str = Field(..., min_length=1, max_length=80)
    model_id: int | None = Field(None, ge=1)
    max_length: int = Field(64, ge=8, le=512)
    limit: int | None = Field(None, ge=1)
    save_result: bool = True


class IndoBertTestingResultItem(BaseModel):
    id: int
    id_kata: str | None = None
    text: str
    actual: str
    predicted: str
    score: float
    correct: bool


class IndoBertTestingResponse(BaseModel):
    status: str
    testing_result_id: int | None = None
    dataset_id: int
    dataset_name: str | None = None
    model_id: int | None = None
    model_name: str
    total_data: int
    accuracy: float
    precision_macro: float
    recall_macro: float
    f1_macro: float
    std_deviation: float
    weighted_avg: float
    roc_auc: float
    mcc: float
    results: list[IndoBertTestingResultItem]


class TestingLatestResultSummary(BaseModel):
    id: int | None = None
    dataset_id: int | None = None
    dataset_name: str | None = None
    accuracy: float
    precision_macro: float
    recall_macro: float
    f1_macro: float
    std_deviation: float
    weighted_avg: float
    roc_auc: float
    mcc: float
    created_at: str | None = None


class TestingModelItem(BaseModel):
    id: int
    nama_model: str
    algoritma: str
    dataset_id: int | None = None
    dataset_name: str | None = None
    max_length: int | None = None
    created_at: str | None = None
    latest_testing: TestingLatestResultSummary | None = None


class TestingModelListResponse(BaseModel):
    status: str
    total: int
    items: list[TestingModelItem]


class TestingPredictRequest(BaseModel):
    algorithm: str = Field(..., min_length=1)
    model_name: str = Field(..., min_length=1, max_length=80)
    text: str = Field(..., min_length=1)
    max_length: int = Field(64, ge=8, le=512)


class TestingPredictResponse(BaseModel):
    status: str
    algorithm: str
    model_name: str
    text: str
    label: str
    score: float
    probs: dict[str, float]


class EvaluationBestModelItem(BaseModel):
    id: int
    algoritma: str
    nama_model: str
    dataset_id: int | None = None
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
