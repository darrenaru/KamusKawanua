from typing import Any

from backend.model_testing_metrics import (
    build_testing_result_from_legacy_row,
    build_testing_result_from_model_row,
)
from backend.supabase_client import supabase
from backend.training_metrics import enrich_training_metrics
from backend.xlm_generation import filter_xlm_model_rows


def _to_float(value: Any, default: float = 0.0) -> float:
    try:
        return float(value)
    except Exception:
        return float(default)


def _fetch_legacy_testing_by_model_ids(model_ids: list[int]) -> dict[int, dict]:
    if not model_ids:
        return {}
    try:
        res = (
            supabase.table("testing_results")
            .select("*")
            .in_("model_id", model_ids)
            .order("created_at", desc=True)
            .execute()
        )
        rows = res.data or []
    except Exception:
        return {}
    by_model: dict[int, dict] = {}
    for row in rows:
        mid = row.get("model_id")
        if mid is None:
            continue
        try:
            mid_int = int(mid)
        except Exception:
            continue
        if mid_int not in by_model:
            by_model[mid_int] = row
    return by_model


def _attach_testing_result(
    merged: dict[str, Any], legacy_testing: dict[int, dict] | None = None
) -> None:
    """
    Sematkan metrik uji hanya di `testing_result` (nested).
    Prioritas: kolom test_* di baris model → tabel testing_results lama.
    Kolom training (accuracy, train_roc_auc, …) tidak diubah.
    """
    nested = build_testing_result_from_model_row(merged)
    if not nested and legacy_testing is not None:
        mid = merged.get("id")
        if mid is not None:
            legacy_row = legacy_testing.get(int(mid))
            nested = build_testing_result_from_legacy_row(legacy_row)
    if nested:
        merged["testing_result"] = nested


def _prepare_model_row(
    merged: dict[str, Any], legacy_testing: dict[int, dict] | None = None
) -> None:
    enrich_training_metrics(merged)
    _attach_testing_result(merged, legacy_testing)


def _is_final_training_mode(value: Any) -> bool:
    mode = str(value or "").strip().lower().replace("_", "-")
    return mode in {"training-final", "final-training", "final"}


def _canonical_algo_key(algoritma: str) -> str | None:
    """Match frontend column keys: indobert, mbert, xlm-r, word2vec, glove."""
    if not algoritma:
        return None
    k = str(algoritma).strip().lower().replace("_", "-")
    if k in ("indo-bert", "indobenchmark"):
        return "indobert"
    if k in ("m-bert", "multilingual-bert", "bert-base-multilingual-cased"):
        return "mbert"
    if k in ("xlm-r-2", "xlmr", "xlm-r"):
        return "xlm-r"
    if k in ("word2vec", "word-2-vec"):
        return "word2vec"
    if k == "glove":
        return "glove"
    return k or None


def get_best_models_by_algorithm() -> list[dict]:
    try:
        res = (
            supabase.table("models")
            .select("*")
            .order("created_at", desc=True)
            .execute()
        )
        rows = res.data or []
    except Exception as e:
        raise ValueError(f"Failed to fetch model evaluation data: {e}")

    dataset_ids = sorted(
        {
            int(row.get("dataset_id"))
            for row in rows
            if row.get("dataset_id") is not None
        }
    )
    dataset_name_map: dict[int, str] = {}
    if dataset_ids:
        try:
            dataset_res = (
                supabase.table("datasets")
                .select("id,name,file_name")
                .in_("id", dataset_ids)
                .execute()
            )
            for row in dataset_res.data or []:
                ds_id = row.get("id")
                if ds_id is None:
                    continue
                dataset_name_map[int(ds_id)] = (
                    row.get("name")
                    or row.get("file_name")
                    or f"Dataset {ds_id}"
                )
        except Exception:
            dataset_name_map = {}

    # Evaluasi hanya menggunakan model final-training.
    rows = [row for row in rows if _is_final_training_mode(row.get("mode"))]
    rows = filter_xlm_model_rows(rows)

    best_by_algorithm: dict[str, dict] = {}
    for row in rows:
        algorithm = str(row.get("algoritma") or "").strip()
        key = _canonical_algo_key(algorithm)
        if not key:
            continue
        model_id = row.get("id")
        model_name = str(row.get("nama_model") or "").strip()
        if model_id is None or not model_name:
            continue

        try:
            accuracy = float(row.get("accuracy"))
        except Exception:
            continue

        current = best_by_algorithm.get(key)
        if current is None or accuracy > float(current.get("accuracy") or 0):
            dataset_id = row.get("dataset_id")
            dataset_id_int = int(dataset_id) if dataset_id is not None else None
            merged = dict(row)
            merged["id"] = int(model_id)
            merged["algoritma"] = key
            merged["nama_model"] = model_name
            merged["canonical_algorithm"] = key
            merged["accuracy"] = accuracy
            merged["dataset_id"] = dataset_id_int
            merged["dataset_name"] = (
                dataset_name_map.get(dataset_id_int)
                if dataset_id_int is not None
                else None
            )
            merged["warmup_ratio"] = _to_float(merged.get("warmup_ratio"), 0.0)
            best_by_algorithm[key] = merged

    items = sorted(
        best_by_algorithm.values(),
        key=lambda x: float(x.get("accuracy") or 0),
        reverse=True,
    )

    legacy_map = _fetch_legacy_testing_by_model_ids(
        [int(row["id"]) for row in items if row.get("id") is not None]
    )
    for row in items:
        _prepare_model_row(row, legacy_map)

    return items


def get_models_metrics() -> list[dict]:
    """Return all models with normalized algorithm key, dataset name, and latest testing_result."""
    try:
        res = (
            supabase.table("models")
            .select("*")
            .order("created_at", desc=True)
            .execute()
        )
        rows = [row for row in list(res.data or []) if _is_final_training_mode(row.get("mode"))]
        rows = filter_xlm_model_rows(rows)
    except Exception as e:
        raise ValueError(f"Failed to fetch model metrics data: {e}")

    dataset_ids = sorted(
        {
            int(row.get("dataset_id"))
            for row in rows
            if row.get("dataset_id") is not None
        }
    )
    dataset_name_map: dict[int, str] = {}
    if dataset_ids:
        try:
            dataset_res = (
                supabase.table("datasets")
                .select("id,name,file_name")
                .in_("id", dataset_ids)
                .execute()
            )
            for row in dataset_res.data or []:
                ds_id = row.get("id")
                if ds_id is None:
                    continue
                dataset_name_map[int(ds_id)] = (
                    row.get("name")
                    or row.get("file_name")
                    or f"Dataset {ds_id}"
                )
        except Exception:
            dataset_name_map = {}

    model_ids = [int(r["id"]) for r in rows if r.get("id") is not None]
    legacy_map = _fetch_legacy_testing_by_model_ids(model_ids)

    out: list[dict] = []
    for row in rows:
        model_id = row.get("id")
        if model_id is None:
            continue

        algorithm = str(row.get("algoritma") or "").strip()
        key = _canonical_algo_key(algorithm)
        if not key:
            continue
        merged = dict(row)
        merged["id"] = int(model_id)
        merged["algoritma"] = key
        merged["canonical_algorithm"] = key

        dataset_id = row.get("dataset_id")
        dataset_id_int = int(dataset_id) if dataset_id is not None else None
        merged["dataset_id"] = dataset_id_int
        merged["dataset_name"] = (
            dataset_name_map.get(dataset_id_int)
            if dataset_id_int is not None
            else None
        )

        _prepare_model_row(merged, legacy_map)

        out.append(merged)

    return out


def get_model_epochs(model_id: int) -> list[dict]:
    """Return all epoch metrics for a specific model."""
    try:
        res = (
            supabase.table("model_epoch_metrics")
            .select("*")
            .eq("model_id", model_id)
            .order("epoch", desc=False)
            .execute()
        )
        return list(res.data or [])
    except Exception as e:
        raise ValueError(f"Failed to fetch model epoch metrics: {e}")
