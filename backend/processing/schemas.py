from pydantic import BaseModel, Field


class IndoBertTrainRequest(BaseModel):
    dataset_id: int = Field(..., ge=1)
    model_name: str = Field(..., min_length=1, max_length=80)

    # data split: "80:20"
    split_ratio: str = Field("80:20", pattern=r"^\d{1,2}:\d{1,2}$")
    mode: str = Field("training-final", pattern=r"^(cari-rasio|training-final)$")

    # training params
    lr: float = Field(2e-5, gt=0)
    epoch: int = Field(3, ge=1, le=100)
    batch_size: int = Field(16, ge=1, le=256)
    max_length: int = Field(64, ge=8, le=512)

    weight_decay: float = Field(0.01, ge=0)
    warmup_ratio: float = Field(0.1, ge=0, le=1)
    dropout: float = Field(0.1, ge=0, le=0.9)
    grad_accum: int = Field(1, ge=1, le=64)
    early_stopping_patience: int = Field(0, ge=0, le=20)


class IndoBertEpochMetrics(BaseModel):
    epoch: int
    train_loss: float
    val_loss: float
    accuracy: float
    precision_macro: float
    recall_macro: float
    f1_macro: float
    mcc: float = 0.0
    confusion_matrix: list[list[int]] | None = None
    confusion_labels: list[str] | None = None


class IndoBertTrainResponse(BaseModel):
    status: str
    device: str
    num_labels: int
    label2id: dict[str, int]
    id2label: dict[int, str]
    label_counts: dict[str, int] | None = None
    metrics: list[IndoBertEpochMetrics]
    model_dir: str


class IndoBertPredictRequest(BaseModel):
    text: str = Field(..., min_length=1)
    model_name: str = Field(..., min_length=1, max_length=80)
    max_length: int = Field(64, ge=8, le=512)


class IndoBertPredictResponse(BaseModel):
    label: str
    score: float
    probs: dict[str, float]


class IndoBertTestRequest(BaseModel):
    dataset_id: int = Field(..., ge=1)
    model_name: str = Field(..., min_length=1, max_length=80)
    model_id: int | None = Field(None, ge=1)
    max_length: int = Field(64, ge=8, le=512)
    limit: int | None = Field(None, ge=1)
    save_result: bool = True


class IndoBertTestResultItem(BaseModel):
    id: int
    id_kata: str | None = None
    text: str
    actual: str
    predicted: str
    score: float
    correct: bool


class IndoBertTestResponse(BaseModel):
    status: str
    testing_result_id: int | None = None
    dataset_id: int
    dataset_name: str
    model_id: int | None = None
    model_name: str
    total_data: int
    accuracy: float
    precision_macro: float
    recall_macro: float
    f1_macro: float
    results: list[IndoBertTestResultItem]

