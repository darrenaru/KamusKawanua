from backend.supabase_client import supabase


def get_best_models_by_algorithm() -> list[dict]:
    try:
        res = (
            supabase.table("models")
            .select(
                "id,nama_model,algoritma,dataset_id,split_ratio,accuracy,precision,recall,f1_score,created_at"
            )
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
        if not algorithm:
            continue

        model_id = row.get("id")
        model_name = str(row.get("nama_model") or "").strip()
        if model_id is None or not model_name:
            continue

        try:
            accuracy = float(row.get("accuracy"))
        except Exception:
            continue

        key = algorithm.lower()
        current = best_by_algorithm.get(key)
        if current is None or accuracy > current["accuracy"]:
            dataset_id = row.get("dataset_id")
            dataset_id_int = int(dataset_id) if dataset_id is not None else None
            best_by_algorithm[key] = {
                "id": int(model_id),
                "algoritma": algorithm,
                "nama_model": model_name,
                "dataset_id": dataset_id_int,
                "dataset_name": (
                    dataset_name_map.get(dataset_id_int)
                    if dataset_id_int is not None
                    else None
                ),
                "split_ratio": row.get("split_ratio"),
                "accuracy": accuracy,
                "precision": (
                    float(row.get("precision"))
                    if row.get("precision") is not None
                    else None
                ),
                "recall": (
                    float(row.get("recall"))
                    if row.get("recall") is not None
                    else None
                ),
                "f1_score": (
                    float(row.get("f1_score"))
                    if row.get("f1_score") is not None
                    else None
                ),
                "created_at": row.get("created_at"),
            }

    return sorted(best_by_algorithm.values(), key=lambda x: x["accuracy"], reverse=True)
