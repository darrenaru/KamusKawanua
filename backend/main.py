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
from backend.evaluasi.router import router as evaluasi_router

app.include_router(processing_router)
app.include_router(testing_router)
app.include_router(evaluasi_router)

# =========================
# STEMMER (Sastrawi — dipakai untuk kolom bahasa Indonesia saat preprocess mBERT)
# =========================
factory = StemmerFactory()
stemmer = factory.create_stemmer()


def _preprocess_tokenizer_is_mbert(name: str) -> bool:
    """True untuk mBERT / multilingual; False untuk IndoBERT."""
    n = (name or "").lower().strip()
    return n not in ("indobert", "indo-bert", "indobenchmark")


def _maybe_stem_indonesian_for_preprocess(text: str, tokenizer_mode: str) -> str:
    """
    Stemming Sastrawi untuk teks Indonesia bila tokenizer preprocess = mBERT.
    IndoBERT tidak di-stem (konsisten dengan catatan README / subword tokenizer).
    """
    if not text or not str(text).strip():
        return text or ""
    if not _preprocess_tokenizer_is_mbert(tokenizer_mode):
        return text
    try:
        return stemmer.stem(str(text).strip()).strip()
    except Exception:
        return str(text).strip()


def pipeline_sentence_from_clean(
    text_clean: str,
    slang_dict: dict,
    stopwords: set,
    tok,
) -> list:
    """Kalimat sudah clean_basic (+ stem jika mBERT). Tokenize BERT + slang + stopword."""
    text = (text_clean or "").strip()
    if not text:
        return []
    tokens = tok.tokenize(text)
    clean_tokens: list[str] = []
    for t in tokens:
        if t in ["[CLS]", "[SEP]", "[PAD]"]:
            continue
        t = t.replace("##", "")
        if t in slang_dict:
            t = slang_dict[t]
        if t in stopwords:
            continue
        clean_tokens.append(t)
    return clean_tokens

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


class StopwordPayload(BaseModel):
    word: str
    language: str | None = None


class SlangPayload(BaseModel):
    slang: str
    formal: str

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


def _normalize_stopword_language(value: str | None) -> str:
    raw = str(value or "").strip().lower()
    if raw in {"id", "indo", "indonesia", "bahasa_indonesia"}:
        return "indonesia"
    return "manado"


@app.get("/preprocess/stopwords")
def list_stopwords(language: str = Query("manado")):
    language = _normalize_stopword_language(language)
    try:
        try:
            res = (
                supabase.table("stopwords")
                .select("word,language")
                .eq("language", language)
                .order("word")
                .execute()
            )
            items = res.data or []
        except Exception:
            # Fallback schema lama: tabel hanya punya kolom word.
            res = (
                supabase.table("stopwords")
                .select("word")
                .order("word")
                .execute()
            )
            items = res.data or []
            items = [{"word": row.get("word"), "language": language} for row in items]
        return {"items": items, "language": language}
    except Exception as e:
        return {"items": [], "error": str(e)}


@app.post("/preprocess/stopwords")
def add_stopword(payload: StopwordPayload):
    word = str(payload.word or "").strip().lower()
    language = _normalize_stopword_language(payload.language)
    if not word:
        return {"status": "error", "message": "word is required"}
    try:
        try:
            exists = (
                supabase.table("stopwords")
                .select("word")
                .eq("word", word)
                .eq("language", language)
                .range(0, 0)
                .execute()
            )
        except Exception:
            exists = (
                supabase.table("stopwords")
                .select("word")
                .eq("word", word)
                .range(0, 0)
                .execute()
            )
        if exists.data:
            return {"status": "ok", "message": "already exists", "word": word, "language": language}
        try:
            supabase.table("stopwords").insert({"word": word, "language": language}).execute()
        except Exception:
            supabase.table("stopwords").insert({"word": word}).execute()
        return {"status": "ok", "word": word, "language": language}
    except Exception as e:
        return {"status": "error", "message": str(e)}


@app.delete("/preprocess/stopwords/{word}")
def delete_stopword(word: str, language: str = Query("manado")):
    safe_word = str(word or "").strip().lower()
    language = _normalize_stopword_language(language)
    if not safe_word:
        return {"status": "error", "message": "word is required"}
    try:
        try:
            supabase.table("stopwords").delete().eq("word", safe_word).eq("language", language).execute()
        except Exception:
            supabase.table("stopwords").delete().eq("word", safe_word).execute()
        return {"status": "ok", "word": safe_word, "language": language}
    except Exception as e:
        return {"status": "error", "message": str(e)}


@app.get("/preprocess/slang")
def list_slang_words():
    try:
        res = (
            supabase.table("slang_words")
            .select("slang,formal")
            .order("slang")
            .execute()
        )
        return {"items": res.data or []}
    except Exception as e:
        return {"items": [], "error": str(e)}


@app.post("/preprocess/slang")
def add_slang_word(payload: SlangPayload):
    slang = str(payload.slang or "").strip().lower()
    formal = str(payload.formal or "").strip().lower()
    if not slang or not formal:
        return {"status": "error", "message": "slang and formal are required"}
    try:
        exists = (
            supabase.table("slang_words")
            .select("slang")
            .eq("slang", slang)
            .range(0, 0)
            .execute()
        )
        if exists.data:
            (
                supabase.table("slang_words")
                .update({"formal": formal})
                .eq("slang", slang)
                .execute()
            )
            return {"status": "ok", "message": "updated", "slang": slang, "formal": formal}
        supabase.table("slang_words").insert({"slang": slang, "formal": formal}).execute()
        return {"status": "ok", "slang": slang, "formal": formal}
    except Exception as e:
        return {"status": "error", "message": str(e)}


@app.delete("/preprocess/slang/{slang}")
def delete_slang_word(slang: str):
    safe_slang = str(slang or "").strip().lower()
    if not safe_slang:
        return {"status": "error", "message": "slang is required"}
    try:
        supabase.table("slang_words").delete().eq("slang", safe_slang).execute()
        return {"status": "ok", "slang": safe_slang}
    except Exception as e:
        return {"status": "error", "message": str(e)}

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


def _get_best_indobert_model_name() -> str | None:
    try:
        res = (
            supabase.table("models")
            .select("nama_model,algoritma,accuracy,created_at")
            .order("accuracy", desc=True)
            .order("created_at", desc=True)
            .execute()
        )
        rows = res.data or []
    except Exception:
        return None

    for row in rows:
        algo = str(row.get("algoritma") or "").strip().lower().replace("_", "-")
        if algo in ("indobert", "indo-bert", "indobenchmark"):
            name = str(row.get("nama_model") or "").strip()
            if name:
                return name
    return None


def _normalize_algo_name(algoritma: str) -> str:
    return str(algoritma or "").strip().lower().replace("_", "-")


def _algo_family_from_row(algoritma: str) -> str | None:
    a = _normalize_algo_name(algoritma)
    if a in ("indobert", "indo-bert", "indobenchmark"):
        return "indobert"
    # Sertakan variasi umum nama HF / label UI supaya baris Supabase tetap terdeteksi.
    if a in (
        "mbert",
        "m-bert",
        "multilingual-bert",
        "bert-base-multilingual-cased",
        "bert-multilingual-cased",
        "bert-multilingual",
    ):
        return "mbert"
    if a.startswith("bert-") and "multilingual" in a:
        return "mbert"
    return None


def _fetch_models_ordered() -> list[dict]:
    try:
        res = (
            supabase.table("models")
            .select("*")
            .order("accuracy", desc=True)
            .order("created_at", desc=True)
            .execute()
        )
        return list(res.data or [])
    except Exception:
        return []


def _params_from_model_row(row: dict | None) -> dict | None:
    if not row:
        return None
    keys = (
        "nama_model",
        "algoritma",
        "split_ratio",
        "k_fold",
        "learning_rate",
        "epoch",
        "batch_size",
        "max_length",
        "optimizer",
        "weight_decay",
        "scheduler",
        "warmup",
        "dropout",
        "early_stopping",
        "gradient_accumulation",
        "accuracy",
    )
    out = {}
    for k in keys:
        if k in row and row[k] is not None:
            out[k] = row[k]
    return out or None


def _max_length_from_model_row(row: dict | None, default: int = 64) -> int:
    if not row:
        return default
    try:
        n = int(row.get("max_length") or default)
        if n <= 0:
            return default
        return min(n, 512)
    except (TypeError, ValueError):
        return default


def _empty_search_model_bundle() -> dict:
    return {
        "model_analyses": [],
        "predicted_jenis": None,
        "model_used": None,
        "predicted_jenis_mbert": None,
        "model_used_mbert": None,
        "model_consensus": None,
    }


def _compute_model_consensus(analyses: list | None) -> dict | None:
    """Majority vote over algorithm labels; tie-break by higher average confidence."""
    if not analyses:
        return None

    votes: list[dict] = []
    for a in analyses:
        if not a.get("available"):
            continue
        lab = a.get("label")
        if lab is None or str(lab).strip() == "":
            continue
        votes.append(
            {
                "norm": str(lab).strip().lower(),
                "display": str(lab).strip(),
                "confidence": float(a.get("confidence") or 0.0),
            }
        )

    consensus_norm: str | None = None
    consensus_display: str | None = None
    majority_count = 0
    total_with_prediction = len(votes)
    vote_counts: dict[str, int] = {}

    if votes:
        by_norm: dict[str, list] = {}
        for v in votes:
            by_norm.setdefault(v["norm"], []).append(v)

        counts = {k: len(v) for k, v in by_norm.items()}
        majority_count = max(counts.values())
        candidates = [k for k, c in counts.items() if c == majority_count]

        if len(candidates) == 1:
            consensus_norm = candidates[0]
        else:
            best_avg = -1.0
            for cn in candidates:
                confs = [x["confidence"] for x in by_norm[cn]]
                avg = sum(confs) / len(confs)
                if avg > best_avg:
                    best_avg = avg
                    consensus_norm = cn

        consensus_display = by_norm[consensus_norm][0]["display"]
        vote_counts = {
            by_norm[k][0]["display"]: len(by_norm[k]) for k in by_norm
        }

    per_algorithm: list[dict] = []
    for a in analyses:
        dn = str(a.get("display_name") or a.get("algorithm") or "?")
        algo = str(a.get("algorithm") or "")
        if not a.get("available"):
            per_algorithm.append(
                {
                    "display_name": dn,
                    "algorithm": algo,
                    "label": None,
                    "confidence": None,
                    "matches_consensus": None,
                    "role": "unavailable",
                    "detail": a.get("error"),
                }
            )
            continue
        lab = a.get("label")
        if lab is None or str(lab).strip() == "":
            per_algorithm.append(
                {
                    "display_name": dn,
                    "algorithm": algo,
                    "label": None,
                    "confidence": a.get("confidence"),
                    "matches_consensus": None,
                    "role": "no_prediction",
                    "detail": None,
                }
            )
            continue
        nrm = str(lab).strip().lower()
        disp = str(lab).strip()
        matches = consensus_norm is not None and nrm == consensus_norm
        per_algorithm.append(
            {
                "display_name": dn,
                "algorithm": algo,
                "label": disp,
                "confidence": a.get("confidence"),
                "matches_consensus": matches,
                "role": "majority" if matches else "minority",
                "detail": None,
            }
        )

    return {
        "consensus_label": consensus_display,
        "consensus_label_normalized": consensus_norm,
        "majority_count": majority_count,
        "total_with_prediction": total_with_prediction,
        "vote_counts": vote_counts,
        "per_algorithm": per_algorithm,
    }


def _run_dual_model_analysis(query_original: str, use_model: bool) -> dict:
    bundle = _empty_search_model_bundle()
    if not use_model:
        return bundle

    try:
        from backend.processing.service import predict_indobert_softmax, predict_mbert_softmax
    except Exception:
        return bundle

    models_ordered = _fetch_models_ordered()

    def append_failure(
        family: str,
        display_name: str,
        *,
        error: str,
        nama: str | None = None,
        params: dict | None = None,
        ml: int | None = None,
    ):
        bundle["model_analyses"].append(
            {
                "algorithm": family,
                "display_name": display_name,
                "available": False,
                "error": error,
                "label": None,
                "confidence": None,
                "model_name": nama,
                "parameters": params,
                "max_length_used": ml,
            }
        )

    def run_one(family: str, display_name: str, predict_fn):
        rows = [
            row
            for row in models_ordered
            if _algo_family_from_row(str(row.get("algoritma") or "")) == family
        ]
        if not rows:
            append_failure(
                family,
                display_name,
                error=f"No trained {display_name} model found in the database.",
            )
            return

        last_err: str | None = None
        last_nama: str | None = None
        last_params: dict | None = None
        last_ml: int | None = None

        for row in rows:
            nama = str(row.get("nama_model") or "").strip()
            ml = _max_length_from_model_row(row)
            params = _params_from_model_row(row)
            last_nama = nama or last_nama
            last_params = params
            last_ml = ml

            if not nama:
                last_err = "Model row has empty nama_model."
                continue

            try:
                pred = predict_fn(text=query_original, model_name=nama, max_length=ml)
                label = str(pred.get("label") or "").strip() or None
                conf = pred.get("score")
                bundle["model_analyses"].append(
                    {
                        "algorithm": family,
                        "display_name": display_name,
                        "available": True,
                        "error": None,
                        "label": label,
                        "confidence": round(float(conf), 6) if conf is not None else None,
                        "model_name": nama,
                        "parameters": params,
                        "max_length_used": ml,
                    }
                )
                if family == "indobert":
                    bundle["predicted_jenis"] = label
                    bundle["model_used"] = nama
                elif family == "mbert":
                    bundle["predicted_jenis_mbert"] = label
                    bundle["model_used_mbert"] = nama
                return
            except Exception as e:
                last_err = str(e)
                continue

        append_failure(
            family,
            display_name,
            error=last_err
            or f"Could not load any saved {display_name} checkpoint (check trained_models folder).",
            nama=last_nama,
            params=last_params,
            ml=last_ml,
        )

    run_one("indobert", "IndoBERT", predict_indobert_softmax)
    run_one("mbert", "mBERT", predict_mbert_softmax)
    bundle["model_consensus"] = _compute_model_consensus(bundle["model_analyses"])
    return bundle


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


def _invalidate_preprocess_output_columns(
    dataset_id: int, id_kata_filter: list[str] | None = None
) -> None:
    """
    Kosongkan kolom keluaran tokenizer agar semua baris masuk antrian preprocess lagi
    (Sastrawi + subword tokenizer, final_text, input_ids, dll.).
    """
    payload = {
        "input_ids": None,
        "attention_mask": None,
        "bert_tokens": None,
        "manado_tokens": None,
        "indonesia_tokens": None,
        "kalimat_manado_tokens": None,
        "kalimat_indonesia_tokens": None,
        "final_text": None,
        "jenis_label": None,
    }
    query = supabase.table("preprocessed_data").update(payload).eq("dataset_id", dataset_id)
    if id_kata_filter:
        query = query.in_("id_kata", id_kata_filter)
    query.execute()


def _run_preprocess(
    dataset_id: int,
    tokenizer: str = "mbert",
    job_id: str | None = None,
    force_retokenize: bool = False,
    id_kata_filter: list[str] | None = None,
):

    stopwords = load_stopwords()
    slang_dict = load_slang()
    tok = get_preprocess_tokenizer(tokenizer)
    if job_id:
        _update_preprocess_job(job_id, status="running", message="seeding data")

    if force_retokenize:
        if job_id:
            _update_preprocess_job(
                job_id,
                message="mereset token; memproses ulang (stem Indonesia jika mBERT)",
            )
        _invalidate_preprocess_output_columns(dataset_id, id_kata_filter=id_kata_filter)

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
                indonesia_clean = _maybe_stem_indonesian_for_preprocess(
                    indonesia_clean, tokenizer
                )
                kal_indonesia_clean = _maybe_stem_indonesian_for_preprocess(
                    kal_indonesia_clean, tokenizer
                )

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
        # Ambil baris yang belum benar-benar diproses.
        # Catatan: beberapa dataset lama menyimpan kolom text ini sebagai '' atau '[]',
        # sehingga tidak terjaring kalau hanya filter IS NULL.
        query = (
            supabase.table("preprocessed_data")
            .select(
                "id, id_kata, jenis, manado, indonesia, kalimat_manado, kalimat_indonesia, "
                "manado_clean, indonesia_clean, kalimat_manado_clean, kalimat_indonesia_clean"
            )
            .eq("dataset_id", dataset_id)
            .or_(
                "input_ids.is.null,input_ids.eq.[],input_ids.eq.\"\","
                "attention_mask.is.null,attention_mask.eq.[],attention_mask.eq.\"\","
                "bert_tokens.is.null,bert_tokens.eq.[],bert_tokens.eq.\"\","
                "manado_tokens.is.null,manado_tokens.eq.[],manado_tokens.eq.\"\","
                "indonesia_tokens.is.null,indonesia_tokens.eq.[],indonesia_tokens.eq.\"\","
                "kalimat_manado_tokens.is.null,kalimat_manado_tokens.eq.[],kalimat_manado_tokens.eq.\"\","
                "kalimat_indonesia_tokens.is.null,kalimat_indonesia_tokens.eq.[],kalimat_indonesia_tokens.eq.\"\","
                "final_text.is.null,final_text.eq.\"\",jenis_label.is.null"
            )
        )
        if id_kata_filter:
            query = query.in_("id_kata", id_kata_filter)
        res = query.range(from_idx, from_idx + limit - 1).execute()

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
    jenis_values = sorted(
        {
            str(r.get("jenis") or "").strip()
            for r in all_data
            if str(r.get("jenis") or "").strip()
        }
    )
    jenis_label_map = {jenis: idx for idx, jenis in enumerate(jenis_values)}

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
            manado_clean = clean_basic(row.get("manado_clean") or row.get("manado"))
            indonesia_clean = clean_basic(row.get("indonesia_clean") or row.get("indonesia"))
            kalimat_manado_clean = clean_basic(
                row.get("kalimat_manado_clean") or row.get("kalimat_manado")
            )
            kalimat_indonesia_clean = clean_basic(
                row.get("kalimat_indonesia_clean") or row.get("kalimat_indonesia")
            )
            indonesia_clean = _maybe_stem_indonesian_for_preprocess(
                indonesia_clean, tokenizer
            )
            kalimat_indonesia_clean = _maybe_stem_indonesian_for_preprocess(
                kalimat_indonesia_clean, tokenizer
            )
            # =========================
            # WORD TOKEN
            # =========================
            manado_tokens = process_word(manado_clean, slang_dict, tok)
            indonesia_tokens = process_word(indonesia_clean, slang_dict, tok)

            # =========================
            # SENTENCE PIPELINE (FULL NLP)
            # =========================
            kal_manado = pipeline_sentence_from_clean(
                kalimat_manado_clean, slang_dict, stopwords, tok
            )
            kal_indo = pipeline_sentence_from_clean(
                kalimat_indonesia_clean, slang_dict, stopwords, tok
            )

            # =========================
            # FINAL TEXT FOR BERT
            # =========================
            final_text = " [SEP] ".join(
                [
                    p
                    for p in [
                        " ".join(manado_tokens),
                        " ".join(indonesia_tokens),
                        " ".join(kal_manado),
                        " ".join(kal_indo),
                    ]
                    if p
                ]
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
            # Pastikan label `jenis` ikut tersimpan konsisten (seed/preprocess lama kadang kosong).
            # Jika `jenis` masih kosong, coba ambil dari raw_data berdasarkan (dataset_id, id_kata).
            jenis_val = row.get("jenis")
            if not jenis_val and row.get("id_kata"):
                try:
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
                except Exception as e:
                    print("WARN: failed to backfill jenis:", e)
            jenis_key = str(jenis_val or "").strip()
            if jenis_key and jenis_key not in jenis_label_map:
                jenis_label_map[jenis_key] = len(jenis_label_map)

            supabase.table("preprocessed_data").update({
                "manado_clean": manado_clean,
                "indonesia_clean": indonesia_clean,
                "kalimat_manado_clean": kalimat_manado_clean,
                "kalimat_indonesia_clean": kalimat_indonesia_clean,

                # WORD
                "manado_tokens": json.dumps(manado_tokens),
                "indonesia_tokens": json.dumps(indonesia_tokens),

                # SENTENCE TOKENS
                "kalimat_manado_tokens": json.dumps(kal_manado),
                "kalimat_indonesia_tokens": json.dumps(kal_indo),

                # FINAL BERT
                "final_text": final_text,
                "bert_tokens": json.dumps(tokens),
                "input_ids": json.dumps(input_ids),
                "attention_mask": json.dumps(attention_mask),

                # LABEL
                "jenis": jenis_val,
                "jenis_label": jenis_label_map.get(jenis_key),

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
def preprocess(
    dataset_id: int,
    tokenizer: str = Query("mbert"),
    force_retokenize: bool = Query(False),
    id_kata_filter: str | None = Query(None),
):
    parsed_id_kata_filter = None
    if id_kata_filter:
        parsed_id_kata_filter = [
            str(x).strip() for x in id_kata_filter.split(",") if str(x).strip()
        ]
    return _run_preprocess(
        dataset_id=dataset_id,
        tokenizer=tokenizer,
        job_id=None,
        force_retokenize=force_retokenize,
        id_kata_filter=parsed_id_kata_filter,
    )


@app.post("/preprocess/start/{dataset_id}")
def start_preprocess(
    dataset_id: int,
    tokenizer: str = Query("mbert"),
    force_retokenize: bool = Query(False),
    id_kata_filter: str | None = Query(None),
):
    parsed_id_kata_filter = None
    if id_kata_filter:
        parsed_id_kata_filter = [
            str(x).strip() for x in id_kata_filter.split(",") if str(x).strip()
        ]
    job = _create_preprocess_job(dataset_id=dataset_id, tokenizer_name=tokenizer)

    def _worker():
        try:
            _run_preprocess(
                dataset_id=dataset_id,
                tokenizer=tokenizer,
                job_id=job["job_id"],
                force_retokenize=force_retokenize,
                id_kata_filter=parsed_id_kata_filter,
            )
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
# SEARCH (multi-model: IndoBERT + mBERT)
# =========================
@app.get("/search")
def search(query: str, lang: str, use_model: bool = True):
    query_original = query or ""
    lang = (lang or "").lower().strip()
    if not query_original.strip():
        return {
            "query": query_original,
            "results": [],
            "message": "Query cannot be empty.",
            **_empty_search_model_bundle(),
        }
    if lang not in ("manado", "indonesia", "inggris"):
        return {"message": "Parameter 'lang' is required.", **_empty_search_model_bundle()}

    # Normalize once and reuse everywhere.
    query_norm = normalize(clean_basic(query_original))

    model_bundle = _run_dual_model_analysis(query_original, use_model)
    predicted_jenis_indo = model_bundle.get("predicted_jenis")
    predicted_jenis_mbert = model_bundle.get("predicted_jenis_mbert")

    def row_boost_matches(jenis_norm: str) -> bool:
        if not jenis_norm:
            return False
        pi = str(predicted_jenis_indo or "").strip().lower()
        pm = str(predicted_jenis_mbert or "").strip().lower()
        return (bool(pi) and jenis_norm == pi) or (bool(pm) and jenis_norm == pm)

    def format_result(row, lang, query_original, score, method):
        # `row` bisa berupa dict (Supabase) atau pandas Series (DataFrame).
        row_jenis = str(row.get("jenis") or "").strip()
        row_jenis_norm = row_jenis.lower()
        pred_indo_norm = str(predicted_jenis_indo or "").strip().lower()
        pred_mbert_norm = str(predicted_jenis_mbert or "").strip().lower()
        match_indo = bool(
            pred_indo_norm and row_jenis_norm and row_jenis_norm == pred_indo_norm
        )
        match_mbert = bool(
            pred_mbert_norm and row_jenis_norm and row_jenis_norm == pred_mbert_norm
        )
        return {
            "manado": highlight_match(row["manado"], query_original),
            "indonesia": highlight_match(row["indonesia"], query_original),
            "inggris": highlight_match(row["inggris"], query_original),
            "jenis": row_jenis,

            "kalimat_manado": highlight_match(row.get("kalimat_manado", "-"), query_original),
            "kalimat_indonesia": highlight_match(row.get("kalimat_indonesia", "-"), query_original),
            "kalimat_inggris": highlight_match(row.get("kalimat_inggris", "-"), query_original),

            "score": round(float(score), 3),
            "method": method,
            "model_match": match_indo or match_mbert,
            "model_match_indobert": match_indo,
            "model_match_mbert": match_mbert,
        }

    # Prioritas 1: exact match langsung ke tabel Supabase `dictionary`.
    # Ini mencegah fuzzy/semantic mengambil kata yang mirip (mis. "sampah")
    # ketika exact match tersedia (mis. "sapa").
    try:
        # `ilike` tanpa wildcard = case-insensitive exact match.
        exact_db = supabase.table("dictionary").select("*").ilike(lang, query_norm).limit(5).execute()
        if exact_db.data:
            exact_results = [
                format_result(row, lang, query_original, 1.0, "exact")
                for row in exact_db.data
            ]
            return {
                "query": query_original,
                "results": exact_results,
                **model_bundle,
            }
    except Exception as e:
        # Jika Supabase error (mis. RLS / network), fallback ke DataFrame-based search di bawah.
        print("SUPABASE EXACT ERROR:", e)

    df = load_data()

    print("TOTAL DATA:", len(df))
    print("COLUMNS:", df.columns)

    if df.empty:
        return {
            "query": query_original,
            "results": [],
            "error": "The database is empty, RLS is not enabled, or the Supabase request failed.",
            **model_bundle,
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

    # `format_result` sudah didefinisikan di atas agar bisa dipakai untuk hasil exact_db.

    # Prioritas 1: exact match dari dictionary.
    # Jika exact ditemukan, langsung kembalikan hasil exact agar tidak tercampur
    # dengan partial/fuzzy/semantic.
    if lang == "manado":
        exact_rows = df[df["manado"].astype(str).apply(lambda v: normalize(clean_basic(v))) == query_norm]
    elif lang == "indonesia":
        exact_rows = df[df["indonesia"].astype(str).apply(lambda v: normalize(clean_basic(v))) == query_norm]
    elif lang == "inggris":
        exact_rows = df[df["inggris"].astype(str).apply(lambda v: normalize(clean_basic(v))) == query_norm]

    if not exact_rows.empty:
        exact_results = []
        for _, row in exact_rows.head(5).iterrows():
            exact_results.append(format_result(row, lang, query_original, 1.0, "exact"))
        return {
            "query": query_original,
            "results": exact_results,
            **model_bundle,
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
            return {"message": "Parameter 'lang' is required.", **model_bundle}

        if query_norm == target:
            base_score = 1.0
            if row_boost_matches(str(row.get("jenis") or "").strip().lower()):
                base_score = min(1.0, base_score + 0.1)
            results.append(format_result(row, lang, query_original, base_score, "exact"))

        elif query_norm in target and len(query_norm) >= 4:
            score = 0.85
            if row_boost_matches(str(row.get("jenis") or "").strip().lower()):
                score = min(1.0, score + 0.1)
            results.append(format_result(row, lang, query_original, score, "partial"))

        else:
            fuzzy_score = fuzz.ratio(query_norm, target) / 100
            if row_boost_matches(str(row.get("jenis") or "").strip().lower()):
                fuzzy_score = min(1.0, fuzzy_score + 0.1)
            if fuzzy_score >= 0.8:
                results.append(format_result(row, lang, query_original, fuzzy_score, "fuzzy+model"))

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
            score = sim
            if row_boost_matches(str(row.get("jenis") or "").strip().lower()):
                score = min(1.0, score + 0.1)
            results.append(format_result(row, lang, query_original, score, "semantic+model"))

    if not results:
        suggestion = get_suggestion(query_original, lang)

        return {
            "query": query_original,
            "results": [],
            "message": "No matching kata was found.",
            "suggestion": suggestion,
            **model_bundle,
        }

    return {
        "query": query_original,
        "results": results,
        **model_bundle,
    }