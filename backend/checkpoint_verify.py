"""Verify HuggingFace checkpoints under backend/trained_models/."""

from __future__ import annotations

import os


def verify_trained_model_dir(model_dir: str) -> dict:
    """
    Return a health report for a trained_models/<name> folder.
    Does not load weights — only checks expected artifacts exist.
    """
    issues: list[str] = []
    if not os.path.isdir(model_dir):
        return {
            "ok": False,
            "model_dir": model_dir,
            "issues": ["directory does not exist"],
            "files": [],
        }

    try:
        names = os.listdir(model_dir)
    except OSError as exc:
        return {
            "ok": False,
            "model_dir": model_dir,
            "issues": [f"cannot list directory: {exc}"],
            "files": [],
        }

    file_set = set(names)
    if "config.json" not in file_set:
        issues.append("missing config.json")
    if "label_map.json" not in file_set:
        issues.append("missing label_map.json")
    if not ({"model.safetensors", "pytorch_model.bin"} & file_set):
        issues.append("missing model weights (model.safetensors or pytorch_model.bin)")
    tokenizer_markers = {
        "tokenizer_config.json",
        "tokenizer.json",
        "vocab.txt",
        "spiece.model",
        "sentencepiece.bpe.model",
    }
    if not (tokenizer_markers & file_set):
        issues.append("missing tokenizer files")

    holdout_ok = "model_holdout.json" in file_set
    return {
        "ok": len(issues) == 0,
        "model_dir": model_dir,
        "issues": issues,
        "files": sorted(names),
        "has_holdout": holdout_ok,
    }
