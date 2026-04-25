from fastapi import FastAPI
from transformers import AutoTokenizer
from supabase import create_client
import json
import time

app = FastAPI()

SUPABASE_URL = "https://fhpjbkelhvopvfzykjne.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZocGpia2VsaHZvcHZmenlram5lIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTM5NDY1NCwiZXhwIjoyMDkwOTcwNjU0fQ.ZLisXnkuyvgvYwBV81lsEbMSNJm3iMEKPMTswSSjpUg"

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

tokenizer = AutoTokenizer.from_pretrained("bert-base-multilingual-cased")


def build_text(row):
    return f"{row.get('manado_clean','')} [SEP] {row.get('indonesia_clean','')} [SEP] {row.get('inggris_clean','')}"


@app.post("/preprocess/{dataset_id}")
def preprocess(dataset_id: int):

    all_data = []
    from_idx = 0
    limit = 1000

    # 🔥 PAGINATION FIX
    while True:
        res = supabase.table("preprocessed_data") \
            .select("*") \
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

    for i, row in enumerate(all_data):
        try:
            text = build_text(row)

            if not text.strip():
                continue

            encoded = tokenizer(
                text,
                padding="max_length",
                truncation=True,
                max_length=64
            )

            supabase.table("preprocessed_data").update({
                "input_ids": json.dumps(encoded["input_ids"]),
                "attention_mask": json.dumps(encoded["attention_mask"])
            }).eq("id", row["id"]).execute()

            print(f"{i+1}/{total}")

            time.sleep(0.02)

        except Exception as e:
            print("ERROR:", row["id"], e)

    return {"status": "done", "total": total}