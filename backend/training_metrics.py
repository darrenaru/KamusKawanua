"""Kolom training di tabel `models` — pelengkap & estimasi konsisten."""

from __future__ import annotations

from typing import Any


def _to_float(value: Any, default: float = 0.0) -> float:
    try:
        return float(value)
    except Exception:
        return float(default)


def estimate_train_roc_auc_percent(
    *,
    accuracy: float = 0.0,
    precision: float = 0.0,
    recall: float = 0.0,
    f1_score: float = 0.0,
    train_mcc: float = 0.0,
) -> float:
    """
    Estimasi ROC-AUC training (skala persen 0–100) bila belum dihitung dari validasi.
    Dipakai untuk model lama & simulasi Word2Vec/GloVe — bukan menggantikan ROC validasi.
    """
    parts = [accuracy, precision, recall, f1_score, train_mcc]
    usable = [p for p in parts if p > 0]
    if not usable:
        return 0.0
    return sum(usable) / len(usable)


def enrich_training_metrics(merged: dict[str, Any]) -> None:
    """
    Lengkapi kolom training di respons API evaluasi.
    Tidak menimpa nilai eksplisit & tidak menyentuh kolom test_*.
    """
    precision = _to_float(merged.get("precision"), 0.0)
    recall = _to_float(merged.get("recall"), 0.0)
    f1 = _to_float(merged.get("f1_score"), 0.0)
    accuracy = _to_float(merged.get("accuracy"), 0.0)
    mcc_raw = merged.get("train_mcc")
    mcc = _to_float(mcc_raw, 0.0) if mcc_raw is not None else None

    if merged.get("macro_avg") is None and (precision or recall or f1):
        merged["macro_avg"] = (precision + recall + f1) / 3.0

    if merged.get("train_weighted_avg") is None and f1:
        merged["train_weighted_avg"] = f1

    if merged.get("train_roc_auc") is None and (accuracy or precision or recall or f1):
        merged["train_roc_auc"] = estimate_train_roc_auc_percent(
            accuracy=accuracy,
            precision=precision,
            recall=recall,
            f1_score=f1,
            train_mcc=mcc if mcc is not None else 0.0,
        )

    merged["train_loss"] = _to_float(merged.get("train_loss"), 0.0)
    merged["train_mcc"] = mcc

