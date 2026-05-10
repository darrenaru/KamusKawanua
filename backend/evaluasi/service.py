from typing import Any

from backend.supabase_client import supabase

# Metrik testing: hanya disematkan di `testing_result` agar tidak menimpa
# kolom training di baris `models` (train_loss, train_mcc, accuracy, dll.).
_TESTING_NEST_KEYS = (
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


def _build_testing_result_payload(row: dict | None) -> dict[str, Any]:
    if not row:
        return {}
    payload: dict[str, Any] = {}
    for key in _TESTING_NEST_KEYS:
        if key == "max_length":
            payload[key] = _to_int(row.get(key), 0)
        else:
            payload[key] = _to_float(row.get(key), 0.0)
    return payload


def _fill_training_metrics_with_fallback(
    merged: dict[str, Any], testing_result: dict[str, Any] | None
) -> None:
    testing_result = testing_result or {}
    merged["accuracy"] = _to_float(
        merged.get("accuracy"),
        testing_result.get("accuracy", 0.0),
    )
    merged["precision"] = _to_float(
        merged.get("precision"),
        testing_result.get("precision_macro", 0.0),
    )
    merged["recall"] = _to_float(
        merged.get("recall"),
        testing_result.get("recall_macro", 0.0),
    )
    merged["f1_score"] = _to_float(
        merged.get("f1_score"),
        testing_result.get("f1_macro", 0.0),
    )
    if merged.get("macro_avg") is None:
        merged["macro_avg"] = (
            merged["precision"] + merged["recall"] + merged["f1_score"]
        ) / 3.0
    else:
        merged["macro_avg"] = _to_float(merged.get("macro_avg"), 0.0)
    merged["train_loss"] = _to_float(merged.get("train_loss"), 0.0)
    merged["train_mcc"] = _to_float(
        merged.get("train_mcc"),
        testing_result.get("mcc", 0.0),
    )


def _is_final_training_mode(value: Any) -> bool:
    mode = str(value or "").strip().lower().replace("_", "-")
    return mode in {"training-final", "final-training", "final"}


def _fetch_latest_testing_by_model_ids(model_ids: list[int]) -> dict[int, dict]:
    """Ambil baris testing_results terbaru per model_id (untuk metrik uji coba)."""
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


def _canonical_algo_key(algoritma: str) -> str | None:
    """Match frontend column keys: indobert, mbert, xlm-r-2, word2vec, glove."""
    if not algoritma:
        return None
    k = str(algoritma).strip().lower().replace("_", "-")
    if k in ("indo-bert", "indobenchmark"):
        return "indobert"
    if k in ("m-bert", "multilingual-bert", "bert-base-multilingual-cased"):
        return "mbert"
    if k == "xlm-r-2":
        return "xlm-r-2"
    if k in ("xlmr", "xlm-r"):
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

    best_by_algorithm: dict[str, dict] = {}
    for row in rows:
        algorithm = str(row.get("algoritma") or "").strip()
        key = _canonical_algo_key(algorithm)
        if not key:
            continue
        # Shared Supabase: kolom XLM di situs ini memakai xlm-r-2; abaikan bucket xlm-r (mitra).
        if key == "xlm-r":
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
            merged["algoritma"] = algorithm
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

    model_ids = [
        int(row["id"])
        for row in items
        if row.get("id") is not None
    ]
    testing_map = _fetch_latest_testing_by_model_ids(model_ids)

    for row in items:
        mid = row.get("id")
        if mid is None:
            continue
        tr = testing_map.get(int(mid))
        nested = _build_testing_result_payload(tr)
        _fill_training_metrics_with_fallback(row, nested)
        if nested:
            row["testing_result"] = nested

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
    testing_map = _fetch_latest_testing_by_model_ids(model_ids)

    out: list[dict] = []
    for row in rows:
        model_id = row.get("id")
        if model_id is None:
            continue

        algorithm = str(row.get("algoritma") or "").strip()
        key = _canonical_algo_key(algorithm)
        if not key:
            continue
        if key == "xlm-r":
            continue

        merged = dict(row)
        merged["id"] = int(model_id)
        merged["algoritma"] = algorithm
        merged["canonical_algorithm"] = key

        dataset_id = row.get("dataset_id")
        dataset_id_int = int(dataset_id) if dataset_id is not None else None
        merged["dataset_id"] = dataset_id_int
        merged["dataset_name"] = (
            dataset_name_map.get(dataset_id_int)
            if dataset_id_int is not None
            else None
        )

        tr = testing_map.get(int(model_id))
        nested = _build_testing_result_payload(tr)
        _fill_training_metrics_with_fallback(merged, nested)
        if nested:
            merged["testing_result"] = nested

        out.append(merged)

    return out
