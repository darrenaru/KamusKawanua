from __future__ import annotations

import json
import os
import re
from dataclasses import dataclass
from datetime import datetime, timezone

import numpy as np
import torch
from sklearn.metrics import (
    accuracy_score,
    matthews_corrcoef,
    precision_recall_fscore_support,
)
from sklearn.model_selection import train_test_split
from torch.utils.data import DataLoader, Dataset
from transformers import (
    AutoModelForSequenceClassification,
    AutoTokenizer,
    get_linear_schedule_with_warmup,
)

from backend.supabase_client import supabase


INDOBERT_MODEL_ID = "indobenchmark/indobert-base-p2"
MBERT_MODEL_ID = "bert-base-multilingual-cased"


def _safe_name(name: str) -> str:
    name = name.strip()
    name = re.sub(r"[^a-zA-Z0-9._-]+", "_", name)
    return name[:80] if name else "model"


def _parse_ratio(split_ratio: str) -> tuple[float, float]:
    a, b = split_ratio.split(":")
    train = int(a)
    test = int(b)
    if train + test != 100:
        raise ValueError("split_ratio harus total 100 (mis: 80:20)")
    return train / 100.0, test / 100.0


def _build_text(row: dict) -> str:
    # Pipeline utama hanya pakai kolom manado/indonesia + kalimatnya.
    parts = [
        row.get("manado_clean") or row.get("manado") or "",
        row.get("indonesia_clean") or row.get("indonesia") or "",
        row.get("kalimat_manado_clean") or row.get("kalimat_manado") or "",
        row.get("kalimat_indonesia_clean") or row.get("kalimat_indonesia") or "",
    ]
    parts = [str(p).strip() for p in parts if p is not None]
    return " [SEP] ".join([p for p in parts if p])


def _normalize_algorithm_label(label: str) -> str:
    raw = str(label or "").strip().lower()
    if raw in {"mbert", "m-bert", "bert-base-multilingual-cased"}:
        return "mbert"
    if raw in {"indobert", "indo-bert", INDOBERT_MODEL_ID.lower()}:
        return "indobert"
    return raw or "unknown"


def _persist_model_registry(
    *,
    dataset_id: int,
    model_name: str,
    split_ratio: str,
    lr: float,
    epoch: int,
    batch_size: int,
    max_length: int,
    weight_decay: float,
    warmup_ratio: float,
    dropout: float,
    grad_accum: int,
    early_stopping_patience: int,
    algorithm_label: str,
    training_mode: str,
    metrics: list[dict],
) -> None:
    if not model_name:
        return

    latest = metrics[-1] if metrics else {}
    now_iso = datetime.now(timezone.utc).isoformat()
    normalized_algorithm = _normalize_algorithm_label(algorithm_label)
    normalized_mode = str(training_mode or "").strip().lower()
    if normalized_mode not in {"cari-rasio", "training-final"}:
        normalized_mode = "training-final"

    full_payload = {
        "nama_model": model_name,
        "algoritma": normalized_algorithm,
        "mode": normalized_mode,
        "dataset_id": dataset_id,
        "split_ratio": split_ratio,
        "learning_rate": float(lr),
        "epoch": int(epoch),
        "batch_size": int(batch_size),
        "max_length": int(max_length),
        "optimizer": "adamw",
        "weight_decay": float(weight_decay),
        "scheduler": "linear_warmup",
        "dropout": float(dropout),
        "early_stopping": int(early_stopping_patience),
        "gradient_accumulation": int(grad_accum),
        "accuracy": float((latest.get("accuracy") or 0.0) * 100.0),
        "precision": float((latest.get("precision_macro") or 0.0) * 100.0),
        "recall": float((latest.get("recall_macro") or 0.0) * 100.0),
        "f1_score": float((latest.get("f1_macro") or 0.0) * 100.0),
        "created_at": now_iso,
    }
    core_payload = {
        "nama_model": model_name,
        "algoritma": normalized_algorithm,
        "mode": normalized_mode,
        "dataset_id": dataset_id,
        "split_ratio": split_ratio,
        "learning_rate": float(lr),
        "epoch": int(epoch),
        "batch_size": int(batch_size),
        "max_length": int(max_length),
        "optimizer": "adamw",
        "weight_decay": float(weight_decay),
        "scheduler": "linear_warmup",
        "dropout": float(dropout),
        "early_stopping": int(early_stopping_patience),
        "gradient_accumulation": int(grad_accum),
        "accuracy": float((latest.get("accuracy") or 0.0) * 100.0),
        "precision": float((latest.get("precision_macro") or 0.0) * 100.0),
        "recall": float((latest.get("recall_macro") or 0.0) * 100.0),
        "f1_score": float((latest.get("f1_macro") or 0.0) * 100.0),
        "created_at": now_iso,
    }
    minimal_payload = {
        "nama_model": model_name,
        "algoritma": normalized_algorithm,
        "mode": normalized_mode,
        "dataset_id": dataset_id,
        "max_length": int(max_length),
        "created_at": now_iso,
    }

    try:
        existing = (
            supabase.table("models")
            .select("id")
            .eq("nama_model", model_name)
            .range(0, 0)
            .execute()
        )
        existing_row = (existing.data or [None])[0]

        payload_candidates = [full_payload, core_payload, minimal_payload]
        if existing_row and existing_row.get("id") is not None:
            model_id = existing_row["id"]
            last_error: Exception | None = None
            for payload in payload_candidates:
                try:
                    (
                        supabase.table("models")
                        .update(payload)
                        .eq("id", model_id)
                        .execute()
                    )
                    return
                except Exception as e:
                    last_error = e
            if last_error:
                raise last_error
            return

        last_error = None
        for payload in payload_candidates:
            try:
                supabase.table("models").insert(payload).execute()
                return
            except Exception as e:
                last_error = e
        if last_error:
            raise last_error
    except Exception as e:
        # Jangan gagalkan training hanya karena registry gagal ditulis.
        print("WARN: gagal menyimpan registry model ke Supabase:", e)


@dataclass(frozen=True)
class TrainBatch:
    input_ids: torch.Tensor
    attention_mask: torch.Tensor
    labels: torch.Tensor


class TextClsDataset(Dataset):
    def __init__(
        self,
        texts: list[str],
        labels: list[int],
        tokenizer: AutoTokenizer,
        max_length: int,
    ) -> None:
        self.texts = texts
        self.labels = labels
        self.tokenizer = tokenizer
        self.max_length = max_length

    def __len__(self) -> int:
        return len(self.texts)

    def __getitem__(self, idx: int) -> dict:
        enc = self.tokenizer(
            self.texts[idx],
            truncation=True,
            padding="max_length",
            max_length=self.max_length,
            return_tensors="pt",
        )
        return {
            "input_ids": enc["input_ids"].squeeze(0),
            "attention_mask": enc["attention_mask"].squeeze(0),
            "labels": torch.tensor(self.labels[idx], dtype=torch.long),
        }


def _fetch_preprocessed_rows(dataset_id: int) -> list[dict]:
    all_rows: list[dict] = []
    from_idx = 0
    limit = 1000
    while True:
        res = (
            supabase.table("preprocessed_data")
            .select(
                "id, jenis, manado, indonesia, kalimat_manado, kalimat_indonesia, "
                "manado_clean, indonesia_clean, kalimat_manado_clean, kalimat_indonesia_clean"
            )
            .eq("dataset_id", dataset_id)
            .range(from_idx, from_idx + limit - 1)
            .execute()
        )
        data = res.data or []
        if not data:
            break
        all_rows.extend(data)
        if len(data) < limit:
            break
        from_idx += limit
    return all_rows


def _fetch_raw_rows(dataset_id: int) -> list[dict]:
    all_rows: list[dict] = []
    from_idx = 0
    limit = 1000
    while True:
        res = (
            supabase.table("raw_data")
            .select(
                "id, jenis, manado, indonesia, kalimat_manado, kalimat_indonesia"
            )
            .eq("dataset_id", dataset_id)
            .range(from_idx, from_idx + limit - 1)
            .execute()
        )
        data = res.data or []
        if not data:
            break
        all_rows.extend(data)
        if len(data) < limit:
            break
        from_idx += limit
    return all_rows


def _make_label_maps(rows: list[dict]) -> tuple[dict[str, int], dict[int, str]]:
    labels = sorted({str(r.get("jenis") or "").strip() for r in rows})
    labels = [l for l in labels if l]
    if not labels:
        raise ValueError("Kolom 'jenis' kosong. Pastikan dataset punya label (jenis).")
    label2id = {l: i for i, l in enumerate(labels)}
    id2label = {i: l for l, i in label2id.items()}
    return label2id, id2label


def train_indobert_softmax(
    *,
    dataset_id: int,
    model_name: str,
    split_ratio: str,
    lr: float,
    epoch: int,
    batch_size: int,
    max_length: int,
    weight_decay: float,
    warmup_ratio: float,
    dropout: float,
    grad_accum: int,
    early_stopping_patience: int,
    training_mode: str = "training-final",
    base_model_id: str = INDOBERT_MODEL_ID,
    on_epoch_end=None,
) -> dict:
    rows = _fetch_preprocessed_rows(dataset_id)
    data_source = "preprocessed_data"
    if not rows:
        # Fallback: tetap bisa training dari raw_data jika preprocessing belum menyimpan hasil.
        raw_rows = _fetch_raw_rows(dataset_id)
        if raw_rows:
            rows = [
                {
                    "id": r.get("id"),
                    "jenis": r.get("jenis"),
                    "manado": r.get("manado"),
                    "indonesia": r.get("indonesia"),
                    "kalimat_manado": r.get("kalimat_manado"),
                    "kalimat_indonesia": r.get("kalimat_indonesia"),
                    "manado_clean": r.get("manado"),
                    "indonesia_clean": r.get("indonesia"),
                    "kalimat_manado_clean": r.get("kalimat_manado"),
                    "kalimat_indonesia_clean": r.get("kalimat_indonesia"),
                }
                for r in raw_rows
            ]
            data_source = "raw_data(fallback)"

    if not rows:
        raise ValueError(
            "Data preprocessed_data tidak ditemukan atau kosong untuk dataset_id yang diberikan. "
            "Pastikan proses preprocessing telah berhasil dan data tersimpan dengan benar sebelum "
            "digunakan pada tahap processing."
        )

    texts: list[str] = []
    raw_labels: list[str] = []
    for r in rows:
        t = _build_text(r)
        y = str(r.get("jenis") or "").strip()
        if t and y:
            texts.append(t)
            raw_labels.append(y)

    if len(texts) < 10:
        raise ValueError("Data terlalu sedikit untuk training (min 10 baris valid).")

    label2id, id2label = _make_label_maps([{"jenis": y} for y in raw_labels])
    y_all = [label2id[y] for y in raw_labels]

    # label distribution
    label_counts: dict[str, int] = {k: 0 for k in label2id.keys()}
    for y in raw_labels:
        if y in label_counts:
            label_counts[y] += 1

    # Stratified split biar distribusi kelas di train/val seimbang.
    train_frac, _ = _parse_ratio(split_ratio)
    idx_all = np.arange(len(texts))
    train_idx, val_idx = train_test_split(
        idx_all,
        train_size=train_frac,
        random_state=42,
        shuffle=True,
        stratify=y_all if len(set(y_all)) > 1 else None,
    )
    train_idx = np.array(train_idx)
    val_idx = np.array(val_idx)

    tokenizer = AutoTokenizer.from_pretrained(base_model_id)
    model = AutoModelForSequenceClassification.from_pretrained(
        base_model_id,
        num_labels=len(label2id),
        id2label=id2label,
        label2id=label2id,
        classifier_dropout=dropout,
        hidden_dropout_prob=dropout,
        attention_probs_dropout_prob=dropout,
    )

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    model.to(device)

    train_ds = TextClsDataset(
        [texts[i] for i in train_idx.tolist()],
        [y_all[i] for i in train_idx.tolist()],
        tokenizer,
        max_length,
    )
    val_ds = TextClsDataset(
        [texts[i] for i in val_idx.tolist()],
        [y_all[i] for i in val_idx.tolist()],
        tokenizer,
        max_length,
    )

    train_loader = DataLoader(train_ds, batch_size=batch_size, shuffle=True)
    val_loader = DataLoader(val_ds, batch_size=batch_size, shuffle=False)

    optimizer = torch.optim.AdamW(model.parameters(), lr=lr, weight_decay=weight_decay)

    # Class-weighted loss untuk mengatasi imbalance (kelas minoritas diberi bobot lebih besar).
    counts = np.array([label_counts[id2label[i]] for i in range(len(label2id))], dtype=np.float32)
    counts = np.clip(counts, 1.0, None)
    inv = 1.0 / counts
    weights = inv / inv.mean()
    class_weights = torch.tensor(weights, dtype=torch.float32, device=device)
    loss_fn = torch.nn.CrossEntropyLoss(weight=class_weights)

    total_steps = max(1, (len(train_loader) * epoch) // max(1, grad_accum))
    warmup_steps = int(total_steps * warmup_ratio)
    scheduler = get_linear_schedule_with_warmup(
        optimizer, num_warmup_steps=warmup_steps, num_training_steps=total_steps
    )

    best_f1 = -1.0
    bad_epochs = 0
    metrics: list[dict] = []

    for ep in range(1, epoch + 1):
        model.train()
        train_losses: list[float] = []
        optimizer.zero_grad(set_to_none=True)

        for step, batch in enumerate(train_loader, start=1):
            input_ids = batch["input_ids"].to(device)
            attention_mask = batch["attention_mask"].to(device)
            labels = batch["labels"].to(device)

            out = model(input_ids=input_ids, attention_mask=attention_mask)
            loss_raw = loss_fn(out.logits, labels)
            loss = loss_raw / max(1, grad_accum)
            loss.backward()
            train_losses.append(float(loss_raw.detach().cpu()))

            if step % max(1, grad_accum) == 0 or step == len(train_loader):
                torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
                optimizer.step()
                scheduler.step()
                optimizer.zero_grad(set_to_none=True)

        # validation
        model.eval()
        val_losses: list[float] = []
        y_true: list[int] = []
        y_pred: list[int] = []

        with torch.no_grad():
            for batch in val_loader:
                input_ids = batch["input_ids"].to(device)
                attention_mask = batch["attention_mask"].to(device)
                labels = batch["labels"].to(device)

                out = model(input_ids=input_ids, attention_mask=attention_mask)
                val_loss = loss_fn(out.logits, labels)
                val_losses.append(float(val_loss.detach().cpu()))
                preds = torch.argmax(out.logits, dim=-1)
                y_true.extend(labels.detach().cpu().tolist())
                y_pred.extend(preds.detach().cpu().tolist())

        acc = accuracy_score(y_true, y_pred)
        prec, rec, f1, _ = precision_recall_fscore_support(
            y_true, y_pred, average="macro", zero_division=0
        )
        mcc = matthews_corrcoef(y_true, y_pred) if y_true and y_pred else 0.0

        # Confusion matrix untuk validasi pada epoch ini.
        confusion_matrix = None
        confusion_labels = None
        if y_true and y_pred:
            num_labels = len(label2id)
            if num_labels > 0:
                conf = np.zeros((num_labels, num_labels), dtype=int)
                for t, p in zip(y_true, y_pred):
                    ti = int(t)
                    pi = int(p)
                    if 0 <= ti < num_labels and 0 <= pi < num_labels:
                        conf[ti, pi] += 1
                confusion_matrix = conf.tolist()
                confusion_labels = [id2label[i] for i in range(len(label2id))]

        m = {
            "epoch": ep,
            "train_loss": float(np.mean(train_losses)) if train_losses else 0.0,
            "val_loss": float(np.mean(val_losses)) if val_losses else 0.0,
            "accuracy": float(acc),
            "precision_macro": float(prec),
            "recall_macro": float(rec),
            "f1_macro": float(f1),
            "mcc": float(mcc),
            "confusion_matrix": confusion_matrix,
            "confusion_labels": confusion_labels,
        }
        metrics.append(m)
        if on_epoch_end:
            try:
                on_epoch_end(m)
            except Exception:
                pass

        if m["f1_macro"] > best_f1:
            best_f1 = m["f1_macro"]
            bad_epochs = 0
        else:
            bad_epochs += 1

        if early_stopping_patience and bad_epochs >= early_stopping_patience:
            break

    # save model
    base_dir = os.path.dirname(os.path.abspath(__file__))
    model_root = os.path.abspath(os.path.join(base_dir, "..", "trained_models"))
    os.makedirs(model_root, exist_ok=True)

    safe_model_name = _safe_name(model_name)
    model_dir = os.path.join(model_root, safe_model_name)
    os.makedirs(model_dir, exist_ok=True)

    model.save_pretrained(model_dir)
    tokenizer.save_pretrained(model_dir)
    with open(os.path.join(model_dir, "label_map.json"), "w", encoding="utf-8") as f:
        json.dump({"label2id": label2id, "id2label": id2label}, f, ensure_ascii=False)

    result = {
        "status": "ok",
        "data_source": data_source,
        "device": str(device),
        "num_labels": len(label2id),
        "label2id": label2id,
        "id2label": id2label,
        "label_counts": label_counts,
        "metrics": metrics,
        "model_dir": model_dir,
    }

    algorithm_label = "mbert" if base_model_id == MBERT_MODEL_ID else "indobert"
    _persist_model_registry(
        dataset_id=dataset_id,
        model_name=safe_model_name,
        split_ratio=split_ratio,
        lr=lr,
        epoch=epoch,
        batch_size=batch_size,
        max_length=max_length,
        weight_decay=weight_decay,
        warmup_ratio=warmup_ratio,
        dropout=dropout,
        grad_accum=grad_accum,
        early_stopping_patience=early_stopping_patience,
        algorithm_label=algorithm_label,
        training_mode=training_mode,
        metrics=metrics,
    )
    return result


def train_mbert_softmax(
    *,
    dataset_id: int,
    model_name: str,
    split_ratio: str,
    lr: float,
    epoch: int,
    batch_size: int,
    max_length: int,
    weight_decay: float,
    warmup_ratio: float,
    dropout: float,
    grad_accum: int,
    early_stopping_patience: int,
    training_mode: str = "training-final",
    on_epoch_end=None,
) -> dict:
    # Gunakan helper yang sama seperti IndoBERT, hanya beda base HF model.
    return train_indobert_softmax(
        dataset_id=dataset_id,
        model_name=model_name,
        split_ratio=split_ratio,
        lr=lr,
        epoch=epoch,
        batch_size=batch_size,
        max_length=max_length,
        weight_decay=weight_decay,
        warmup_ratio=warmup_ratio,
        dropout=dropout,
        grad_accum=grad_accum,
        early_stopping_patience=early_stopping_patience,
        training_mode=training_mode,
        base_model_id=MBERT_MODEL_ID,
        on_epoch_end=on_epoch_end,
    )


def predict_indobert_softmax(*, text: str, model_name: str, max_length: int) -> dict:
    base_dir = os.path.dirname(os.path.abspath(__file__))
    model_root = os.path.abspath(os.path.join(base_dir, "..", "trained_models"))
    model_dir = os.path.join(model_root, _safe_name(model_name))
    if not os.path.isdir(model_dir):
        raise ValueError("Model belum ada. Train dulu atau cek model_name.")

    tokenizer = AutoTokenizer.from_pretrained(model_dir)
    model = AutoModelForSequenceClassification.from_pretrained(model_dir)

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    model.to(device)
    model.eval()

    enc = tokenizer(
        text, truncation=True, padding="max_length", max_length=max_length, return_tensors="pt"
    )
    enc = {k: v.to(device) for k, v in enc.items()}

    with torch.no_grad():
        logits = model(**enc).logits.squeeze(0)
        probs = torch.softmax(logits, dim=-1).detach().cpu().numpy().tolist()

    id2label = model.config.id2label or {i: str(i) for i in range(len(probs))}
    probs_map = {id2label[i]: float(p) for i, p in enumerate(probs)}

    best_i = int(np.argmax(probs))
    return {
        "label": id2label[best_i],
        "score": float(probs[best_i]),
        "probs": probs_map,
    }


def predict_mbert_softmax(*, text: str, model_name: str, max_length: int) -> dict:
    # Model yang tersimpan sudah menyertakan arsitektur + config, jadi prediksi
    # cukup load dari trained_models tanpa perlu mengetahui base model id.
    return predict_indobert_softmax(text=text, model_name=model_name, max_length=max_length)

