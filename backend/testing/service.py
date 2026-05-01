from __future__ import annotations

import os
from typing import Any

import numpy as np
import torch
from sklearn.metrics import (
    accuracy_score,
    matthews_corrcoef,
    precision_recall_fscore_support,
    roc_auc_score,
)
from transformers import AutoModelForSequenceClassification, AutoTokenizer

from backend.processing.service import (
    _build_text,
    _fetch_preprocessed_rows,
    _safe_name,
    predict_indobert_softmax,
)
from backend.supabase_client import supabase


def get_available_testing_models() -> list[dict]:
    try:
        models_res = (
            supabase.table("models")
            .select("id,nama_model,algoritma,dataset_id,max_length,created_at")
            .order("created_at", desc=True)
            .execute()
        )
        models = models_res.data or []
    except Exception as e:
        raise ValueError(f"Failed to fetch model data: {e}")

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
                "max_length": row.get("max_length"),
                "created_at": row.get("created_at"),
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
        valid_rows.append(row)

    if not valid_rows:
        raise ValueError("No valid rows found (columns 'jenis' and text input must be filled).")

    if limit:
        valid_rows = valid_rows[:limit]

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

    # Siapkan data teks + label sekali saja supaya tidak rebuild berulang.
    batch_size = 16
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

    items: list[dict] = []
    for row in valid_rows:
        text = _build_text(row)
        actual = str(row.get("jenis") or "").strip()
        if not actual or not text:
            continue
        items.append(
            {
                "row": row,
                "text": text,
                "actual": actual,
            }
        )

    with torch.no_grad():
        for start in range(0, len(items), batch_size):
            chunk = items[start : start + batch_size]
            texts = [it["text"] for it in chunk]

            enc = tokenizer(
                texts,
                truncation=True,
                padding="max_length",
                max_length=max_length,
                return_tensors="pt",
            )
            enc = {k: v.to(device) for k, v in enc.items()}

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

    # ROC-AUC (multi-class, menggunakan probabilitas model).
    roc_auc = 0.0
    try:
        if all_probs:
            probas_matrix = np.vstack(all_probs)
            # Pastikan urutan label sesuai kolom probas_matrix.
            num_labels_from_probs = probas_matrix.shape[1]
            effective_labels_in_order = labels_in_order
            if (not effective_labels_in_order) or (len(effective_labels_in_order) != num_labels_from_probs):
                effective_labels_in_order = [
                    id2label_int_to_str.get(i, str(i)) for i in range(num_labels_from_probs)
                ]

            roc_auc = float(
                roc_auc_score(
                    actual_labels,
                    probas_matrix,
                    multi_class="ovr",
                    average="weighted",
                    labels=effective_labels_in_order,
                )
            )
    except Exception:
        roc_auc = 0.0
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

    raise ValueError(f"Prediction endpoint for {algorithm} is not implemented yet.")
