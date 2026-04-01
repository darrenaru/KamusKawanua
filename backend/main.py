from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

import pandas as pd
from rapidfuzz import fuzz
import numpy as np
import torch
from transformers import BertTokenizer, BertModel

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
# LOGIN SCHEMA
# =========================
class LoginRequest(BaseModel):
    username: str
    password: str

# =========================
# DUMMY USER
# =========================
USER = {
    "username": "admin",
    "password": "admin"
}

# =========================
# LOGIN ENDPOINT
# =========================
@app.post("/login")
def login(data: LoginRequest):
    if data.username == USER["username"] and data.password == USER["password"]:
        return {
            "success": True,
            "message": "Login berhasil"
        }
    else:
        return {
            "success": False,
            "message": "Username atau password salah"
        }

# =========================
# LOAD DATA
# =========================
df = pd.read_csv('data/clean_dataset_with_text.csv')

# =========================
# LOAD EMBEDDINGS
# =========================
embeddings = np.load('data/embeddings.npy')

# =========================
# LOAD MODEL
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
# WORD LIST
# =========================
manado_words = set(df['manado'].astype(str))
indo_words = set(df['indonesia'].astype(str))
eng_words = set(df['inggris'].astype(str))

# =========================
# SUGGESTION
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
# FORMAT RESULT (FIXED)
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
# SEARCH
# =========================
@app.get("/search")
def search(query: str, lang: str):
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