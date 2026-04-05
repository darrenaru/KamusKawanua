from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

import os
import pandas as pd
from rapidfuzz import fuzz
import numpy as np
import torch
from transformers import BertTokenizer, BertModel

from supabase import create_client

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
# SUPABASE CONFIG (FIX)
# =========================
SUPABASE_URL = "https://fhpjbkelhvopvfzykjne.supabase.co"
SUPABASE_KEY = "sb_publishable_VwAwbQcRMbIEH2lGmxfN8w_k6jBI4y2"

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

# =========================
# LOAD DATA (FIX ANTI CRASH)
# =========================
def load_data():
    try:
        response = supabase.table("dictionary").select("*").execute()
        data = response.data

        if data is None or len(data) == 0:
            print("DEBUG: Supabase kosong / RLS belum aktif")
            return pd.DataFrame()

        df = pd.DataFrame(data)

        print("DEBUG SHAPE:", df.shape)
        print("DEBUG COLUMNS:", df.columns)

        return df

    except Exception as e:
        print("SUPABASE ERROR:", e)
        return pd.DataFrame()

# =========================
# LOGIN SCHEMA
# =========================
class LoginRequest(BaseModel):
    username: str
    password: str


# =========================
# LOGIN ENDPOINT
# =========================
@app.post("/login")
def login(data: LoginRequest):
    try:
        response = supabase.table("users") \
            .select("*") \
            .eq("username", data.username) \
            .eq("password", data.password) \
            .execute()

        user = response.data

        if user and len(user) > 0:
            return {
                "success": True,
                "message": "Login berhasil"
            }
        else:
            return {
                "success": False,
                "message": "Username atau password salah"
            }

    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }

# =========================
# LOAD EMBEDDINGS (TETAP)
# =========================
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
emb_path = os.path.join(BASE_DIR, "data", "embeddings.npy")

embeddings = np.load(emb_path)

# =========================
# LOAD MODEL (TETAP)
# =========================
tokenizer = BertTokenizer.from_pretrained('bert-base-multilingual-cased')
model = BertModel.from_pretrained('bert-base-multilingual-cased')

def encode(text):
    inputs = tokenizer(text, return_tensors='pt', truncation=True, padding=True)
    with torch.no_grad():
        outputs = model(**inputs)
    return outputs.last_hidden_state[:, 0, :].squeeze().numpy()

# =========================
# COSINE SIMILARITY
# =========================
def cosine_similarity(a, b):
    return np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b))

# =========================
# NORMALIZATION
# =========================
def normalize(text):
    text = str(text).lower().strip()
    text = text.replace("aa", "a")
    text = text.replace("ee", "e")
    text = text.replace("ii", "i")
    text = text.replace("oo", "o")
    text = text.replace("uu", "u")
    return text

# =========================
# HIGHLIGHT
# =========================
def highlight_match(text, query):
    text_str = str(text)
    text_lower = text_str.lower()
    query_lower = query.lower()

    if query_lower in text_lower:
        start = text_lower.index(query_lower)
        end = start + len(query_lower)

        return (
            text_str[:start]
            + "<mark>" + text_str[start:end] + "</mark>"
            + text_str[end:]
        )

    return text_str

# =========================
# ROOT
# =========================
@app.get("/")
def root():
    return {
        "message": "API Kamus Kawanua aktif",
        "docs": "http://127.0.0.1:8000/docs"
    }

# =========================
# SEARCH (LOGIKA 100% SAMA)
# =========================
@app.get("/search")
def search(query: str, lang: str):

    df = load_data()

    # 🔥 GUARD (ANTI 500)
    if df.empty:
        return {
            "query": query,
            "results": [],
            "error": "database kosong / RLS belum aktif / Supabase gagal"
        }

    # WORD LIST (tetap)
    manado_words = set(df['manado'].astype(str))
    indo_words = set(df['indonesia'].astype(str))
    eng_words = set(df['inggris'].astype(str))

    # =========================
    # SUGGESTION FUNCTION
    # =========================
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

    # =========================
    # FORMAT RESULT
    # =========================
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

    # =========================
    # SEMANTIC (TETAP)
    # =========================
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

    # =========================
    # SUGGESTION FALLBACK
    # =========================
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