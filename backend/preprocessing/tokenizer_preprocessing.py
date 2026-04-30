from __future__ import annotations

import json
import time
from typing import Literal

import torch
from fastapi import FastAPI, Query
from transformers import AutoTokenizer

from backend.main import clean_basic, get_preprocess_tokenizer
from backend.supabase_client import supabase

app = FastAPI()

TokenizerName = Literal["mbert", "indobert"]


def _build_text(row: dict) -> str:
    parts = [
        row.get("manado_clean") or row.get("manado") or "",
        row.get("indonesia_clean") or row.get("indonesia") or "",
        row.get("kalimat_manado_clean") or row.get("kalimat_manado") or "",
        row.get("kalimat_indonesia_clean") or row.get("kalimat_indonesia") or "",
    ]
    parts = [str(p).strip() for p in parts if p is not None]
    return " [SEP] ".join([p for p in parts if p])


def _needs_tokenize(row: dict) -> bool:
    # Kolom di DB bertipe text, kadang tersimpan sebagai NULL / '' / '[]'
    bad_values = (None, "", "[]")
    return (row.get("input_ids") in bad_values) or (row.get("attention_mask") in bad_values)


@app.post("/preprocess/{dataset_id}")
def preprocess(dataset_id: int, tokenizer: TokenizerName = Query("mbert")):
    """
    Legacy compatibility endpoint.

    Versi ini:
    - Tidak hardcode kredensial Supabase (pakai `backend.supabase_client`).
    - Menganggap NULL / '' / '[]' sebagai "belum diproses".
    - Menyimpan `jenis`, `input_ids`, `attention_mask`, dan `bert_tokens` secara konsisten.

    Catatan: implementasi preprocess "utama" ada di `backend.main._run_preprocess`.
    File ini dipertahankan hanya agar endpoint lama tidak merusak data.
    """

    tok = get_preprocess_tokenizer(tokenizer)
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

    all_data: list[dict] = []
    from_idx = 0
    limit = 1000

    while True:
        res = (
            supabase.table("preprocessed_data")
            .select(
                "id, dataset_id, id_kata, jenis, manado, indonesia, kalimat_manado, kalimat_indonesia, "
                "manado_clean, indonesia_clean, kalimat_manado_clean, kalimat_indonesia_clean, "
                "input_ids, attention_mask"
            )
            .eq("dataset_id", dataset_id)
            .range(from_idx, from_idx + limit - 1)
            .execute()
        )
        data = res.data or []
        if not data:
            break
        all_data.extend([r for r in data if _needs_tokenize(r)])
        if len(data) < limit:
            break
        from_idx += limit

    total = len(all_data)
    success = 0
    failed = 0

    for row in all_data:
        try:
            text = _build_text(row)
            text = clean_basic(text)
            if not text.strip():
                failed += 1
                continue

            encoded = tok(
                text,
                padding="max_length",
                truncation=True,
                max_length=64,
                return_tensors="pt",
            )
            input_ids_tensor = encoded["input_ids"].to(device)
            attention_mask_tensor = encoded["attention_mask"].to(device)
            input_ids = input_ids_tensor.squeeze(0).detach().cpu().tolist()
            attention_mask = attention_mask_tensor.squeeze(0).detach().cpu().tolist()
            bert_tokens = tok.convert_ids_to_tokens(input_ids)

            jenis_val = row.get("jenis")
            if (not jenis_val) and row.get("id_kata"):
                jenis_res = (
                    supabase.table("raw_data")
                    .select("jenis")
                    .eq("dataset_id", dataset_id)
                    .eq("id_kata", str(row.get("id_kata")))
                    .limit(1)
                    .execute()
                )
                if jenis_res.data:
                    jenis_val = jenis_res.data[0].get("jenis")

            supabase.table("preprocessed_data").update(
                {
                    "jenis": jenis_val,
                    "bert_tokens": json.dumps(bert_tokens),
                    "input_ids": json.dumps(input_ids),
                    "attention_mask": json.dumps(attention_mask),
                }
            ).eq("id", row["id"]).execute()

            success += 1
            time.sleep(0.01)
        except Exception as e:
            failed += 1
            print("ERROR:", row.get("id"), e)

    return {
        "status": "done",
        "total": total,
        "success": success,
        "failed": failed,
        "device": str(device),
        "tokenizer": tokenizer,
    }