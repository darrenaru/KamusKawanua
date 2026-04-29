from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

import os
import pandas as pd
from rapidfuzz import fuzz
import numpy as np
import torch
from transformers import BertTokenizer, BertModel, AutoTokenizer

import json
import time
import re
import threading
import uuid
from Sastrawi.Stemmer.StemmerFactory import StemmerFactory

from backend.supabase_client import supabase


app = FastAPI()

# =========================
# CORS
# =========================
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# =========================
# ROUTERS
# =========================
from backend.processing.router import router as processing_router
from backend.testing.router import router as testing_router

app.include_router(processing_router)
app.include_router(testing_router)

# =========================
# STEMMER
# =========================
factory = StemmerFactory()
stemmer = factory.create_stemmer()

# =========================
# STOPWORD & SLANG
# =========================
def load_stopwords():
    res = supabase.table("stopwords").select("word").execute()
    return set([row["word"] for row in (res.data or [])])

def load_slang():
    res = supabase.table("slang_words").select("*").execute()
    return {row["slang"]: row["formal"] for row in (res.data or [])}

# =========================
# CLEAN BASIC
# =========================
def clean_basic(text):
    if not text:
        return ""

    text = text.lower()
    text = re.sub(r'[^a-zA-Z\s]', ' ', text)
    text = re.sub(r'(.)\1{2,}', r'\1', text)
    text = re.sub(r'\s+', ' ', text).strip()

    return text

# =========================
# TOKEN PROCESSING
# =========================
def process_word(text, slang_dict, tok):
    """
    Tokenisasi kata harus konsisten memakai tokenizer yang dipilih (mbert/indobert),
    bukan hardcoded ke tokenizer mBERT.
    """
    text = clean_basic(text)
    tokens = tok.tokenize(text)
    return [slang_dict.get(t, t) for t in tokens]


def process_sentence(text, slang_dict, stopwords, tok):
    text = clean_basic(text)

    tokens = tok.tokenize(text)

    # slang normalize
    tokens = [slang_dict.get(t, t) for t in tokens]

    # stopword remove
    tokens = [t for t in tokens if t not in stopwords]

    return tokens

# =========================
# LOAD DATA (SEARCH)
# =========================
def load_data():
    try:
        all_data = []
        batch_size = 1000
        start = 0

        while True:
            response = supabase.table("dictionary") \
                .select("*") \
                .range(start, start + batch_size - 1) \
                .execute()

            data = response.data

            if not data:
                break

            all_data.extend(data)

            if len(data) < batch_size:
                break

            start += batch_size

        df = pd.DataFrame(all_data)

        print("TOTAL DATA:", len(df))
        return df

    except Exception as e:
        print("SUPABASE ERROR:", e)
        return pd.DataFrame()

# =========================
# LOGIN
# =========================
class LoginRequest(BaseModel):
    username: str
    password: str

@app.post("/login")
def login(data: LoginRequest):
    try:
        response = supabase.table("users") \
            .select("*") \
            .eq("username", data.username) \
            .eq("password", data.password) \
            .execute()

        if response.data:
            return {"success": True, "message": "Login successful"}
        else:
            return {"success": False, "message": "Username or password is incorrect"}

    except Exception as e:
        return {"success": False, "error": str(e)}

# =========================
# EMBEDDINGS
# =========================
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
emb_path = os.path.join(BASE_DIR, "data", "embeddings.npy")

try:
    embeddings = np.load(emb_path)
except:
    embeddings = []

# =========================
# TOKENIZER (SEARCH + PREPROCESS)
# =========================
# Search embedding tetap pakai mBERT (multilingual) agar stabil untuk manado/inggris juga.
tokenizer = BertTokenizer.from_pretrained("bert-base-multilingual-cased")
model = BertModel.from_pretrained("bert-base-multilingual-cased")

# Preprocess tokenizer bisa dipilih via query param (mbert/indobert)
tokenizer_pre_mbert = AutoTokenizer.from_pretrained("bert-base-multilingual-cased")
tokenizer_pre_indobert = AutoTokenizer.from_pretrained("indobenchmark/indobert-base-p2")

PREPROCESS_JOBS: dict[str, dict] = {}
PREPROCESS_JOBS_LOCK = threading.Lock()


def get_preprocess_tokenizer(name: str):
    name = (name or "").lower().strip()
    if name in ("indobert", "indo-bert", "indobenchmark"):
        return tokenizer_pre_indobert
    return tokenizer_pre_mbert

def encode(text):
    inputs = tokenizer(text, return_tensors='pt', truncation=True, padding=True)
    with torch.no_grad():
        outputs = model(**inputs)
    return outputs.last_hidden_state[:, 0, :].squeeze().numpy()

# =========================
# UTIL
# =========================
def cosine_similarity(a, b):
    return np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b))

def normalize(text):
    text = str(text).lower().strip()
    text = text.replace("aa", "a").replace("ee", "e")
    text = text.replace("ii", "i").replace("oo", "o").replace("uu", "u")
    return text

def highlight_match(text, query):
    text_str = str(text)
    text_lower = text_str.lower()
    query_lower = query.lower()

    if query_lower in text_lower:
        start = text_lower.index(query_lower)
        end = start + len(query_lower)
        return text_str[:start] + "<mark>" + text_str[start:end] + "</mark>" + text_str[end:]

    return text_str

# =========================
# ROOT
# =========================
@app.get("/")
def root():
    return {"message": "API aktif"}

# =========================
# 🔥 PREPROCESS FINAL (FULL FIX)
# =========================
def _create_preprocess_job(dataset_id: int, tokenizer_name: str) -> dict:
    job_id = uuid.uuid4().hex
    job = {
        "job_id": job_id,
        "status": "queued",
        "message": "queued",
        "dataset_id": dataset_id,
        "tokenizer": tokenizer_name,
        "total": 0,
        "processed": 0,
        "failed": 0,
        "device": None,
        "error": None,
        "cancel_requested": False,
    }
    with PREPROCESS_JOBS_LOCK:
        PREPROCESS_JOBS[job_id] = job
    return job


def _update_preprocess_job(job_id: str, **kwargs):
    with PREPROCESS_JOBS_LOCK:
        job = PREPROCESS_JOBS.get(job_id)
        if not job:
            return
        job.update(kwargs)


def _get_preprocess_job(job_id: str) -> dict | None:
    with PREPROCESS_JOBS_LOCK:
        job = PREPROCESS_JOBS.get(job_id)
        if not job:
            return None
        return dict(job)


def _is_preprocess_cancelled(job_id: str | None) -> bool:
    if not job_id:
        return False
    job = _get_preprocess_job(job_id)
    return bool(job and job.get("cancel_requested"))


def _run_preprocess(dataset_id: int, tokenizer: str = "mbert", job_id: str | None = None):

    stopwords = load_stopwords()
    slang_dict = load_slang()
    tok = get_preprocess_tokenizer(tokenizer)
    if job_id:
        _update_preprocess_job(job_id, status="running", message="seeding data")

    # Seed preprocessed_data dari raw_data untuk dataset baru (jika belum ada baris).
    existing_res = (
        supabase.table("preprocessed_data")
        .select("id")
        .eq("dataset_id", dataset_id)
        .range(0, 0)
        .execute()
    )
    existing = existing_res.data or []
    if not existing:
        raw_from = 0
        raw_limit = 1000
        seed_rows: list[dict] = []
        seed_seen_keys: set[str] = set()
        # Filtering sederhana agar model tidak belajar dari data yang terlalu pendek/panjang
        # atau duplikat yang identik.
        min_combined_chars = 3
        max_combined_chars = 400
        min_word_count = 2
        max_word_count = 250
        while True:
            raw_res = (
                supabase.table("raw_data")
                .select(
                    "dataset_id, id_kata, jenis, manado, indonesia, kalimat_manado, kalimat_indonesia"
                )
                .eq("dataset_id", dataset_id)
                .range(raw_from, raw_from + raw_limit - 1)
                .execute()
            )
            raw_data = raw_res.data or []
            if not raw_data:
                break

            for r in raw_data:
                jenis = r.get("jenis")
                manado_clean = clean_basic(r.get("manado"))
                indonesia_clean = clean_basic(r.get("indonesia"))
                kal_manado_clean = clean_basic(r.get("kalimat_manado"))
                kal_indonesia_clean = clean_basic(r.get("kalimat_indonesia"))

                combined = " ".join(
                    [manado_clean, indonesia_clean, kal_manado_clean, kal_indonesia_clean]
                ).strip()

                if (
                    not combined
                    or len(combined) < min_combined_chars
                    or len(combined) > max_combined_chars
                ):
                    continue

                words = [w for w in combined.split() if w]
                if len(words) < min_word_count or len(words) > max_word_count:
                    continue

                # Deduplikasi: hindari pasangan input yang benar-benar sama.
                dedupe_key = "|".join(
                    [
                        str(jenis or "").strip().lower(),
                        manado_clean,
                        indonesia_clean,
                        kal_manado_clean,
                        kal_indonesia_clean,
                    ]
                )
                if dedupe_key in seed_seen_keys:
                    continue
                seed_seen_keys.add(dedupe_key)

                seed_rows.append(
                    {
                        "dataset_id": int(r.get("dataset_id") or dataset_id),
                        "id_kata": str(r.get("id_kata") or ""),
                        "jenis": jenis,
                        "manado": r.get("manado"),
                        "indonesia": r.get("indonesia"),
                        "kalimat_manado": r.get("kalimat_manado"),
                        "kalimat_indonesia": r.get("kalimat_indonesia"),
                        "manado_clean": manado_clean,
                        "indonesia_clean": indonesia_clean,
                        "kalimat_manado_clean": kal_manado_clean,
                        "kalimat_indonesia_clean": kal_indonesia_clean,
                    }
                )

            if len(raw_data) < raw_limit:
                break
            raw_from += raw_limit

        if seed_rows:
            batch_size = 500
            for i in range(0, len(seed_rows), batch_size):
                supabase.table("preprocessed_data").insert(
                    seed_rows[i : i + batch_size]
                ).execute()

    all_data = []
    from_idx = 0
    limit = 1000

    while True:
        res = supabase.table("preprocessed_data") \
            .select("id, manado, indonesia, kalimat_manado, kalimat_indonesia, manado_clean, indonesia_clean") \
            .eq("dataset_id", dataset_id) \
            .is_("input_ids", None) \
            .range(from_idx, from_idx + limit - 1) \
            .execute()

        data = res.data

        if not data:
            break

        all_data.extend(data)

        if len(data) < limit:
            break

        from_idx += limit

    total = len(all_data)
    print("TOTAL:", total)
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print("PREPROCESS DEVICE:", device)
    if job_id:
        _update_preprocess_job(
            job_id,
            total=total,
            device=str(device),
            message=f"tokenizing 0/{total}",
        )

    success = 0
    failed = 0

    for row in all_data:
        if _is_preprocess_cancelled(job_id):
            if job_id:
                _update_preprocess_job(
                    job_id,
                    status="cancelled",
                    message=f"cancelled at {success}/{total}",
                    processed=success,
                    failed=failed,
                )
            return {
                "status": "cancelled",
                "total": total,
                "success": success,
                "failed": failed,
                "device": str(device),
            }
        try:
            # =========================
            # WORD TOKEN
            # =========================
            manado_tokens = process_word(row.get("manado_clean"), slang_dict, tok)
            indonesia_tokens = process_word(row.get("indonesia_clean"), slang_dict, tok)

            # =========================
            # SENTENCE PIPELINE (FULL NLP)
            # =========================
            def pipeline_sentence(text):
                text = clean_basic(text)

                tokens = tok.tokenize(text)

                clean_tokens = []

                for t in tokens:
                    if t in ["[CLS]", "[SEP]", "[PAD]"]:
                        continue

                    t = t.replace("##", "")

                    # slang normalize
                    if t in slang_dict:
                        t = slang_dict[t]

                    # stopword remove
                    if t in stopwords:
                        continue

                    clean_tokens.append(t)

                return clean_tokens

            kal_manado = pipeline_sentence(row.get("kalimat_manado"))
            kal_indo = pipeline_sentence(row.get("kalimat_indonesia"))

            # =========================
            # FINAL TEXT FOR BERT
            # =========================
            final_text = (
                " ".join(manado_tokens) + " [SEP] " +
                " ".join(indonesia_tokens) + " [SEP] " +
                " ".join(kal_indo)
            )

            # NOTE: gunakan tokenizer sesuai pilihan (mBERT / IndoBERT).
            encoded = tok(
                final_text,
                padding="max_length",
                truncation=True,
                max_length=64,
                return_tensors="pt",
            )
            input_ids_tensor = encoded["input_ids"].to(device)
            attention_mask_tensor = encoded["attention_mask"].to(device)
            input_ids = input_ids_tensor.squeeze(0).detach().cpu().tolist()
            attention_mask = attention_mask_tensor.squeeze(0).detach().cpu().tolist()

            tokens = tok.convert_ids_to_tokens(input_ids)

            # =========================
            # SAVE ALL
            # =========================
            supabase.table("preprocessed_data").update({

                # WORD
                "manado_tokens": json.dumps(manado_tokens),
                "indonesia_tokens": json.dumps(indonesia_tokens),

                # SENTENCE CLEAN
                "kalimat_manado_clean": " ".join(kal_manado),
                "kalimat_indonesia_clean": " ".join(kal_indo),

                # SENTENCE TOKENS
                "kalimat_manado_tokens": json.dumps(kal_manado),
                "kalimat_indonesia_tokens": json.dumps(kal_indo),

                # FINAL BERT
                "bert_tokens": json.dumps(tokens),
                "input_ids": json.dumps(input_ids),
                "attention_mask": json.dumps(attention_mask)

            }).eq("id", row["id"]).execute()

            success += 1
            print(f"{success}/{total}")
            if job_id:
                _update_preprocess_job(
                    job_id,
                    processed=success,
                    failed=failed,
                    message=f"tokenizing {success}/{total}",
                )

            time.sleep(0.01)

        except Exception as e:
            failed += 1
            print("ERROR:", row["id"], e)
            if job_id:
                _update_preprocess_job(
                    job_id,
                    processed=success,
                    failed=failed,
                    message=f"tokenizing {success}/{total} (failed: {failed})",
                )

    result = {
        "status": "done",
        "total": total,
        "success": success,
        "failed": failed,
        "device": str(device),
    }
    if job_id:
        _update_preprocess_job(
            job_id,
            status="done",
            message=f"done {success}/{total}",
            processed=success,
            failed=failed,
            device=str(device),
        )
    return result


@app.post("/preprocess/{dataset_id}")
def preprocess(dataset_id: int, tokenizer: str = Query("mbert")):
    return _run_preprocess(dataset_id=dataset_id, tokenizer=tokenizer, job_id=None)


@app.post("/preprocess/start/{dataset_id}")
def start_preprocess(dataset_id: int, tokenizer: str = Query("mbert")):
    job = _create_preprocess_job(dataset_id=dataset_id, tokenizer_name=tokenizer)

    def _worker():
        try:
            _run_preprocess(dataset_id=dataset_id, tokenizer=tokenizer, job_id=job["job_id"])
        except Exception as e:
            _update_preprocess_job(
                job["job_id"],
                status="error",
                message="error",
                error=str(e),
            )

    t = threading.Thread(target=_worker, daemon=True)
    t.start()
    return {
        "job_id": job["job_id"],
        "status": "queued",
        "dataset_id": dataset_id,
        "tokenizer": tokenizer,
    }


@app.get("/preprocess/status/{job_id}")
def preprocess_status(job_id: str):
    job = _get_preprocess_job(job_id)
    if not job:
        return {"job_id": job_id, "status": "not_found", "message": "job_id not found"}
    total = int(job.get("total") or 0)
    processed = int(job.get("processed") or 0)
    percent = int((processed / total) * 100) if total > 0 else 0
    return {
        "job_id": job["job_id"],
        "status": job.get("status"),
        "message": job.get("message"),
        "dataset_id": job.get("dataset_id"),
        "tokenizer": job.get("tokenizer"),
        "device": job.get("device"),
        "total": total,
        "processed": processed,
        "failed": int(job.get("failed") or 0),
        "percent": percent,
        "error": job.get("error"),
    }


@app.post("/preprocess/cancel/{job_id}")
def cancel_preprocess(job_id: str):
    job = _get_preprocess_job(job_id)
    if not job:
        return {"job_id": job_id, "status": "not_found", "message": "job_id not found"}
    if job.get("status") in ("done", "error", "cancelled"):
        return {
            "job_id": job_id,
            "status": job.get("status"),
            "message": f"cannot cancel, job already {job.get('status')}",
        }
    _update_preprocess_job(job_id, cancel_requested=True, message="cancel requested")
    return {"job_id": job_id, "status": "cancelling", "message": "cancel requested"}

# =========================
# SEARCH (TIDAK DIUBAH)
# =========================
@app.get("/search")
def search(query: str, lang: str):

    df = load_data()

    print("TOTAL DATA:", len(df))
    print("COLUMNS:", df.columns)

    if df.empty:
        return {
            "query": query,
            "results": [],
            "error": "The database is empty, RLS is not enabled, or the Supabase request failed."
        }

    manado_words = set(df['manado'].astype(str))
    indo_words = set(df['indonesia'].astype(str))
    eng_words = set(df['inggris'].astype(str))

    def get_suggestion(query, lang):

        if lang == "manado":
            words = manado_words
        elif lang == "indonesia":
            words = indo_words
        elif lang == "inggris":
            words = eng_words
        else:
            return None

        scored = []

        for word in words:
            score = fuzz.ratio(query.lower(), word.lower())
            scored.append((word, score))

        scored = sorted(scored, key=lambda x: x[1], reverse=True)

        suggestions = [
            word for word, score in scored
            if score >= 70 and word.lower() != query.lower()
        ][:3]

        return suggestions if suggestions else None

    def format_result(row, lang, query_original, score, method):

        return {
            "manado": highlight_match(row['manado'], query_original),
            "indonesia": highlight_match(row['indonesia'], query_original),
            "inggris": highlight_match(row['inggris'], query_original),

            "kalimat_manado": highlight_match(row.get('kalimat_manado', '-'), query_original),
            "kalimat_indonesia": highlight_match(row.get('kalimat_indonesia', '-'), query_original),
            "kalimat_inggris": highlight_match(row.get('kalimat_inggris', '-'), query_original),

            "score": round(float(score), 3),
            "method": method
        }

    query_original = query
    query_norm = normalize(query)

    # Prioritas 1: exact match dari dictionary.
    # Jika exact ditemukan, langsung kembalikan hasil exact agar tidak tercampur
    # dengan partial/fuzzy/semantic.
    if lang == "manado":
        exact_rows = df[df["manado"].astype(str).apply(normalize) == query_norm]
    elif lang == "indonesia":
        exact_rows = df[df["indonesia"].astype(str).apply(normalize) == query_norm]
    elif lang == "inggris":
        exact_rows = df[df["inggris"].astype(str).apply(normalize) == query_norm]
    else:
        return {"message": "Parameter 'lang' is required."}

    if not exact_rows.empty:
        exact_results = []
        for _, row in exact_rows.head(5).iterrows():
            exact_results.append(format_result(row, lang, query_original, 1.0, "exact"))
        return {
            "query": query_original,
            "results": exact_results
        }

    results = []

    for idx, row in df.iterrows():
        manado = normalize(row['manado'])
        indo = normalize(row['indonesia'])
        eng = normalize(row['inggris'])

        if lang == "manado":
            target = manado
        elif lang == "indonesia":
            target = indo
        elif lang == "inggris":
            target = eng
        else:
            return {"message": "Parameter 'lang' is required."}

        if query_norm == target:
            results.append(format_result(row, lang, query_original, 1.0, "exact"))

        elif query_norm in target and len(query_norm) >= 4:
            results.append(format_result(row, lang, query_original, 0.85, "partial"))

        else:
            fuzzy_score = fuzz.ratio(query_norm, target) / 100
            if fuzzy_score >= 0.8:
                results.append(format_result(row, lang, query_original, fuzzy_score, "fuzzy"))

    results = sorted(results, key=lambda x: x['score'], reverse=True)[:5]

    if not results:
        query_emb = encode(query_original)

        similarities = []

        for i, emb in enumerate(embeddings):
            sim = cosine_similarity(query_emb, emb)
            similarities.append((i, sim))

        similarities = sorted(similarities, key=lambda x: x[1], reverse=True)

        top_k = similarities[:5]

        for idx, sim in top_k:
            row = df.iloc[idx]
            results.append(format_result(row, lang, query_original, sim, "semantic"))

    if not results:
        suggestion = get_suggestion(query_original, lang)

        return {
            "query": query_original,
            "results": [],
            "message": "No matching kata was found.",
            "suggestion": suggestion
        }

    return {
        "query": query_original,
        "results": results
    }