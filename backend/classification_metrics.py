"""Metrik klasifikasi bersama (training & testing)."""

from __future__ import annotations

import numpy as np
from sklearn.metrics import roc_auc_score
from sklearn.preprocessing import label_binarize


def multiclass_roc_auc_weighted(
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
