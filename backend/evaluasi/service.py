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
    """Match frontend column keys: indobert, mbert, xlm-r, word2vec, glove."""
    if not algoritma:
        return None
    k = str(algoritma).strip().lower().replace("_", "-")
    if k in ("indo-bert", "indobenchmark"):
        return "indobert"
    if k in ("m-bert", "multilingual-bert", "bert-base-multilingual-cased"):
        return "mbert"
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
            for fld in (
                "precision",
                "recall",
                "f1_score",
                "train_loss",
                "train_mcc",
                "warmup_ratio",
            ):
                if merged.get(fld) is not None:
                    try:
                        merged[fld] = float(merged[fld])
                    except Exception:
                        pass
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
        if not tr:
            continue
        nested: dict[str, Any] = {}
        for k in _TESTING_NEST_KEYS:
            if tr.get(k) is None:
                continue
            try:
                if k == "max_length":
                    nested[k] = int(tr[k])
                else:
                    nested[k] = float(tr[k])
            except Exception:
                continue
        if nested:
            row["testing_result"] = nested

    return items
