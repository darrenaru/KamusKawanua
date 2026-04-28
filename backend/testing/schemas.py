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
    results: list[IndoBertTestingResultItem]

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
    dataset_name: str
    model_id: int | None = None
    model_name: str
    total_data: int
    accuracy: float
    precision_macro: float
    recall_macro: float
    f1_macro: float
    results: list[IndoBertTestingResultItem]
