"""
Generasi XLM aktif untuk seluruh aplikasi (Testing, Evaluasi, Processing, pencarian).

>>> UBAH HANYA SATU BARIS DI BAWAH INI, lalu restart backend (uvicorn) dan refresh browser.

  "xlm-r"   → generasi 1 (model xlmrfinal*, tanpa XLMR2)
  "xlm-r-2" → generasi 2 (model XLMR2_*, tanpa xlmrfinal)

Opsional: env KAMUS_XLM_PROFILE atau KAMUS_XLM_GENERATION menimpa nilai di bawah (deploy/CI).
"""

from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any

# ============================================================================
# SATU-SATUNYA PENGATURAN — ganti nilai string di baris berikutnya:
# ============================================================================
ACTIVE_XLM_PROFILE: str = "xlm-r-2"
# ============================================================================

_PROFILE_GEN1 = frozenset({"xlm-r", "xlm-r-1", "gen1"})
_PROFILE_GEN2 = frozenset({"xlm-r-2", "gen2"})


def _normalize_profile_token(raw: str) -> str:
    k = str(raw or "").strip().lower().replace("_", "-")
    if k in _PROFILE_GEN1:
        return "xlm-r"
    if k in _PROFILE_GEN2:
        return "xlm-r-2"
    raise ValueError(
        f"ACTIVE_XLM_PROFILE tidak valid: {raw!r}. "
        'Gunakan "xlm-r" (generasi 1) atau "xlm-r-2" (generasi 2).'
    )


def _resolved_profile_token() -> str:
    for env_key in ("KAMUS_XLM_PROFILE", "KAMUS_XLM_GENERATION"):
        env_raw = os.getenv(env_key, "").strip()
        if env_raw:
            return _normalize_profile_token(env_raw)
    return _normalize_profile_token(ACTIVE_XLM_PROFILE)


def active_xlm_profile() -> str:
    """Slug algoritma aktif: 'xlm-r' (gen1) atau 'xlm-r-2' (gen2)."""
    return _resolved_profile_token()


def active_xlm_generation() -> str:
    """'gen1' atau 'gen2' — dipakai filter model di API/frontend."""
    return "gen1" if active_xlm_profile() == "xlm-r" else "gen2"


def active_xlm_config() -> dict[str, str]:
    profile = active_xlm_profile()
    gen = active_xlm_generation()
    return {
        "generation": gen,
        "profile": profile,
        "source": "backend/xlm_generation.py :: ACTIVE_XLM_PROFILE",
        "hint": (
            'Ubah ACTIVE_XLM_PROFILE ke "xlm-r" (gen1) atau "xlm-r-2" (gen2), '
            "restart backend, refresh browser."
        ),
    }


def is_xlm_gen2_row(row: dict[str, Any]) -> bool:
    raw = str(row.get("algoritma") or "").strip().lower().replace("_", "-")
    name = str(row.get("nama_model") or "").strip()
    if raw == "xlm-r-2":
        return True
    return name.upper().startswith("XLMR2")


def is_xlm_gen1_legacy_name(name: str) -> bool:
    return str(name or "").strip().lower().startswith("xlmrfinal")


def row_matches_xlm_generation(row: dict[str, Any], generation: str | None = None) -> bool:
    gen = generation or active_xlm_generation()
    if gen == "gen1":
        if is_xlm_gen1_legacy_name(str(row.get("nama_model") or "")):
            return True
        return not is_xlm_gen2_row(row)
    if is_xlm_gen2_row(row):
        return True
    return not is_xlm_gen1_legacy_name(str(row.get("nama_model") or ""))


def assert_xlm_model_allowed(
    *,
    model_name: str,
    algoritma: str | None = None,
) -> None:
    """Tolak model XLM generasi lain agar tidak bentrok data/testing/evaluasi."""
    name = str(model_name or "").strip()
    if not name:
        return
    row: dict[str, Any] = {
        "nama_model": name,
        "algoritma": algoritma or active_xlm_profile(),
    }
    if row_matches_xlm_generation(row):
        return
    active = active_xlm_profile()
    gen = active_xlm_generation()
    other = "xlm-r-2" if active == "xlm-r" else "xlm-r"
    raise ValueError(
        f"Model '{name}' bukan bagian XLM {gen} (profil aktif: {active}). "
        f"Ubah ACTIVE_XLM_PROFILE di backend/xlm_generation.py menjadi "
        f'"{other}" lalu restart backend, atau pilih model {gen} saja.'
    )


def _canonical_algo_key(algoritma: str) -> str | None:
    if not algoritma:
        return None
    k = str(algoritma).strip().lower().replace("_", "-")
    if k in ("indo-bert", "indobenchmark"):
        return "indobert"
    if k in ("m-bert", "multilingual-bert", "bert-base-multilingual-cased"):
        return "mbert"
    if k in ("xlm-r-2", "xlmr", "xlm-r"):
        return "xlm-r"
    if k in ("word2vec", "word-2-vec"):
        return "word2vec"
    if k == "glove":
        return "glove"
    return k or None


def filter_xlm_model_rows(
    rows: list[dict[str, Any]],
    generation: str | None = None,
) -> list[dict[str, Any]]:
    """Pisahkan baris XLM-R; untuk XLM hanya simpan generasi aktif (gen1/gen2)."""
    gen = generation or active_xlm_generation()
    non_xlm: list[dict[str, Any]] = []
    xlm_all: list[dict[str, Any]] = []

    for row in rows:
        if _canonical_algo_key(str(row.get("algoritma") or "")) != "xlm-r":
            non_xlm.append(row)
            continue
        xlm_all.append(row)

    if not xlm_all:
        return rows

    if gen == "gen1":
        gen1_named = [
            r
            for r in xlm_all
            if is_xlm_gen1_legacy_name(str(r.get("nama_model") or ""))
        ]
        kept = gen1_named if gen1_named else [r for r in xlm_all if not is_xlm_gen2_row(r)]
    else:
        gen2 = [r for r in xlm_all if is_xlm_gen2_row(r)]
        if gen2:
            kept = gen2
        else:
            kept = [
                r
                for r in xlm_all
                if not is_xlm_gen1_legacy_name(str(r.get("nama_model") or ""))
            ]
            if not kept:
                kept = xlm_all

    return non_xlm + kept


def export_frontend_snapshot() -> Path:
    """Tulis snapshot JSON agar frontend selaras tanpa duplikasi konstanta."""
    root = Path(__file__).resolve().parents[1]
    path = root / "frontend" / "admin" / "js" / "xlm-generation.snapshot.json"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(active_xlm_config(), indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    return path
