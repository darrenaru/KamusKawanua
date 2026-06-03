"""Metrik testing disimpan di kolom `models` (bukan tabel testing_results)."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

# Kolom Supabase di tabel `models` → kunci nested `testing_result` (frontend/API).
_MODEL_TEST_COLUMN_TO_NEST_KEY: dict[str, str] = {
    "test_accuracy": "accuracy",
    "test_precision_macro": "precision_macro",
    "test_recall_macro": "recall_macro",
    "test_f1_macro": "f1_macro",
    "test_std_deviation": "std_deviation",
    "test_weighted_avg": "weighted_avg",
    "test_roc_auc": "roc_auc",
    "test_mcc": "mcc",
    "test_max_length": "max_length",
}


def _to_float(value: Any, default: float = 0.0) -> float:
    try:
        return float(value)
    except Exception:
        return float(default)


def _to_int(value: Any, default: int = 0) -> int:
    try:
        return int(value)
    except Exception:
        return int(default)


# Metrik persen: training di DB biasanya 0–100, testing sklearn 0–1.
_PERCENT_LIKE_NEST_KEYS = frozenset(
    {
        "accuracy",
        "precision_macro",
        "recall_macro",
        "f1_macro",
        "weighted_avg",
        "roc_auc",
    }
)


def normalize_stored_metric_for_display(value: Any, nest_key: str) -> float:
    """Satukan ke skala persen (0–100) untuk perbandingan dengan kolom training."""
    n = _to_float(value, 0.0)
    if nest_key in _PERCENT_LIKE_NEST_KEYS and 0.0 <= n <= 1.0:
        return n * 100.0
    return n


def model_row_has_testing_metrics(row: dict | None) -> bool:
    if not row:
        return False
    if row.get("test_accuracy") is not None:
        return True
    return any(
        row.get(col) is not None
        for col in _MODEL_TEST_COLUMN_TO_NEST_KEY
    )


def legacy_row_has_testing_metrics(row: dict | None) -> bool:
    if not row:
        return False
    return row.get("accuracy") is not None


def resolve_testing_metrics_nested(
    row: dict | None,
    legacy_row: dict | None = None,
) -> dict[str, Any]:
    """Prioritas: kolom test_* di models → baris lama testing_results."""
    nested = build_testing_result_from_model_row(row)
    if not nested and legacy_row:
        nested = build_testing_result_from_legacy_row(legacy_row)
    return nested


def has_saved_testing_metrics(
    row: dict | None,
    legacy_row: dict | None = None,
) -> bool:
    return model_row_has_testing_metrics(row) or legacy_row_has_testing_metrics(
        legacy_row
    )


def build_latest_testing_api_summary(
    *,
    row: dict | None,
    legacy_row: dict | None,
    dataset_id: int | None,
    dataset_name: str | None,
) -> dict[str, Any] | None:
    nested = resolve_testing_metrics_nested(row, legacy_row)
    if not nested:
        return None
    tested_at = nested.get("tested_at") or (
        legacy_row.get("created_at") if legacy_row else None
    )
    return {
        "dataset_id": dataset_id,
        "accuracy": nested.get("accuracy", 0.0),
        "precision_macro": nested.get("precision_macro", 0.0),
        "recall_macro": nested.get("recall_macro", 0.0),
        "f1_macro": nested.get("f1_macro", 0.0),
        "std_deviation": nested.get("std_deviation", 0.0),
        "weighted_avg": nested.get("weighted_avg", 0.0),
        "roc_auc": nested.get("roc_auc", 0.0),
        "mcc": nested.get("mcc", 0.0),
        "created_at": tested_at,
        "dataset_name": dataset_name,
    }


def build_testing_result_from_legacy_row(row: dict | None) -> dict[str, Any]:
    """Bangun nested testing_result dari baris lama `testing_results`."""
    if not row:
        return {}
    keys = (
        "accuracy",
        "precision_macro",
        "recall_macro",
        "f1_macro",
        "std_deviation",
        "weighted_avg",
        "roc_auc",
        "mcc",
        "max_length",
    )
    payload: dict[str, Any] = {}
    for key in keys:
        if row.get(key) is None:
            continue
        if key == "max_length":
            payload[key] = _to_int(row.get(key), 0)
        else:
            payload[key] = normalize_stored_metric_for_display(row.get(key), key)
    if row.get("created_at"):
        payload["tested_at"] = row.get("created_at")
    return payload


def build_testing_result_from_model_row(row: dict | None) -> dict[str, Any]:
    if not row or not model_row_has_testing_metrics(row):
        return {}
    payload: dict[str, Any] = {}
    for col, nest_key in _MODEL_TEST_COLUMN_TO_NEST_KEY.items():
        if row.get(col) is None:
            continue
        if nest_key == "max_length":
            payload[nest_key] = _to_int(row.get(col), 0)
        else:
            payload[nest_key] = normalize_stored_metric_for_display(
                row.get(col), nest_key
            )
    if row.get("tested_at"):
        payload["tested_at"] = row.get("tested_at")
    return payload


def build_model_update_from_testing_metrics(
    *,
    accuracy: float,
    precision_macro: float,
    recall_macro: float,
    f1_macro: float,
    std_deviation: float,
    weighted_avg: float,
    roc_auc: float,
    mcc: float,
    max_length: int | None = None,
) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "test_accuracy": float(accuracy),
        "test_precision_macro": float(precision_macro),
        "test_recall_macro": float(recall_macro),
        "test_f1_macro": float(f1_macro),
        "test_std_deviation": float(std_deviation),
        "test_weighted_avg": float(weighted_avg),
        "test_roc_auc": float(roc_auc),
        "test_mcc": float(mcc),
        "tested_at": datetime.now(timezone.utc).isoformat(),
    }
    if max_length is not None:
        payload["test_max_length"] = int(max_length)
    return payload
