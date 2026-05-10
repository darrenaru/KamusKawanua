from __future__ import annotations

import json
import os
from typing import Any

import numpy as np
import torch
from sklearn.model_selection import train_test_split
from sklearn.metrics import (
    accuracy_score,
    matthews_corrcoef,
    precision_recall_fscore_support,
    roc_auc_score,
)
from sklearn.preprocessing import label_binarize
from transformers import AutoModelForSequenceClassification, AutoTokenizer

from backend.processing.service import (
    _build_text,
    _fetch_preprocessed_rows,
    _parse_ratio,
    _safe_name,
    predict_indobert_softmax,
    predict_mbert_softmax,
)
from backend.supabase_client import supabase


def _normalize_class_key(s: str) -> str:
    return " ".join(str(s or "").strip().split()).casefold()


def _canonical_dataset_label(
    raw: str, label2id: dict[str, Any]
) -> str | None:
    """Align dataset `jenis` strings with model label2id (spacing + case)."""
    s = str(raw or "").strip()
    if not s:
        return None
    key = _normalize_class_key(s)
    for lab in label2id.keys():
        lab_s = str(lab).strip()
        if lab_s == s or _normalize_class_key(lab_s) == key:
            return lab_s
    return None


def _multiclass_roc_auc_weighted(
    y_true: list[str],
    y_proba: np.ndarray,
    class_order: list[str],
) -> float:
    """ROC-AUC OVR weighted; robust when sklearn string-label path fails."""
    if y_proba.size == 0 or len(class_order) < 2:
        return 0.0
    classes = list(class_order)
    cls_index = {c: i for i, c in enumerate(classes)}
    y_list = list(y_true)
    mask = np.array([y in cls_index for y in y_list], dtype=bool)
    if not mask.any() or int(mask.sum()) < 2:
        return 0.0
    y_f = [y_list[i] for i in range(len(y_list)) if mask[i]]
    p_f = y_proba[mask]
    present = sorted({c for c in y_f if c in cls_index})
    if len(present) < 2:
        return 0.0
    col_ix = [cls_index[c] for c in present]
    p_sub = p_f[:, col_ix]
    present_to_sub = {c: i for i, c in enumerate(present)}
    try:
        if len(present) == 2:
            # label_binarize hanya mengembalikan 1 kolom untuk kasus biner; pakai skor kelas positif.
            y01 = np.array([present_to_sub[c] for c in y_f], dtype=int)
            return float(roc_auc_score(y01, p_sub[:, 1]))
        y_bin = label_binarize(y_f, classes=present)
        return float(
            roc_auc_score(
                y_bin,
                p_sub,
                average="weighted",
                multi_class="ovr",
            )
        )
    except Exception:
        return 0.0


def get_available_testing_models() -> list[dict]:
    try:
        models_res = (
            supabase.table("models")
            .select("id,nama_model,algoritma,mode,dataset_id,split_ratio,accuracy,max_length,created_at")
            .order("created_at", desc=True)
            .execute()
        )
        raw_models = models_res.data or []
    except Exception as e:
        raise ValueError(f"Failed to fetch model data: {e}")

    def is_final_training_mode(value: Any) -> bool:
        mode = str(value or "").strip().lower().replace("_", "-")
        return mode in {"training-final", "final-training", "final"}

    # Testing dropdown must only list final-training models.
    models = [row for row in raw_models if is_final_training_mode(row.get("mode"))]

    dataset_ids = sorted(
        {
            int(row.get("dataset_id"))
            for row in models
            if row.get("dataset_id") is not None
        }
    )

    dataset_name_map: dict[int, str] = {}
    if dataset_ids:
        try:
            ds_res = (
                supabase.table("datasets")
                .select("id,name,file_name")
                .in_("id", dataset_ids)
                .execute()
            )
            for row in ds_res.data or []:
                ds_id = row.get("id")
                if ds_id is None:
                    continue
                dataset_name_map[int(ds_id)] = row.get("name") or row.get("file_name") or f"Dataset {ds_id}"
        except Exception:
            dataset_name_map = {}

    latest_testing_by_model_dataset: dict[tuple[int, int], dict[str, Any]] = {}
    model_ids = sorted({int(row.get("id")) for row in models if row.get("id") is not None})
    testing_dataset_ids: set[int] = set()
    if model_ids:
        try:
            testing_res = (
                supabase.table("testing_results")
                .select(
                    "id,model_id,dataset_id,accuracy,precision_macro,recall_macro,f1_macro,std_deviation,weighted_avg,roc_auc,mcc,created_at"
                )
                .in_("model_id", model_ids)
                .order("created_at", desc=True)
                .execute()
            )
            for row in testing_res.data or []:
                model_id_raw = row.get("model_id")
                dataset_id_raw = row.get("dataset_id")
                if model_id_raw is None or dataset_id_raw is None:
                    continue
                dataset_id_int = int(dataset_id_raw)
                key = (int(model_id_raw), dataset_id_int)
                if key in latest_testing_by_model_dataset:
                    continue
                testing_dataset_ids.add(dataset_id_int)
                latest_testing_by_model_dataset[key] = {
                    "id": row.get("id"),
                    "dataset_id": dataset_id_int,
                    "accuracy": float(row.get("accuracy") or 0),
                    "precision_macro": float(row.get("precision_macro") or 0),
                    "recall_macro": float(row.get("recall_macro") or 0),
                    "f1_macro": float(row.get("f1_macro") or 0),
                    "std_deviation": float(row.get("std_deviation") or 0),
                    "weighted_avg": float(row.get("weighted_avg") or 0),
                    "roc_auc": float(row.get("roc_auc") or 0),
                    "mcc": float(row.get("mcc") or 0),
                    "created_at": row.get("created_at"),
                }
        except Exception:
            latest_testing_by_model_dataset = {}

    all_dataset_ids = sorted(set(dataset_ids) | testing_dataset_ids)
    if all_dataset_ids:
        try:
            ds_all_res = (
                supabase.table("datasets")
                .select("id,name,file_name")
                .in_("id", all_dataset_ids)
                .execute()
            )
            for row in ds_all_res.data or []:
                ds_id = row.get("id")
                if ds_id is None:
                    continue
                dataset_name_map[int(ds_id)] = (
                    row.get("name") or row.get("file_name") or f"Dataset {ds_id}"
                )
        except Exception:
            pass

    for summary in latest_testing_by_model_dataset.values():
        ds_id = summary.get("dataset_id")
        summary["dataset_name"] = dataset_name_map.get(int(ds_id)) if ds_id is not None else None

    items: list[dict] = []
    for row in models:
        model_id = row.get("id")
        if model_id is None:
            continue

        dataset_id_raw = row.get("dataset_id")
        dataset_id = int(dataset_id_raw) if dataset_id_raw is not None else None

        model_name = str(row.get("nama_model") or "").strip()
        # Untuk dropdown, tampilkan semua model yang tercatat di database.
        # Validasi keberadaan folder model tetap dilakukan saat endpoint testing dijalankan.
        if not model_name:
            continue

        items.append(
            {
                "id": int(model_id),
                "nama_model": model_name,
                "algoritma": str(row.get("algoritma") or "Unknown").strip() or "Unknown",
                "dataset_id": dataset_id,
                "dataset_name": dataset_name_map.get(dataset_id) if dataset_id is not None else None,
                "split_ratio": str(row.get("split_ratio") or "").strip() or None,
                "training_accuracy": (
                    float(row.get("accuracy")) if row.get("accuracy") is not None else None
                ),
                "max_length": row.get("max_length"),
                "created_at": row.get("created_at"),
                "latest_testing": latest_testing_by_model_dataset.get((int(model_id), int(dataset_id)))
                if dataset_id is not None
                else None,
            }
        )

    return items


def _get_dataset_name(dataset_id: int) -> str | None:
    try:
        res = (
            supabase.table("datasets")
            .select("name,file_name")
            .eq("id", dataset_id)
            .range(0, 0)
            .execute()
        )
        row = (res.data or [None])[0]
        if not row:
            return None
        return row.get("name") or row.get("file_name")
    except Exception:
        return None


def _insert_testing_result(payload: dict[str, Any]) -> int | None:
    try:
        res = supabase.table("testing_results").insert(payload).execute()
        data = res.data or []
        print("INSERT RESPONSE:", data)
        testing_result_id = None
        if data and len(data) > 0:
            testing_result_id = data[0].get("id")
        return int(testing_result_id) if testing_result_id is not None else None
    except Exception as e:
        print("INSERT ERROR:", str(e))
        raise ValueError(f"Failed to save to testing_results: {e}")


def _get_model_split_ratio(
    *,
    model_id: int | None,
    model_name: str,
) -> str:
    """Resolve split_ratio from selected model; fallback to default training ratio."""
    default_ratio = "80:20"
    try:
        query = (
            supabase.table("models")
            .select("split_ratio")
            .order("created_at", desc=True)
        )
        if model_id is not None:
            query = query.eq("id", model_id).range(0, 0)
        else:
            query = query.eq("nama_model", model_name).range(0, 0)
        res = query.execute()
        row = (res.data or [None])[0]
        ratio = str((row or {}).get("split_ratio") or "").strip()
        if not ratio:
            return default_ratio
        # Validasi format rasio agar aman dipakai splitting.
        _parse_ratio(ratio)
        return ratio
    except Exception:
        return default_ratio


def _get_model_seed(
    *,
    model_id: int | None,
    model_name: str,
) -> int:
    default_seed = 42
    try:
        query = (
            supabase.table("models")
            .select("seed")
            .order("created_at", desc=True)
        )
        if model_id is not None:
            query = query.eq("id", model_id).range(0, 0)
        else:
            query = query.eq("nama_model", model_name).range(0, 0)
        res = query.execute()
        row = (res.data or [None])[0]
        seed_raw = (row or {}).get("seed")
        if seed_raw is None:
            return default_seed
        seed_val = int(seed_raw)
        return seed_val if seed_val >= 0 else default_seed
    except Exception:
        return default_seed


def _load_model_holdout_row_ids(
    *,
    model_name: str,
    dataset_id: int,
) -> set[str]:
    """Load exact validation/test rows saved during training."""
    try:
        base_dir = os.path.dirname(os.path.abspath(__file__))
        model_root = os.path.abspath(os.path.join(base_dir, "..", "trained_models"))
        model_dir = os.path.join(model_root, _safe_name(model_name))
        holdout_path = os.path.join(model_dir, "model_holdout.json")
        if not os.path.isfile(holdout_path):
            return set()
        with open(holdout_path, "r", encoding="utf-8") as f:
            payload = json.load(f) or {}
        payload_dataset_id = payload.get("dataset_id")
        if payload_dataset_id is not None and int(payload_dataset_id) != int(dataset_id):
            return set()
        ids = payload.get("val_row_ids") or []
        return {str(x).strip() for x in ids if str(x).strip()}
    except Exception:
        return set()


def _select_testing_rows_by_model_ratio(
    valid_rows: list[dict],
    split_ratio: str,
    *,
    random_state: int = 42,
) -> list[dict]:
    """Pick only test partition rows so testing follows selected model ratio."""
    if not valid_rows:
        return valid_rows

    _, test_frac = _parse_ratio(split_ratio)
    if test_frac <= 0:
        return []
    if test_frac >= 1 or len(valid_rows) == 1:
        return valid_rows

    idx_all = np.arange(len(valid_rows))
    labels = [str(item.get("actual") or "").strip() for item in valid_rows]
    can_stratify = len(set(labels)) > 1

    try:
        _, test_idx = train_test_split(
            idx_all,
            test_size=test_frac,
            random_state=random_state,
            shuffle=True,
            stratify=labels if can_stratify else None,
        )
    except ValueError:
        # Fallback non-stratified jika distribusi kelas tidak memungkinkan stratify split.
        _, test_idx = train_test_split(
            idx_all,
            test_size=test_frac,
            random_state=random_state,
            shuffle=True,
            stratify=None,
        )

    test_idx = np.array(test_idx)
    return [valid_rows[int(i)] for i in test_idx.tolist()]


def test_indobert_model(
    *,
    dataset_id: int,
    model_name: str,
    model_id: int | None,
    max_length: int,
    limit: int | None,
    save_result: bool,
) -> dict:
    rows = _fetch_preprocessed_rows(dataset_id)
    if not rows:
        raise ValueError("Dataset not found or preprocessed_data is empty for this dataset_id.")

    valid_rows: list[dict] = []
    for row in rows:
        label = str(row.get("jenis") or "").strip()
        if not label:
            continue
        text = _build_text(row)
        if not text:
            continue
        valid_rows.append(
            {
                "row": row,
                "text": text,
                "actual": label,
            }
        )

    if not valid_rows:
        raise ValueError("No valid rows found (columns 'jenis' and text input must be filled).")

    if limit:
        valid_rows = valid_rows[:limit]

    holdout_row_ids = _load_model_holdout_row_ids(
        model_name=model_name,
        dataset_id=dataset_id,
    )
    if not holdout_row_ids:
        raise ValueError(
            "Model holdout test set was not found. "
            "Retrain this model so testing uses the exact holdout split from training."
        )

    holdout_rows: list[dict] = []
    for item in valid_rows:
        row = item.get("row") or {}
        row_key = str(row.get("id_kata") or row.get("id") or "").strip()
        if row_key and row_key in holdout_row_ids:
            holdout_rows.append(item)
    valid_rows = holdout_rows

    if not valid_rows:
        raise ValueError(
            "No rows matched the model holdout test set. "
            "Make sure dataset is unchanged and retrain model if needed."
        )

    base_dir = os.path.dirname(os.path.abspath(__file__))
    model_root = os.path.abspath(os.path.join(base_dir, "..", "trained_models"))
    model_dir = os.path.join(model_root, _safe_name(model_name))
    if not os.path.isdir(model_dir):
        raise ValueError(
            f"Model '{model_name}' was not found in trained_models. "
            "Ensure model_name is correct and the model has been trained."
        )

    tokenizer = AutoTokenizer.from_pretrained(model_dir)
    model = AutoModelForSequenceClassification.from_pretrained(model_dir)
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    model.to(device)
    model.eval()
    if device.type == "cuda":
        # Optimisasi minor untuk GPU
        torch.backends.cudnn.benchmark = True

    id2label_cfg = model.config.id2label or {}
    label2id_cfg: dict[str, Any] = dict(model.config.label2id or {})
    if label2id_cfg:
        aligned: list[dict] = []
        for it in valid_rows:
            c = _canonical_dataset_label(it["actual"], label2id_cfg)
            if c is None:
                continue
            aligned.append({**it, "actual": c})
        valid_rows = aligned
        if not valid_rows:
            raise ValueError(
                "No rows left after aligning dataset labels with the model's label2id. "
                "Check that column `jenis` matches the class names used during training."
            )

    # Siapkan data teks + label sekali saja supaya tidak rebuild berulang.
    # Gunakan batch lebih besar saat GPU aktif agar inference lebih cepat.
    batch_size = 64 if device.type == "cuda" else 16
    use_amp = device.type == "cuda"
    actual_labels: list[str] = []
    predicted_labels: list[str] = []
    sample_results: list[dict] = []
    all_probs: list[np.ndarray] = []

    # Mapping kelas output model -> label (berdasarkan id2label di config).
    # Proba dari model disusun sesuai urutan index kelas tersebut.
    num_labels = int(getattr(model.config, "num_labels", 0) or 0)
    id2label_int_to_str: dict[int, str] = {}
    for k, v in id2label_cfg.items():
        try:
            idx = int(k)
        except Exception:
            continue
        id2label_int_to_str[idx] = str(v)
    labels_in_order: list[str] = []
    label_to_idx: dict[str, int] = {}
    if num_labels > 0:
        labels_in_order = [
            id2label_int_to_str.get(i, str(i)) for i in range(num_labels)
        ]
        label_to_idx = {lab: i for i, lab in enumerate(labels_in_order)}

    items = valid_rows

    with torch.inference_mode():
        for start in range(0, len(items), batch_size):
            chunk = items[start : start + batch_size]
            texts = [it["text"] for it in chunk]

            # Dynamic padding per-batch jauh lebih cepat pada input pendek,
            # tetap dibatasi oleh max_length untuk konsistensi truncation.
            enc = tokenizer(
                texts,
                truncation=True,
                padding=True,
                max_length=max_length,
                return_tensors="pt",
            )
            enc = {k: v.to(device) for k, v in enc.items()}

            with torch.cuda.amp.autocast(enabled=use_amp):
                logits = model(**enc).logits  # [bs, num_labels]
            probs = torch.softmax(logits, dim=-1)  # [bs, num_labels]
            pred_idx_tensor = torch.argmax(probs, dim=-1)  # [bs]
            probs_cpu = probs.detach().cpu().numpy()

            # Konversi mapping id->label dengan lebih robust.
            for i in range(len(chunk)):
                actual = chunk[i]["actual"]
                pred_idx = int(pred_idx_tensor[i].item())
                pred_score = float(probs[i, pred_idx].item())

                predicted = id2label_cfg.get(pred_idx)
                if predicted is None:
                    predicted = id2label_cfg.get(str(pred_idx), str(pred_idx))
                predicted = str(predicted).strip()
                if label2id_cfg:
                    predicted = (
                        _canonical_dataset_label(predicted, label2id_cfg) or predicted
                    )

                actual_labels.append(actual)
                predicted_labels.append(predicted)
                all_probs.append(probs_cpu[i])

                if len(sample_results) < 100:
                    row = chunk[i]["row"]
                    rid = row.get("id")
                    sample_results.append(
                        {
                            "id": int(rid) if rid is not None else 0,
                            "id_kata": row.get("id_kata"),
                            "text": chunk[i]["text"],
                            "actual": actual,
                            "predicted": predicted,
                            "score": pred_score,
                            "correct": predicted == actual,
                        }
                    )

    total_data = len(actual_labels)
    if total_data == 0:
        raise ValueError("No valid data available for testing.")

    accuracy = float(accuracy_score(actual_labels, predicted_labels))
    precision_macro, recall_macro, f1_macro, _ = precision_recall_fscore_support(
        actual_labels,
        predicted_labels,
        average="macro",
        zero_division=0,
    )

    # Weighted Avg (menggunakan F1 weighted).
    _, _, f1_weighted, _ = precision_recall_fscore_support(
        actual_labels,
        predicted_labels,
        average="weighted",
        zero_division=0,
    )

    # Std Deviation (std dev F1 per kelas).
    _, _, f1_per_class, _ = precision_recall_fscore_support(
        actual_labels,
        predicted_labels,
        average=None,
        zero_division=0,
    )
    std_deviation = float(np.std(f1_per_class)) if f1_per_class is not None else 0.0

    # ROC-AUC (multi-class OVR weighted; binarize agar stabil dengan string label).
    roc_auc = 0.0
    if all_probs and labels_in_order:
        probas_matrix = np.vstack(all_probs)
        n_prob_cols = probas_matrix.shape[1]
        eff_labels = labels_in_order
        if len(eff_labels) != n_prob_cols:
            eff_labels = [
                id2label_int_to_str.get(i, str(i)) for i in range(n_prob_cols)
            ]
        if len(eff_labels) >= 2:
            roc_auc = _multiclass_roc_auc_weighted(
                actual_labels, probas_matrix, eff_labels
            )
    # Matthews correlation coefficient untuk evaluasi klasifikasi multi-kelas.
    try:
        mcc = float(matthews_corrcoef(actual_labels, predicted_labels))
    except Exception:
        mcc = 0.0

    dataset_name = _get_dataset_name(dataset_id)
    testing_result_id: int | None = None
    print("SAVE RESULT:", save_result)
    if save_result:
        insert_payload = {
            "dataset_id": dataset_id,
            "model_id": model_id,
            "model_name": model_name,
            "dataset_name": dataset_name,
            "total_data": total_data,
            "accuracy": accuracy,
            "precision_macro": float(precision_macro),
            "recall_macro": float(recall_macro),
            "f1_macro": float(f1_macro),
            "std_deviation": float(std_deviation),
            "weighted_avg": float(f1_weighted),
            "roc_auc": float(roc_auc),
            "mcc": float(mcc),
            "max_length": max_length,
        }
        print("INSERT PAYLOAD:", insert_payload)
        testing_result_id = _insert_testing_result(insert_payload)

    return {
        "status": "ok",
        "testing_result_id": testing_result_id,
        "dataset_id": dataset_id,
        "dataset_name": dataset_name,
        "model_id": model_id,
        "model_name": model_name,
        "total_data": total_data,
        "accuracy": accuracy,
        "precision_macro": float(precision_macro),
        "recall_macro": float(recall_macro),
        "f1_macro": float(f1_macro),
        "std_deviation": float(std_deviation),
        "weighted_avg": float(f1_weighted),
        "roc_auc": float(roc_auc),
        "mcc": float(mcc),
        "results": sample_results,
    }


def test_mbert_model(
    *,
    dataset_id: int,
    model_name: str,
    model_id: int | None,
    max_length: int,
    limit: int | None,
    save_result: bool,
) -> dict:
    # Pipeline evaluasi identik; yang membedakan adalah artifact model/tokenizer
    # yang dipilih oleh `model_name` (mBERT dihasilkan dari endpoint train mbert).
    return test_indobert_model(
        dataset_id=dataset_id,
        model_name=model_name,
        model_id=model_id,
        max_length=max_length,
        limit=limit,
        save_result=save_result,
    )


def predict_with_testing_model(
    *,
    algorithm: str,
    model_name: str,
    text: str,
    max_length: int,
) -> dict:
    algorithm_norm = str(algorithm or "").strip().lower().replace("_", "-")

    if algorithm_norm in {"indobert", "indo-bert", "indobenchmark"}:
        result = predict_indobert_softmax(
            text=text,
            model_name=model_name,
            max_length=max_length,
        )
        return {
            "status": "ok",
            "algorithm": algorithm,
            "model_name": model_name,
            "text": text,
            "label": str(result.get("label") or ""),
            "score": float(result.get("score") or 0.0),
            "probs": result.get("probs") or {},
        }

    if algorithm_norm in {"mbert", "m-bert", "multilingual-bert", "bert-base-multilingual-cased"}:
        result = predict_mbert_softmax(
            text=text,
            model_name=model_name,
            max_length=max_length,
        )
        return {
            "status": "ok",
            "algorithm": algorithm,
            "model_name": model_name,
            "text": text,
            "label": str(result.get("label") or ""),
            "score": float(result.get("score") or 0.0),
            "probs": result.get("probs") or {},
        }

    raise ValueError(f"Prediction endpoint for {algorithm} is not implemented yet.")


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
            best_by_algorithm[key] = {
                "id": int(model_id),
                "algoritma": algorithm,
                "nama_model": model_name,
                "dataset_id": row.get("dataset_id"),
                "split_ratio": row.get("split_ratio"),
                "accuracy": accuracy,
                "precision": (
                    float(row.get("precision")) if row.get("precision") is not None else None
                ),
                "recall": float(row.get("recall")) if row.get("recall") is not None else None,
                "f1_score": float(row.get("f1_score")) if row.get("f1_score") is not None else None,
                "created_at": row.get("created_at"),
            }

    # Urutkan dari akurasi terbesar agar mudah dipakai frontend.
    return sorted(best_by_algorithm.values(), key=lambda x: x["accuracy"], reverse=True)
