from backend.supabase_client import supabase


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
            for fld in ("precision", "recall", "f1_score", "mcc", "roc_auc"):
                if merged.get(fld) is not None:
                    try:
                        merged[fld] = float(merged[fld])
                    except Exception:
                        pass
            best_by_algorithm[key] = merged

    return sorted(best_by_algorithm.values(), key=lambda x: float(x.get("accuracy") or 0), reverse=True)
