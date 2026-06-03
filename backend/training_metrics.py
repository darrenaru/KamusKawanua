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

    train_mcc_raw = merged.get("train_mcc")
    train_mcc: float | None = None
    if train_mcc_raw is not None and str(train_mcc_raw).strip() != "":
        train_mcc = _to_float(train_mcc_raw, 0.0)

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
            train_mcc=train_mcc or 0.0,
        )

    if merged.get("train_loss") is not None and str(merged.get("train_loss")).strip() != "":
        merged["train_loss"] = _to_float(merged.get("train_loss"), 0.0)
    elif "train_loss" in merged and merged.get("train_loss") is None:
        merged.pop("train_loss", None)

    if train_mcc is not None:
        merged["train_mcc"] = train_mcc
    else:
        merged.pop("train_mcc", None)

    # Schema legacy: `std_deviation` = training std dev (skala 0–1).
    train_std = merged.get("train_std_deviation")
    legacy_std = merged.get("std_deviation")
    has_train_std = train_std is not None and str(train_std).strip() != ""
    has_legacy_std = legacy_std is not None and str(legacy_std).strip() != ""
    train_f = _to_float(train_std, 0.0) if has_train_std else None
    legacy_f = _to_float(legacy_std, 0.0) if has_legacy_std else None

    def _std_on_0_1_scale(v: float) -> float:
        if v > 1.0:
            return v / 100.0
        if v > 0.15:
            return v / 100.0
        return v

    if not has_train_std and has_legacy_std:
        merged["train_std_deviation"] = legacy_f
    elif has_train_std and not has_legacy_std:
        merged["std_deviation"] = train_f
    elif has_train_std and has_legacy_std and train_f is not None and legacy_f is not None:
        train_n = _std_on_0_1_scale(train_f)
        legacy_n = _std_on_0_1_scale(legacy_f)
        # Data lama: train_std_deviation ~1.69 (persen), std_deviation sudah benar ~0.01
        if train_n > 0.15 and legacy_n <= 0.15:
            merged["train_std_deviation"] = legacy_f
        elif legacy_n > 0.15 and train_n <= 0.15:
            merged["std_deviation"] = train_f
