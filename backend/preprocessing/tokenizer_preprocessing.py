from fastapi import FastAPI
from transformers import AutoTokenizer
from supabase import create_client
import json
import time
<<<<<<< HEAD
=======
import torch
>>>>>>> 5389e9f (Initial commit)

app = FastAPI()

SUPABASE_URL = "https://fhpjbkelhvopvfzykjne.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZocGpia2VsaHZvcHZmenlram5lIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTM5NDY1NCwiZXhwIjoyMDkwOTcwNjU0fQ.ZLisXnkuyvgvYwBV81lsEbMSNJm3iMEKPMTswSSjpUg"

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

tokenizer = AutoTokenizer.from_pretrained("bert-base-multilingual-cased")


def build_text(row):
<<<<<<< HEAD
    return f"{row.get('manado_clean','')} [SEP] {row.get('indonesia_clean','')} [SEP] {row.get('inggris_clean','')}"
=======
    return (
        f"{row.get('manado_clean','')} [SEP] "
        f"{row.get('indonesia_clean','')} [SEP] "
        f"{row.get('kalimat_manado_clean','')} [SEP] "
        f"{row.get('kalimat_indonesia_clean','')}"
    )
>>>>>>> 5389e9f (Initial commit)


@app.post("/preprocess/{dataset_id}")
def preprocess(dataset_id: int):

    all_data = []
    from_idx = 0
    limit = 1000

    # 🔥 PAGINATION FIX
    while True:
        res = supabase.table("preprocessed_data") \
<<<<<<< HEAD
            .select("*") \
=======
            .select("id, manado_clean, indonesia_clean, kalimat_manado_clean, kalimat_indonesia_clean") \
>>>>>>> 5389e9f (Initial commit)
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
    print("TOTAL TOKENIZE:", total)
<<<<<<< HEAD
=======
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print("PREPROCESS DEVICE:", device)
>>>>>>> 5389e9f (Initial commit)

    for i, row in enumerate(all_data):
        try:
            text = build_text(row)

            if not text.strip():
                continue

            encoded = tokenizer(
                text,
                padding="max_length",
                truncation=True,
<<<<<<< HEAD
                max_length=64
            )

            supabase.table("preprocessed_data").update({
                "input_ids": json.dumps(encoded["input_ids"]),
                "attention_mask": json.dumps(encoded["attention_mask"])
=======
                max_length=64,
                return_tensors="pt",
            )
            input_ids = encoded["input_ids"].to(device).squeeze(0).detach().cpu().tolist()
            attention_mask = (
                encoded["attention_mask"].to(device).squeeze(0).detach().cpu().tolist()
            )

            supabase.table("preprocessed_data").update({
                "input_ids": json.dumps(input_ids),
                "attention_mask": json.dumps(attention_mask)
>>>>>>> 5389e9f (Initial commit)
            }).eq("id", row["id"]).execute()

            print(f"{i+1}/{total}")

            time.sleep(0.02)

        except Exception as e:
            print("ERROR:", row["id"], e)

<<<<<<< HEAD
    return {"status": "done", "total": total}
=======
    return {"status": "done", "total": total, "device": str(device)}
>>>>>>> 5389e9f (Initial commit)
