from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

import os
import pandas as pd
from rapidfuzz import fuzz
import numpy as np
import torch
from transformers import BertTokenizer, BertModel, AutoTokenizer

from supabase import create_client
import json
import time
import re
from Sastrawi.Stemmer.StemmerFactory import StemmerFactory
from processing.training_processing import router as processing_router


app = FastAPI()
app.include_router(processing_router)

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
# 🔥 SUPABASE CONFIG (WAJIB SERVICE ROLE)
# =========================
SUPABASE_URL = "https://fhpjbkelhvopvfzykjne.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZocGpia2VsaHZvcHZmenlram5lIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTM5NDY1NCwiZXhwIjoyMDkwOTcwNjU0fQ.ZLisXnkuyvgvYwBV81lsEbMSNJm3iMEKPMTswSSjpUg"

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

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

def remove_all_duplicates(tokens):
    return list(dict.fromkeys(tokens))

# =========================
# TOKEN PROCESSING (FINAL FIX)
# =========================

# 🔥 HAPUS SEMUA DUPLIKAT (AGRESIF)
def remove_all_duplicates(tokens):
    return list(dict.fromkeys(tokens))


# =========================
# WORD PROCESSING
# =========================
def process_word(text, slang_dict):
    text = clean_basic(text)

    # 🔥 TOKEN MANUAL (BUKAN BERT)
    tokens = text.split()

    processed = []

    for t in tokens:
        # slang normalize
        if t in slang_dict:
            t = slang_dict[t]

        processed.append(t)

    # 🔥 REMOVE DUPLICATE
    processed = remove_all_duplicates(processed)

    return processed


# =========================
# SENTENCE PROCESSING (FULL NLP PIPELINE)
# =========================
def process_sentence(text, slang_dict, stopwords):
    text = clean_basic(text)

    # 🔥 TOKEN MANUAL (FIX UTAMA)
    tokens = text.split()

    processed = []

    for t in tokens:

        # slang normalize
        if t in slang_dict:
            t = slang_dict[t]

        # stopword removal
        if t in stopwords:
            continue

        # stemming
        t = stemmer.stem(t)

        processed.append(t)

    # 🔥 REMOVE DUPLICATE GLOBAL
    processed = remove_all_duplicates(processed)

    return processed

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
            return {"success": True, "message": "Login berhasil"}
        else:
            return {"success": False, "message": "Username atau password salah"}

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
# TOKENIZER
# =========================
tokenizer = BertTokenizer.from_pretrained('bert-base-multilingual-cased')
model = BertModel.from_pretrained('bert-base-multilingual-cased')
tokenizer_pre = AutoTokenizer.from_pretrained("bert-base-multilingual-cased")
tokenizer_indobert = AutoTokenizer.from_pretrained("indobenchmark/indobert-base-p1")

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
@app.post("/preprocess/{dataset_id}")
def preprocess(dataset_id: int):

    stopwords = load_stopwords()
    slang_dict = load_slang()

    all_data = []
    from_idx = 0
    limit = 1000

    # =========================
    # 🔥 FETCH DARI RAW_DATA (FIX UTAMA)
    # =========================
    while True:
        res = supabase.table("raw_data") \
            .select("*") \
            .eq("dataset_id", dataset_id) \
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

    success = 0
    failed = 0

    # =========================
    # PROCESS LOOP
    # =========================
    for row in all_data:
        try:

            # =========================
            # WORD TOKEN
            # =========================
            def process_word_local(text):
                text = clean_basic(text)
                tokens = text.split()
                tokens = [slang_dict.get(t, t) for t in tokens]
                return remove_all_duplicates(tokens)

            manado_tokens = process_word_local(row.get("manado"))
            indonesia_tokens = process_word_local(row.get("indonesia"))

            # =========================
            # SENTENCE PIPELINE
            # =========================
            def process_sentence_local(text):
                text = clean_basic(text)
                tokens = text.split()

                clean_tokens = []

                for t in tokens:
                    if t in slang_dict:
                        t = slang_dict[t]

                    if t in stopwords:
                        continue

                    t = stemmer.stem(t)
                    clean_tokens.append(t)

                # 🔥 FIX: remove duplicate di luar loop
                clean_tokens = remove_all_duplicates(clean_tokens)

                return clean_tokens

            kal_manado = process_sentence_local(row.get("kalimat_manado"))
            kal_indo = process_sentence_local(row.get("kalimat_indonesia"))

            # =========================
            # FINAL TEXT (NO ENGLISH)
            # =========================
            final_text = (
                " ".join(manado_tokens) + " [SEP] " +
                " ".join(indonesia_tokens) + " [SEP] " +
                " ".join(kal_manado) + " [SEP] " +
                " ".join(kal_indo)
            )

            # =========================
            # BERT TOKENIZER
            # =========================
            encoded = tokenizer_pre(
                final_text,
                padding="max_length",
                truncation=True,
                max_length=64
            )

            bert_tokens = tokenizer_pre.convert_ids_to_tokens(encoded["input_ids"])

            # =========================
            # 🔥 INSERT (BUKAN UPDATE)
            # =========================
            supabase.table("preprocessed_data").insert({
            "dataset_id": dataset_id,
            "id_kata": row.get("id_kata"),

            # 🔥 TAMBAHKAN INI (FIX UTAMA)
            "jenis": row.get("jenis"),
            "kalimat_manado": row.get("kalimat_manado"),
            "kalimat_indonesia": row.get("kalimat_indonesia"),

            # ORIGINAL
            "manado": row.get("manado"),
            "indonesia": row.get("indonesia"),

            # 🔥 CLEAN VERSION (TAMBAHKAN)
            "manado_clean": clean_basic(row.get("manado")),
            "indonesia_clean": clean_basic(row.get("indonesia")),

            # TOKENS
            "manado_tokens": json.dumps(manado_tokens),
            "indonesia_tokens": json.dumps(indonesia_tokens),

            # SENTENCE CLEAN
            "kalimat_manado_clean": " ".join(kal_manado),
            "kalimat_indonesia_clean": " ".join(kal_indo),

            # SENTENCE TOKENS
            "kalimat_manado_tokens": json.dumps(kal_manado),
            "kalimat_indonesia_tokens": json.dumps(kal_indo),

            # BERT
            "bert_tokens": json.dumps(bert_tokens),
            "input_ids": json.dumps(encoded["input_ids"]),
            "attention_mask": json.dumps(encoded["attention_mask"])
        }).execute()

            success += 1
            print(f"{success}/{total}")

            time.sleep(0.01)

        except Exception as e:
            failed += 1
            print("ERROR:", row.get("id_kata"), e)

    return {
        "status": "done",
        "total": total,
        "success": success,
        "failed": failed
    }

# =========================
# PREPROCESS FOR INDOBERT (FINE-TUNING + SOFTMAX)
# =========================
@app.post("/preprocess/indobert/{dataset_id}")
def preprocess_indobert(dataset_id: int, max_length: int = 128):
    stopwords = load_stopwords()
    slang_dict = load_slang()

    all_data = []
    from_idx = 0
    limit = 1000

    while True:
        res = supabase.table("raw_data") \
            .select("*") \
            .eq("dataset_id", dataset_id) \
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
    if total == 0:
        return {
            "status": "empty",
            "message": "raw_data untuk dataset ini tidak ditemukan",
            "dataset_id": dataset_id,
            "total": 0
        }

    # Hindari duplikasi data preprocess saat re-run.
    supabase.table("preprocessed_data").delete().eq("dataset_id", dataset_id).execute()

    # Kumpulkan label unik untuk softmax output dimension.
    labels = sorted(list({(row.get("jenis") or "").strip().lower() for row in all_data if row.get("jenis")}))
    label2id = {label: idx for idx, label in enumerate(labels)}

    success = 0
    failed = 0

    for row in all_data:
        try:
            jenis_raw = (row.get("jenis") or "").strip().lower()
            if not jenis_raw:
                failed += 1
                continue

            def process_word_local(text):
                text = clean_basic(text)
                tokens = text.split()
                tokens = [slang_dict.get(t, t) for t in tokens]
                return remove_all_duplicates(tokens)

            def process_sentence_local(text):
                text = clean_basic(text)
                tokens = text.split()
                clean_tokens = []

                for t in tokens:
                    if t in slang_dict:
                        t = slang_dict[t]
                    if t in stopwords:
                        continue
                    t = stemmer.stem(t)
                    clean_tokens.append(t)

                return remove_all_duplicates(clean_tokens)

            manado_tokens = process_word_local(row.get("manado"))
            indonesia_tokens = process_word_local(row.get("indonesia"))
            kal_manado = process_sentence_local(row.get("kalimat_manado"))
            kal_indo = process_sentence_local(row.get("kalimat_indonesia"))

            # Teks final untuk fine-tuning sequence classification (softmax).
            final_text = (
                " ".join(manado_tokens) + " [SEP] " +
                " ".join(indonesia_tokens) + " [SEP] " +
                " ".join(kal_manado) + " [SEP] " +
                " ".join(kal_indo)
            ).strip()

            if not final_text:
                failed += 1
                continue

            encoded = tokenizer_indobert(
                final_text,
                padding="max_length",
                truncation=True,
                max_length=max_length
            )
            indobert_tokens = tokenizer_indobert.convert_ids_to_tokens(encoded["input_ids"])

            supabase.table("preprocessed_data").insert({
                "dataset_id": dataset_id,
                "id_kata": row.get("id_kata"),
                "jenis": jenis_raw,
                "kalimat_manado": row.get("kalimat_manado"),
                "kalimat_indonesia": row.get("kalimat_indonesia"),
                "manado": row.get("manado"),
                "indonesia": row.get("indonesia"),
                "manado_clean": clean_basic(row.get("manado")),
                "indonesia_clean": clean_basic(row.get("indonesia")),
                "manado_tokens": json.dumps(manado_tokens),
                "indonesia_tokens": json.dumps(indonesia_tokens),
                "kalimat_manado_clean": " ".join(kal_manado),
                "kalimat_indonesia_clean": " ".join(kal_indo),
                "kalimat_manado_tokens": json.dumps(kal_manado),
                "kalimat_indonesia_tokens": json.dumps(kal_indo),
                "bert_tokens": json.dumps(indobert_tokens),
                "input_ids": json.dumps(encoded["input_ids"]),
                "attention_mask": json.dumps(encoded["attention_mask"])
            }).execute()

            success += 1
            time.sleep(0.005)

        except Exception as e:
            failed += 1
            print("ERROR INDOBERT PREPROCESS:", row.get("id_kata"), e)

    return {
        "status": "done",
        "model": "indobert-base-p1",
        "task": "sequence_classification_softmax",
        "dataset_id": dataset_id,
        "max_length": max_length,
        "total_raw": total,
        "success": success,
        "failed": failed,
        "num_labels": len(label2id),
        "label2id": label2id,
        "id2label": {str(v): k for k, v in label2id.items()}
    }

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
            "error": "database kosong / RLS belum aktif / Supabase gagal"
        }

    manado_words = set(df['manado'].astype(str))
    indo_words = set(df['indonesia'].astype(str))
    eng_words = set(df['inggris'].astype(str))

    def get_suggestion(query, lang):

        if lang == "manado":
            words = manado_words
        elif lang == "indonesia":
            words = indo_words
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

            "kalimat_manado": highlight_match(row.get('kalimat_manado', '-'), query_original),
            "kalimat_indonesia": highlight_match(row.get('kalimat_indonesia', '-'), query_original),

            "score": round(float(score), 3),
            "method": method
        }

    query_original = query
    query_norm = normalize(query)

    results = []

    for idx, row in df.iterrows():
        manado = normalize(row['manado'])
        indo = normalize(row['indonesia'])

        if lang == "manado":
            target = manado
        elif lang == "indonesia":
            target = indo
        else:
            return {"message": "lang harus diisi"}

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
            "message": "kata tidak ditemukan",
            "suggestion": suggestion
        }

    return {
        "query": query_original,
        "results": results
    }