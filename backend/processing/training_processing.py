from __future__ import annotations

import json
import math
import os
import random
import threading
import uuid
from pathlib import Path
from statistics import mean
from typing import Literal

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field, model_validator
from supabase import create_client
import torch
from torch.utils.data import DataLoader, TensorDataset
from transformers import AutoModelForSequenceClassification, AutoTokenizer

router = APIRouter(prefix="/processing", tags=["processing"])

SUPABASE_URL = os.getenv("SUPABASE_URL", "https://fhpjbkelhvopvfzykjne.supabase.co")
SUPABASE_KEY = os.getenv(
    "SUPABASE_SERVICE_KEY",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZocGpia2VsaHZvcHZmenlram5lIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTM5NDY1NCwiZXhwIjoyMDkwOTcwNjU0fQ.ZLisXnkuyvgvYwBV81lsEbMSNJm3iMEKPMTswSSjpUg",
)
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
_INDOBERT_JOBS: dict[str, dict] = {}
_INDOBERT_JOBS_LOCK = threading.Lock()
_MBERT_JOBS: dict[str, dict] = {}
_MBERT_JOBS_LOCK = threading.Lock()

_INDOBERT_TOKENIZER: AutoTokenizer | None = None
_MBERT_TOKENIZER: AutoTokenizer | None = None
_ARTIFACTS_ROOT = Path(__file__).resolve().parents[1] / "artifacts"
_MBERT_ARTIFACTS_ROOT = _ARTIFACTS_ROOT / "mbert"
_MBERT_INDEX_PATH = _MBERT_ARTIFACTS_ROOT / "index.json"


def _get_indobert_tokenizer() -> AutoTokenizer:
    global _INDOBERT_TOKENIZER
    if _INDOBERT_TOKENIZER is None:
        _INDOBERT_TOKENIZER = AutoTokenizer.from_pretrained("indobenchmark/indobert-base-p1")
    return _INDOBERT_TOKENIZER


def _get_mbert_tokenizer() -> AutoTokenizer:
    global _MBERT_TOKENIZER
    if _MBERT_TOKENIZER is None:
        _MBERT_TOKENIZER = AutoTokenizer.from_pretrained("bert-base-multilingual-cased")
    return _MBERT_TOKENIZER


class TrainingParams(BaseModel):
    splitRatio: str = Field(..., examples=["80:20"])
    lr: str = ""
    epoch: int = Field(default=3, ge=1, le=100)
    batchSize: str = ""
    maxLength: str = ""
    optimizer: str = ""
    weightDecay: str = ""
    scheduler: str = ""
    warmup: str = ""
    dropout: str = ""
    earlyStopping: str = ""
    gradAccum: str = ""
    vectorSize: str = ""
    windowSize: str = ""
    minCount: str = ""
    modelType: str = ""
    negative: str = ""
    xMax: str = ""
    alpha: str = ""
    algo: str = ""
    mode: Literal["cari-rasio", "training-final"] = "cari-rasio"


class TrainingRequest(BaseModel):
    params: TrainingParams
    trainingName: str | None = None
    trainingDesc: str | None = None
    modelName: str | None = None
    datasetId: int | None = None
    saveToDb: bool = False

    @model_validator(mode="after")
    def validate_split_ratio(self) -> "TrainingRequest":
        ratio = self.params.splitRatio
        if ":" not in ratio:
            raise ValueError("splitRatio harus berformat train:test, contoh 80:20")

        try:
            train_raw, test_raw = ratio.split(":")
            train_val = int(train_raw)
            test_val = int(test_raw)
        except ValueError as exc:
            raise ValueError("splitRatio harus berupa angka, contoh 80:20") from exc

        if train_val < 1 or train_val > 99 or test_val < 1 or test_val > 99:
            raise ValueError("Nilai train dan test harus antara 1-99")

        if train_val + test_val != 100:
            raise ValueError("Total splitRatio harus 100")

        return self


def _generate_epoch_result(epoch: int) -> dict:
    base_acc = 75 + epoch * 2 + random.random() * 3
    base_prec = 74 + epoch * 2 + random.random() * 3
    base_rec = 73 + epoch * 2 + random.random() * 3
    base_f1 = 74 + epoch * 2 + random.random() * 3

    return {
        "epoch": epoch,
        "accuracy": round(min(99, base_acc + random.random() * 2), 2),
        "precision": round(min(99, base_prec + random.random() * 2), 2),
        "recall": round(min(99, base_rec + random.random() * 2), 2),
        "f1": round(min(99, base_f1 + random.random() * 2), 2),
        "loss": round(max(0.1, 1.5 - epoch * 0.25 + random.random() * 0.2), 4),
        "mcc": round(0.5 + random.random() * 0.3, 4),
    }


def _calculate_average(results: list[dict]) -> dict:
    if not results:
        return {
            "accuracy": 0.0,
            "precision": 0.0,
            "recall": 0.0,
            "f1": 0.0,
            "loss": 0.0,
            "mcc": 0.0,
        }

    return {
        "accuracy": round(mean(item["accuracy"] for item in results), 2),
        "precision": round(mean(item["precision"] for item in results), 2),
        "recall": round(mean(item["recall"] for item in results), 2),
        "f1": round(mean(item["f1"] for item in results), 2),
        "loss": round(mean(item["loss"] for item in results), 4),
        "mcc": round(mean(item["mcc"] for item in results), 4),
    }


def _to_int_or_none(value: str) -> int | None:
    if value is None:
        return None
    text = str(value).strip()
    if not text:
        return None
    try:
        return int(float(text))
    except (TypeError, ValueError):
        return None


def _parse_split_ratio(split_ratio: str) -> tuple[int, int]:
    train_raw, test_raw = split_ratio.split(":")
    return int(train_raw), int(test_raw)


def _fetch_dataset(dataset_id: int) -> dict:
    dataset_res = (
        supabase.table("datasets")
        .select("id,is_preprocessed,name")
        .eq("id", dataset_id)
        .limit(1)
        .execute()
    )
    data = dataset_res.data or []
    if not data:
        raise HTTPException(status_code=404, detail="Dataset tidak ditemukan")

    dataset = data[0]
    if not dataset.get("is_preprocessed"):
        raise HTTPException(
            status_code=400,
            detail="Dataset belum dipreprocess. Jalankan preprocessing terlebih dahulu",
        )

    return dataset


def _fetch_preprocessed_rows(dataset_id: int) -> list[dict]:
    rows: list[dict] = []
    start = 0
    limit = 1000

    while True:
        res = (
            supabase.table("preprocessed_data")
            .select(
                "id,jenis,manado_clean,indonesia_clean,kalimat_manado_clean,kalimat_indonesia_clean,manado_tokens,indonesia_tokens,kalimat_manado_tokens,kalimat_indonesia_tokens"
            )
            .eq("dataset_id", dataset_id)
            .range(start, start + limit - 1)
            .execute()
        )

        batch = res.data or []
        if not batch:
            break

        rows.extend(batch)
        if len(batch) < limit:
            break
        start += limit

    return rows


def _fetch_indobert_preprocessed_rows(dataset_id: int) -> list[dict]:
    rows: list[dict] = []
    start = 0
    limit = 1000
    while True:
        res = (
            supabase.table("preprocessed_data")
            .select(
                "id,jenis,input_ids,attention_mask,manado_clean,indonesia_clean,kalimat_manado_clean,kalimat_indonesia_clean"
            )
            .eq("dataset_id", dataset_id)
            .range(start, start + limit - 1)
            .execute()
        )
        batch = res.data or []
        if not batch:
            break
        rows.extend(batch)
        if len(batch) < limit:
            break
        start += limit
    return rows


def _safe_load_tokens(value: str | None) -> list[str]:
    if not value:
        return []
    try:
        parsed = json.loads(value)
        if isinstance(parsed, list):
            return [str(item).strip().lower() for item in parsed if str(item).strip()]
    except Exception:
        pass
    return []


def _safe_load_int_list(value: str | None) -> list[int]:
    if not value:
        return []
    try:
        parsed = json.loads(value)
        if isinstance(parsed, list):
            clean = []
            for item in parsed:
                try:
                    clean.append(int(item))
                except Exception:
                    continue
            return clean
    except Exception:
        return []
    return []


def _extract_tokens(row: dict) -> list[str]:
    tokens: list[str] = []
    token_fields = [
        "manado_tokens",
        "indonesia_tokens",
        "kalimat_manado_tokens",
        "kalimat_indonesia_tokens",
    ]
    for field in token_fields:
        tokens.extend(_safe_load_tokens(row.get(field)))

    if tokens:
        return tokens

    fallback_text = " ".join(
        [
            str(row.get("manado_clean") or ""),
            str(row.get("indonesia_clean") or ""),
            str(row.get("kalimat_manado_clean") or ""),
            str(row.get("kalimat_indonesia_clean") or ""),
        ]
    ).strip()
    return [tok for tok in fallback_text.lower().split() if tok]


def _prepare_records(rows: list[dict]) -> list[dict]:
    records = []
    for row in rows:
        label = (row.get("jenis") or "").strip().lower()
        tokens = _extract_tokens(row)
        if not label or not tokens:
            continue
        records.append({"label": label, "tokens": tokens})
    return records


def _train_naive_bayes(train_records: list[dict]) -> tuple[dict, dict, int]:
    label_doc_counts: dict[str, int] = {}
    label_token_counts: dict[str, int] = {}
    token_freq_by_label: dict[str, dict[str, int]] = {}
    vocab: set[str] = set()

    for record in train_records:
        label = record["label"]
        tokens = record["tokens"]

        label_doc_counts[label] = label_doc_counts.get(label, 0) + 1
        token_freq_by_label.setdefault(label, {})

        for token in tokens:
            vocab.add(token)
            token_freq_by_label[label][token] = token_freq_by_label[label].get(token, 0) + 1
            label_token_counts[label] = label_token_counts.get(label, 0) + 1

    return label_doc_counts, token_freq_by_label, len(vocab)


def _predict_label(
    tokens: list[str],
    label_doc_counts: dict[str, int],
    token_freq_by_label: dict[str, dict[str, int]],
    vocab_size: int,
) -> str:
    total_docs = sum(label_doc_counts.values())
    best_label = ""
    best_score = float("-inf")

    for label, doc_count in label_doc_counts.items():
        prior = math.log(doc_count / total_docs) if total_docs else float("-inf")
        token_counts = token_freq_by_label.get(label, {})
        total_tokens = sum(token_counts.values())
        denom = total_tokens + vocab_size if (total_tokens + vocab_size) > 0 else 1

        score = prior
        for token in tokens:
            freq = token_counts.get(token, 0)
            score += math.log((freq + 1) / denom)

        if score > best_score:
            best_score = score
            best_label = label

    return best_label


def _compute_metrics(y_true: list[str], y_pred: list[str]) -> dict:
    labels = sorted(set(y_true) | set(y_pred))
    if not labels:
        return {
            "accuracy": 0.0,
            "precision": 0.0,
            "recall": 0.0,
            "f1": 0.0,
            "loss": 1.0,
            "mcc": 0.0,
        }

    idx = {label: i for i, label in enumerate(labels)}
    n = len(labels)
    conf = [[0 for _ in range(n)] for _ in range(n)]
    for truth, pred in zip(y_true, y_pred):
        conf[idx[truth]][idx[pred]] += 1

    total = len(y_true)
    correct = sum(conf[i][i] for i in range(n))
    accuracy = correct / total if total else 0.0

    macro_precision = 0.0
    macro_recall = 0.0
    macro_f1 = 0.0

    row_sums = [sum(conf[i][j] for j in range(n)) for i in range(n)]
    col_sums = [sum(conf[i][j] for i in range(n)) for j in range(n)]

    for i in range(n):
        tp = conf[i][i]
        fp = col_sums[i] - tp
        fn = row_sums[i] - tp

        precision_i = tp / (tp + fp) if (tp + fp) > 0 else 0.0
        recall_i = tp / (tp + fn) if (tp + fn) > 0 else 0.0
        f1_i = (
            (2 * precision_i * recall_i / (precision_i + recall_i))
            if (precision_i + recall_i) > 0
            else 0.0
        )

        macro_precision += precision_i
        macro_recall += recall_i
        macro_f1 += f1_i

    macro_precision /= n
    macro_recall /= n
    macro_f1 /= n

    c = sum(conf[i][i] for i in range(n))
    s = total
    sum_pk_tk = sum(col_sums[k] * row_sums[k] for k in range(n))
    sum_pk2 = sum(col_sums[k] ** 2 for k in range(n))
    sum_tk2 = sum(row_sums[k] ** 2 for k in range(n))
    numerator = (c * s) - sum_pk_tk
    denominator = math.sqrt((s * s - sum_pk2) * (s * s - sum_tk2))
    mcc = (numerator / denominator) if denominator > 0 else 0.0

    return {
        "accuracy": round(accuracy * 100, 2),
        "precision": round(macro_precision * 100, 2),
        "recall": round(macro_recall * 100, 2),
        "f1": round(macro_f1 * 100, 2),
        "loss": round(max(0.0, 1.0 - accuracy), 4),
        "mcc": round(mcc, 4),
    }


def _split_records(records: list[dict], train_pct: int, seed: int) -> tuple[list[dict], list[dict]]:
    shuffled = records[:]
    random.Random(seed).shuffle(shuffled)

    split_at = int(len(shuffled) * train_pct / 100)
    if split_at <= 0:
        split_at = 1
    if split_at >= len(shuffled):
        split_at = len(shuffled) - 1

    train_records = shuffled[:split_at]
    test_records = shuffled[split_at:]
    return train_records, test_records


def _run_training_epochs(records: list[dict], train_pct: int, epoch_count: int) -> list[dict]:
    epoch_results: list[dict] = []
    for epoch in range(1, epoch_count + 1):
        train_records, test_records = _split_records(records, train_pct, seed=epoch)
        label_doc_counts, token_freq_by_label, vocab_size = _train_naive_bayes(train_records)

        y_true: list[str] = []
        y_pred: list[str] = []
        for sample in test_records:
            pred = _predict_label(
                sample["tokens"], label_doc_counts, token_freq_by_label, vocab_size
            )
            y_true.append(sample["label"])
            y_pred.append(pred)

        metrics = _compute_metrics(y_true, y_pred)
        epoch_results.append({"epoch": epoch, **metrics})

    return epoch_results


def _prepare_text_classification_tensors(
    rows: list[dict], tokenizer: AutoTokenizer
) -> tuple[torch.Tensor, torch.Tensor, torch.Tensor, dict, dict]:
    target_len = 128
    pad_id = int(tokenizer.pad_token_id or 0)
    unk_id = int(tokenizer.unk_token_id or 0)
    vocab_size = int(tokenizer.vocab_size)

    def _pad_trunc(values: list[int], pad_value: int) -> list[int]:
        if len(values) >= target_len:
            return values[:target_len]
        return values + [pad_value] * (target_len - len(values))

    def _sanitize_ids(values: list[int]) -> list[int]:
        # Avoid CUDA device-side assert by ensuring embedding indices are valid.
        # Any out-of-range token id is replaced with [UNK].
        return [tid if 0 <= tid < vocab_size else unk_id for tid in values]

    def _fallback_text(row: dict) -> str:
        parts = [
            str(row.get("manado_clean") or "").strip(),
            str(row.get("indonesia_clean") or "").strip(),
            str(row.get("kalimat_manado_clean") or "").strip(),
            str(row.get("kalimat_indonesia_clean") or "").strip(),
        ]
        return " ".join([p for p in parts if p])

    labels = sorted(
        list({(row.get("jenis") or "").strip().lower() for row in rows if row.get("jenis")})
    )
    if len(labels) < 2:
        raise HTTPException(
            status_code=400,
            detail="Label unik kurang dari 2. Fine-tuning softmax butuh minimal 2 kelas",
        )
    label2id = {label: idx for idx, label in enumerate(labels)}
    id2label = {idx: label for label, idx in label2id.items()}

    input_ids_data: list[list[int]] = []
    attention_mask_data: list[list[int]] = []
    label_ids: list[int] = []

    for row in rows:
        label = (row.get("jenis") or "").strip().lower()
        if not label or label not in label2id:
            continue

        ids = _safe_load_int_list(row.get("input_ids"))
        mask = _safe_load_int_list(row.get("attention_mask"))

        ids_ok = bool(ids)
        mask_ok = bool(mask) and len(mask) == len(ids)
        vocab_ok = ids_ok and all((0 <= tid < vocab_size) for tid in ids)

        if not (ids_ok and mask_ok and vocab_ok):
            text = _fallback_text(row)
            if not text:
                continue
            encoded = tokenizer(
                text,
                padding="max_length",
                truncation=True,
                max_length=target_len,
            )
            ids = list(encoded.get("input_ids") or [])
            mask = list(encoded.get("attention_mask") or [])
            if not ids or not mask or len(ids) != len(mask):
                continue

        ids = _sanitize_ids(ids)
        input_ids_data.append(_pad_trunc(ids, pad_id))
        attention_mask_data.append(_pad_trunc(mask, 0))
        label_ids.append(label2id[label])

    if len(input_ids_data) < 2:
        raise HTTPException(
            status_code=400,
            detail="Data preprocessed valid kurang dari 2 baris",
        )

    return (
        torch.tensor(input_ids_data, dtype=torch.long),
        torch.tensor(attention_mask_data, dtype=torch.long),
        torch.tensor(label_ids, dtype=torch.long),
        label2id,
        id2label,
    )


def _prepare_indobert_tensors(rows: list[dict]) -> tuple[torch.Tensor, torch.Tensor, torch.Tensor, dict, dict]:
    return _prepare_text_classification_tensors(rows, _get_indobert_tokenizer())


def _prepare_mbert_tensors(rows: list[dict]) -> tuple[torch.Tensor, torch.Tensor, torch.Tensor, dict, dict]:
    return _prepare_text_classification_tensors(rows, _get_mbert_tokenizer())


def _load_indobert_model(num_labels: int) -> AutoModelForSequenceClassification:
    return AutoModelForSequenceClassification.from_pretrained(
        "indobenchmark/indobert-base-p1",
        num_labels=num_labels,
    )


def _load_mbert_model(num_labels: int) -> AutoModelForSequenceClassification:
    return AutoModelForSequenceClassification.from_pretrained(
        "bert-base-multilingual-cased",
        num_labels=num_labels,
    )


def _set_indobert_job(job_id: str, updates: dict) -> None:
    with _INDOBERT_JOBS_LOCK:
        current = _INDOBERT_JOBS.get(job_id, {})
        current.update(updates)
        _INDOBERT_JOBS[job_id] = current


def _set_mbert_job(job_id: str, updates: dict) -> None:
    with _MBERT_JOBS_LOCK:
        current = _MBERT_JOBS.get(job_id, {})
        current.update(updates)
        _MBERT_JOBS[job_id] = current


def _run_indobert_training_core(
    payload: TrainingRequest,
    progress_callback=None,
) -> dict:
    if payload.datasetId is None:
        raise HTTPException(status_code=400, detail="datasetId wajib diisi")

    _fetch_dataset(payload.datasetId)
    rows = _fetch_indobert_preprocessed_rows(payload.datasetId)
    if len(rows) < 2:
        raise HTTPException(
            status_code=400,
            detail="Data preprocessed_data tidak cukup untuk fine-tuning",
        )

    input_ids, attention_mask, labels, label2id, id2label = _prepare_indobert_tensors(rows)

    params = payload.params
    train_pct, _ = _parse_split_ratio(params.splitRatio)
    batch_size = _to_int_or_none(params.batchSize) or 8
    learning_rate = float(params.lr) if params.lr else 2e-5
    weight_decay = float(params.weightDecay) if params.weightDecay else 0.0
    epochs = params.epoch

    total_samples = input_ids.size(0)
    split_at = int(total_samples * train_pct / 100)
    if split_at <= 0:
        split_at = 1
    if split_at >= total_samples:
        split_at = total_samples - 1

    generator = torch.Generator().manual_seed(42)
    perm = torch.randperm(total_samples, generator=generator)
    train_idx = perm[:split_at]
    test_idx = perm[split_at:]

    train_dataset = TensorDataset(
        input_ids[train_idx],
        attention_mask[train_idx],
        labels[train_idx],
    )
    test_dataset = TensorDataset(
        input_ids[test_idx],
        attention_mask[test_idx],
        labels[test_idx],
    )

    train_loader = DataLoader(train_dataset, batch_size=batch_size, shuffle=True)
    test_loader = DataLoader(test_dataset, batch_size=batch_size, shuffle=False)

    force_cpu = os.getenv("FORCE_CPU", "").strip().lower() in {"1", "true", "yes", "y"}
    device = torch.device("cpu" if force_cpu else ("cuda" if torch.cuda.is_available() else "cpu"))
    model = _load_indobert_model(num_labels=len(label2id))
    model.to(device)

    optimizer = torch.optim.AdamW(
        model.parameters(),
        lr=learning_rate,
        weight_decay=weight_decay,
    )

    epoch_results: list[dict] = []
    best_f1 = float("-inf")
    best_state = None
    no_improve_count = 0
    early_patience = _to_int_or_none(params.earlyStopping) or 0

    for epoch in range(1, epochs + 1):
        model.train()
        for batch in train_loader:
            batch_input_ids, batch_attention_mask, batch_labels = [x.to(device) for x in batch]
            outputs = model(
                input_ids=batch_input_ids,
                attention_mask=batch_attention_mask,
                labels=batch_labels,
            )
            loss = outputs.loss
            optimizer.zero_grad()
            loss.backward()
            optimizer.step()

        metrics, eval_loss = _evaluate_indobert(model, test_loader, device)
        metrics["loss"] = eval_loss
        epoch_result = {"epoch": epoch, **metrics}
        epoch_results.append(epoch_result)

        if progress_callback:
            progress_callback(epoch, epochs, epoch_result)

        if metrics["f1"] > best_f1:
            best_f1 = metrics["f1"]
            best_state = {k: v.detach().cpu().clone() for k, v in model.state_dict().items()}
            no_improve_count = 0
        else:
            no_improve_count += 1
            if early_patience > 0 and no_improve_count >= early_patience:
                break

    if best_state is not None:
        model.load_state_dict(best_state)

    average = _calculate_average(epoch_results)
    best_epoch = max(epoch_results, key=lambda item: item["f1"]) if epoch_results else None

    # Endpoint ini memang diminta selalu simpan hasil training ke Supabase.
    params.algo = params.algo or "indobert"
    model_id = _save_model_result(payload, average)
    saved_rows = _save_epoch_results(model_id, params, epoch_results)

    return {
        "status": "done",
        "algo": "indobert",
        "task": "fine_tuning_sequence_classification_softmax",
        "splitRatio": params.splitRatio,
        "trainingName": payload.trainingName or "Untitled Training",
        "modelName": payload.modelName or "Untitled Model",
        "numLabels": len(label2id),
        "label2id": label2id,
        "id2label": {str(k): v for k, v in id2label.items()},
        "results": epoch_results,
        "average": average,
        "bestEpoch": best_epoch,
        "modelId": model_id,
        "savedEpochRows": saved_rows,
        "datasetSize": total_samples,
        "trainSize": len(train_dataset),
        "testSize": len(test_dataset),
        "device": str(device),
    }


def _run_mbert_training_core(
    payload: TrainingRequest,
    progress_callback=None,
) -> dict:
    if payload.datasetId is None:
        raise HTTPException(status_code=400, detail="datasetId wajib diisi")

    _fetch_dataset(payload.datasetId)
    rows = _fetch_indobert_preprocessed_rows(payload.datasetId)
    if len(rows) < 2:
        raise HTTPException(
            status_code=400,
            detail="Data preprocessed_data tidak cukup untuk fine-tuning",
        )

    input_ids, attention_mask, labels, label2id, id2label = _prepare_mbert_tensors(rows)

    params = payload.params
    train_pct, _ = _parse_split_ratio(params.splitRatio)
    batch_size = _to_int_or_none(params.batchSize) or 8
    learning_rate = float(params.lr) if params.lr else 2e-5
    weight_decay = float(params.weightDecay) if params.weightDecay else 0.0
    epochs = params.epoch

    total_samples = input_ids.size(0)
    base_seed = 42
    random.seed(base_seed)
    torch.manual_seed(base_seed)
    if torch.cuda.is_available():
        torch.cuda.manual_seed_all(base_seed)

    labels_list = labels.cpu().tolist()
    class_indices: dict[int, list[int]] = {}
    for idx, lbl in enumerate(labels_list):
        class_indices.setdefault(int(lbl), []).append(idx)

    rng = random.Random(base_seed)
    train_idx_list: list[int] = []
    test_idx_list: list[int] = []
    for _, idxs in class_indices.items():
        local = idxs[:]
        rng.shuffle(local)
        class_split = int(len(local) * train_pct / 100)
        if class_split <= 0 and len(local) > 1:
            class_split = 1
        if class_split >= len(local):
            class_split = max(1, len(local) - 1)
        train_idx_list.extend(local[:class_split])
        test_idx_list.extend(local[class_split:])

    if not train_idx_list or not test_idx_list:
        split_at = int(total_samples * train_pct / 100)
        if split_at <= 0:
            split_at = 1
        if split_at >= total_samples:
            split_at = total_samples - 1
        fallback_gen = torch.Generator().manual_seed(base_seed)
        perm = torch.randperm(total_samples, generator=fallback_gen).tolist()
        train_idx_list = perm[:split_at]
        test_idx_list = perm[split_at:]

    rng.shuffle(train_idx_list)
    rng.shuffle(test_idx_list)
    train_idx = torch.tensor(train_idx_list, dtype=torch.long)
    test_idx = torch.tensor(test_idx_list, dtype=torch.long)

    train_dataset = TensorDataset(
        input_ids[train_idx],
        attention_mask[train_idx],
        labels[train_idx],
    )
    test_dataset = TensorDataset(
        input_ids[test_idx],
        attention_mask[test_idx],
        labels[test_idx],
    )

    train_gen = torch.Generator().manual_seed(base_seed)
    train_loader = DataLoader(
        train_dataset,
        batch_size=batch_size,
        shuffle=True,
        generator=train_gen,
    )
    test_loader = DataLoader(test_dataset, batch_size=batch_size, shuffle=False)

    force_cpu = os.getenv("FORCE_CPU", "").strip().lower() in {"1", "true", "yes", "y"}
    device = torch.device("cpu" if force_cpu else ("cuda" if torch.cuda.is_available() else "cpu"))
    model = None
    optimizer = None
    prev_cudnn_deterministic = torch.backends.cudnn.deterministic
    prev_cudnn_benchmark = torch.backends.cudnn.benchmark
    torch.backends.cudnn.deterministic = True
    torch.backends.cudnn.benchmark = False
    try:
        model = _load_mbert_model(num_labels=len(label2id))
        model.to(device)

        optimizer = torch.optim.AdamW(
            model.parameters(),
            lr=learning_rate,
            weight_decay=weight_decay,
        )

        epoch_results: list[dict] = []
        best_f1 = float("-inf")
        best_state = None
        no_improve_count = 0
        early_patience = _to_int_or_none(params.earlyStopping) or 0

        for epoch in range(1, epochs + 1):
            model.train()
            for batch in train_loader:
                batch_input_ids, batch_attention_mask, batch_labels = [x.to(device) for x in batch]
                outputs = model(
                    input_ids=batch_input_ids,
                    attention_mask=batch_attention_mask,
                    labels=batch_labels,
                )
                loss = outputs.loss
                optimizer.zero_grad()
                loss.backward()
                optimizer.step()

            metrics, eval_loss = _evaluate_indobert(model, test_loader, device)
            metrics["loss"] = eval_loss
            epoch_result = {"epoch": epoch, **metrics}
            epoch_results.append(epoch_result)

            if progress_callback:
                progress_callback(epoch, epochs, epoch_result)

            if metrics["f1"] > best_f1:
                best_f1 = metrics["f1"]
                best_state = {k: v.detach().cpu().clone() for k, v in model.state_dict().items()}
                no_improve_count = 0
            else:
                no_improve_count += 1
                if early_patience > 0 and no_improve_count >= early_patience:
                    break

        if best_state is not None:
            model.load_state_dict(best_state)

        average = _calculate_average(epoch_results)
        best_epoch = max(epoch_results, key=lambda item: item["f1"]) if epoch_results else None

        params.algo = "mbert"
        model_id = _save_model_result(payload, average)
        saved_rows = _save_epoch_results(model_id, params, epoch_results)
        artifact_info = None
        if str(params.mode or "").lower() == "training-final":
            artifact_info = _save_mbert_artifact(
                model=model,
                tokenizer=_get_mbert_tokenizer(),
                model_id=model_id,
                payload=payload,
                label2id=label2id,
                id2label=id2label,
                average=average,
                best_epoch=best_epoch,
            )

        return {
            "status": "done",
            "algo": "mbert",
            "task": "fine_tuning_sequence_classification_softmax",
            "splitRatio": params.splitRatio,
            "trainingName": payload.trainingName or "Untitled Training",
            "modelName": payload.modelName or "Untitled Model",
            "numLabels": len(label2id),
            "label2id": label2id,
            "id2label": {str(k): v for k, v in id2label.items()},
            "results": epoch_results,
            "average": average,
            "bestEpoch": best_epoch,
            "modelId": model_id,
            "savedEpochRows": saved_rows,
            "artifact": artifact_info,
            "datasetSize": total_samples,
            "trainSize": len(train_dataset),
            "testSize": len(test_dataset),
            "device": str(device),
        }
    finally:
        torch.backends.cudnn.deterministic = prev_cudnn_deterministic
        torch.backends.cudnn.benchmark = prev_cudnn_benchmark
        del optimizer
        if model is not None:
            del model
        if torch.cuda.is_available():
            torch.cuda.empty_cache()


def _evaluate_indobert(model, dataloader, device: torch.device) -> tuple[dict, float]:
    model.eval()
    all_true: list[int] = []
    all_pred: list[int] = []
    total_loss = 0.0
    total_steps = 0

    with torch.no_grad():
        for batch in dataloader:
            input_ids, attention_mask, labels = [x.to(device) for x in batch]
            outputs = model(
                input_ids=input_ids,
                attention_mask=attention_mask,
                labels=labels,
            )
            loss = outputs.loss
            logits = outputs.logits
            preds = torch.argmax(logits, dim=1)

            total_loss += float(loss.item())
            total_steps += 1
            all_true.extend(labels.cpu().tolist())
            all_pred.extend(preds.cpu().tolist())

    y_true = [str(v) for v in all_true]
    y_pred = [str(v) for v in all_pred]
    metrics = _compute_metrics(y_true, y_pred)
    eval_loss = (total_loss / total_steps) if total_steps > 0 else 0.0
    return metrics, round(eval_loss, 4)


def _save_model_result(payload: TrainingRequest, average: dict) -> int:
    params = payload.params
    model_payload = {
        "nama_model": payload.modelName or "Untitled Model",
        "algoritma": params.algo or None,
        "mode": params.mode,
        "split_ratio": params.splitRatio,
        "k_fold": None,
        "learning_rate": params.lr or None,
        "epoch": params.epoch,
        "batch_size": _to_int_or_none(params.batchSize),
        "max_length": _to_int_or_none(params.maxLength),
        "optimizer": params.optimizer or None,
        "weight_decay": params.weightDecay or None,
        "scheduler": params.scheduler or None,
        "dropout": params.dropout or None,
        "early_stopping": params.earlyStopping or None,
        "gradient_accumulation": params.gradAccum or None,
        "accuracy": average["accuracy"],
        "precision": average["precision"],
        "recall": average["recall"],
        "f1_score": average["f1"],
        "dataset_id": payload.datasetId,
    }

    model_insert = supabase.table("models").insert(model_payload).execute()
    inserted = model_insert.data or []
    if not inserted:
        raise HTTPException(status_code=500, detail="Gagal menyimpan ringkasan model ke database")

    model_id = inserted[0].get("id")
    if model_id is None:
        raise HTTPException(status_code=500, detail="ID model tidak ditemukan setelah insert")

    return int(model_id)


def _save_epoch_results(model_id: int, params: TrainingParams, epoch_results: list[dict]) -> int:
    rows = []
    for item in epoch_results:
        rows.append(
            {
                "model_id": model_id,
                "split_ratio": params.splitRatio,
                "learning_rate": params.lr or None,
                "batch_size": params.batchSize or None,
                "max_length": params.maxLength or None,
                "optimizer": params.optimizer or None,
                "weight_decay": params.weightDecay or None,
                "scheduler": params.scheduler or None,
                "warmup": params.warmup or None,
                "dropout": params.dropout or None,
                "early_stopping": params.earlyStopping or None,
                "gradient_accumulation": params.gradAccum or None,
                "epoch": item["epoch"],
                "accuracy": item["accuracy"],
                "precision": item["precision"],
                "recall": item["recall"],
                "f1_score": item["f1"],
                "loss": item["loss"],
                "mcc": item["mcc"],
            }
        )

    if not rows:
        return 0

    try:
        insert_res = supabase.table("model_ratio_results").insert(rows).execute()
        return len(insert_res.data or [])
    except Exception:
        # Be tolerant when epoch-detail table is not available in current Supabase schema.
        # Summary metrics are still persisted in `models`.
        return 0


def _save_mbert_artifact(
    *,
    model: AutoModelForSequenceClassification,
    tokenizer: AutoTokenizer,
    model_id: int,
    payload: TrainingRequest,
    label2id: dict,
    id2label: dict,
    average: dict,
    best_epoch: dict | None,
) -> dict:
    _MBERT_ARTIFACTS_ROOT.mkdir(parents=True, exist_ok=True)
    run_token = uuid.uuid4().hex[:8]
    out_dir = _MBERT_ARTIFACTS_ROOT / f"model_{model_id}_{run_token}"
    out_dir.mkdir(parents=True, exist_ok=True)

    model.save_pretrained(str(out_dir))
    tokenizer.save_pretrained(str(out_dir))

    metadata = {
        "modelId": int(model_id),
        "algo": "mbert",
        "trainingName": payload.trainingName or "Untitled Training",
        "modelName": payload.modelName or "Untitled Model",
        "datasetId": payload.datasetId,
        "splitRatio": payload.params.splitRatio,
        "params": payload.params.model_dump(),
        "label2id": label2id,
        "id2label": {str(k): v for k, v in id2label.items()},
        "average": average,
        "bestEpoch": best_epoch,
        "artifactDir": str(out_dir),
    }
    metadata_path = out_dir / "metadata.json"
    metadata_path.write_text(json.dumps(metadata, ensure_ascii=False, indent=2), encoding="utf-8")

    index_data: dict[str, dict] = {}
    if _MBERT_INDEX_PATH.exists():
        try:
            raw = json.loads(_MBERT_INDEX_PATH.read_text(encoding="utf-8"))
            if isinstance(raw, dict):
                index_data = raw
        except Exception:
            index_data = {}
    index_data[str(model_id)] = {
        "artifactDir": str(out_dir),
        "metadataPath": str(metadata_path),
        "modelName": metadata["modelName"],
        "datasetId": payload.datasetId,
        "splitRatio": payload.params.splitRatio,
    }
    _MBERT_INDEX_PATH.write_text(json.dumps(index_data, ensure_ascii=False, indent=2), encoding="utf-8")

    return {
        "artifactDir": str(out_dir),
        "metadataPath": str(metadata_path),
    }


@router.post("/train")
def run_processing_training(payload: TrainingRequest):
    try:
        if payload.datasetId is None:
            raise HTTPException(status_code=400, detail="datasetId wajib diisi")

        _fetch_dataset(payload.datasetId)
        raw_rows = _fetch_preprocessed_rows(payload.datasetId)
        records = _prepare_records(raw_rows)

        if len(records) < 2:
            raise HTTPException(
                status_code=400,
                detail="Data preprocessed tidak cukup untuk training (minimal 2 baris valid)",
            )

        params = payload.params
        train_pct, _ = _parse_split_ratio(params.splitRatio)
        epoch_results = _run_training_epochs(records, train_pct, params.epoch)
        average = _calculate_average(epoch_results)
        best_epoch = max(epoch_results, key=lambda item: item["f1"]) if epoch_results else None
        model_id = None
        saved_rows = 0
        if payload.saveToDb:
            model_id = _save_model_result(payload, average)
            saved_rows = _save_epoch_results(model_id, params, epoch_results)

        return {
            "status": "done",
            "mode": params.mode,
            "algo": params.algo,
            "splitRatio": params.splitRatio,
            "trainingName": payload.trainingName or "Untitled Training",
            "trainingDesc": payload.trainingDesc or "",
            "modelName": payload.modelName or "Untitled Model",
            "params": params.model_dump(),
            "results": epoch_results,
            "average": average,
            "bestEpoch": best_epoch,
            "modelId": model_id,
            "savedEpochRows": saved_rows,
            "datasetSize": len(records),
        }
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/train-indobert")
def run_indobert_training(payload: TrainingRequest):
    try:
        return _run_indobert_training_core(payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except RuntimeError as exc:
        message = str(exc)
        if "CUDA error" in message or "device-side assert triggered" in message:
            raise HTTPException(
                status_code=500,
                detail=(
                    "IndoBERT training gagal di CUDA (GPU). "
                    "Coba jalankan di CPU dengan set env `FORCE_CPU=1` lalu restart backend."
                ),
            ) from exc
        raise HTTPException(status_code=500, detail="IndoBERT training gagal diproses server") from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail="IndoBERT training gagal diproses server") from exc


@router.post("/train-indobert/start")
def start_indobert_training(payload: TrainingRequest):
    job_id = str(uuid.uuid4())
    _set_indobert_job(
        job_id,
        {
            "jobId": job_id,
            "state": "queued",
            "currentEpoch": 0,
            "totalEpoch": int(payload.params.epoch or 0),
            "progress": 0,
            "message": "Job IndoBERT sedang disiapkan",
            "result": None,
        },
    )

    def _runner():
        try:
            _set_indobert_job(job_id, {"state": "running", "message": "Training IndoBERT dimulai"})

            def _progress(epoch: int, total: int, epoch_result: dict):
                progress = int((epoch / max(total, 1)) * 100)
                _set_indobert_job(
                    job_id,
                    {
                        "state": "running",
                        "currentEpoch": epoch,
                        "totalEpoch": total,
                        "progress": progress,
                        "message": f"Epoch {epoch}/{total} selesai (F1: {epoch_result.get('f1', 0):.2f}%)",
                    },
                )

            result = _run_indobert_training_core(payload, progress_callback=_progress)
            _set_indobert_job(
                job_id,
                {
                    "state": "done",
                    "currentEpoch": int(payload.params.epoch or 0),
                    "totalEpoch": int(payload.params.epoch or 0),
                    "progress": 100,
                    "message": "Training IndoBERT selesai",
                    "result": result,
                },
            )
        except HTTPException as exc:
            _set_indobert_job(
                job_id,
                {
                    "state": "error",
                    "message": str(exc.detail),
                    "statusCode": exc.status_code,
                },
            )
        except RuntimeError as exc:
            message = str(exc)
            if "CUDA error" in message or "device-side assert triggered" in message:
                message = (
                    "IndoBERT training gagal di CUDA (GPU). "
                    "Coba jalankan di CPU dengan set env `FORCE_CPU=1` lalu restart backend."
                )
            _set_indobert_job(job_id, {"state": "error", "message": message, "statusCode": 500})
        except Exception:
            _set_indobert_job(
                job_id,
                {
                    "state": "error",
                    "message": "IndoBERT training gagal diproses server",
                    "statusCode": 500,
                },
            )

    threading.Thread(target=_runner, daemon=True).start()
    return {"jobId": job_id, "state": "queued"}


@router.get("/train-indobert/status/{job_id}")
def get_indobert_training_status(job_id: str):
    with _INDOBERT_JOBS_LOCK:
        job = _INDOBERT_JOBS.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job IndoBERT tidak ditemukan")
    return job


@router.post("/train-mbert")
def run_mbert_training(payload: TrainingRequest):
    try:
        return _run_mbert_training_core(payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except RuntimeError as exc:
        message = str(exc)
        if (
            "CUDA error" in message
            or "device-side assert triggered" in message
            or "out of memory" in message.lower()
        ):
            raise HTTPException(
                status_code=500,
                detail=(
                    "mBERT training gagal karena resource GPU/RAM tidak cukup. "
                    "Coba kecilkan batch size / max length / epoch, atau jalankan di CPU "
                    "dengan set env `FORCE_CPU=1` lalu restart backend."
                ),
            ) from exc
        raise HTTPException(status_code=500, detail="mBERT training gagal diproses server") from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail="mBERT training gagal diproses server") from exc


@router.post("/train-mbert/start")
def start_mbert_training(payload: TrainingRequest):
    job_id = str(uuid.uuid4())
    _set_mbert_job(
        job_id,
        {
            "jobId": job_id,
            "state": "queued",
            "currentEpoch": 0,
            "totalEpoch": int(payload.params.epoch or 0),
            "progress": 0,
            "message": "Job mBERT sedang disiapkan",
            "result": None,
        },
    )

    def _runner():
        try:
            _set_mbert_job(job_id, {"state": "running", "message": "Training mBERT dimulai"})

            def _progress(epoch: int, total: int, epoch_result: dict):
                progress = int((epoch / max(total, 1)) * 100)
                _set_mbert_job(
                    job_id,
                    {
                        "state": "running",
                        "currentEpoch": epoch,
                        "totalEpoch": total,
                        "progress": progress,
                        "message": f"Epoch {epoch}/{total} selesai (F1: {epoch_result.get('f1', 0):.2f}%)",
                    },
                )

            result = _run_mbert_training_core(payload, progress_callback=_progress)
            _set_mbert_job(
                job_id,
                {
                    "state": "done",
                    "currentEpoch": int(payload.params.epoch or 0),
                    "totalEpoch": int(payload.params.epoch or 0),
                    "progress": 100,
                    "message": "Training mBERT selesai",
                    "result": result,
                },
            )
        except HTTPException as exc:
            _set_mbert_job(
                job_id,
                {
                    "state": "error",
                    "message": str(exc.detail),
                    "statusCode": exc.status_code,
                },
            )
        except RuntimeError as exc:
            message = str(exc)
            if (
                "CUDA error" in message
                or "device-side assert triggered" in message
                or "out of memory" in message.lower()
            ):
                message = (
                    "mBERT training gagal karena resource GPU/RAM tidak cukup. "
                    "Coba kecilkan batch size / max length / epoch, atau jalankan di CPU "
                    "dengan set env `FORCE_CPU=1` lalu restart backend."
                )
            _set_mbert_job(job_id, {"state": "error", "message": message, "statusCode": 500})
        except Exception:
            _set_mbert_job(
                job_id,
                {
                    "state": "error",
                    "message": "mBERT training gagal diproses server",
                    "statusCode": 500,
                },
            )

    threading.Thread(target=_runner, daemon=True).start()
    return {"jobId": job_id, "state": "queued"}


@router.get("/train-mbert/status/{job_id}")
def get_mbert_training_status(job_id: str):
    with _MBERT_JOBS_LOCK:
        job = _MBERT_JOBS.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job mBERT tidak ditemukan")
    return job


@router.get("/train-mbert/artifact/{model_id}")
def get_mbert_artifact(model_id: int):
    if model_id <= 0:
        raise HTTPException(status_code=400, detail="model_id tidak valid")
    if not _MBERT_INDEX_PATH.exists():
        raise HTTPException(status_code=404, detail="Index artefak mBERT belum tersedia")
    try:
        raw = json.loads(_MBERT_INDEX_PATH.read_text(encoding="utf-8"))
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Gagal membaca index artefak mBERT") from exc
    if not isinstance(raw, dict):
        raise HTTPException(status_code=500, detail="Format index artefak mBERT tidak valid")
    item = raw.get(str(model_id))
    if not item:
        raise HTTPException(status_code=404, detail="Artefak mBERT untuk model_id ini tidak ditemukan")
    return item


@router.get("/model-ratio-results")
def get_model_ratio_results(modelIds: str):
    raw_ids = [part.strip() for part in str(modelIds or "").split(",")]
    ids: list[int] = []
    for raw in raw_ids:
        if not raw:
            continue
        try:
            val = int(raw)
            if val > 0:
                ids.append(val)
        except Exception:
            continue

    if not ids:
        raise HTTPException(status_code=400, detail="modelIds tidak valid")

    try:
        res = (
            supabase.table("model_ratio_results")
            .select(
                "model_id,split_ratio,learning_rate,batch_size,max_length,optimizer,weight_decay,scheduler,warmup,dropout,early_stopping,gradient_accumulation,epoch,accuracy,precision,recall,f1_score,loss,mcc"
            )
            .in_("model_id", ids)
            .order("model_id", desc=False)
            .order("epoch", desc=False)
            .execute()
        )
        return {"data": res.data or []}
    except Exception:
        # Fallback when detail table is unavailable: return summary rows from `models`
        # using an epoch-like shape so frontend can still render from Supabase data.
        try:
            model_res = (
                supabase.table("models")
                .select(
                    "id,split_ratio,learning_rate,batch_size,max_length,optimizer,weight_decay,scheduler,dropout,early_stopping,gradient_accumulation,epoch,accuracy,precision,recall,f1_score"
                )
                .in_("id", ids)
                .order("id", desc=False)
                .execute()
            )
            mapped = []
            for row in model_res.data or []:
                mapped.append(
                    {
                        "model_id": row.get("id"),
                        "split_ratio": row.get("split_ratio"),
                        "learning_rate": row.get("learning_rate"),
                        "batch_size": row.get("batch_size"),
                        "max_length": row.get("max_length"),
                        "optimizer": row.get("optimizer"),
                        "weight_decay": row.get("weight_decay"),
                        "scheduler": row.get("scheduler"),
                        "warmup": None,
                        "dropout": row.get("dropout"),
                        "early_stopping": row.get("early_stopping"),
                        "gradient_accumulation": row.get("gradient_accumulation"),
                        "epoch": row.get("epoch"),
                        "accuracy": row.get("accuracy"),
                        "precision": row.get("precision"),
                        "recall": row.get("recall"),
                        "f1_score": row.get("f1_score"),
                        "loss": None,
                        "mcc": None,
                    }
                )
            return {"data": mapped}
        except Exception as exc:
            raise HTTPException(status_code=500, detail="Gagal mengambil detail epoch model") from exc
