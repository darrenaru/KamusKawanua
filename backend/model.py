import pandas as pd
import torch
from transformers import BertTokenizer, BertModel
import numpy as np

tokenizer = BertTokenizer.from_pretrained('bert-base-multilingual-cased')
model = BertModel.from_pretrained('bert-base-multilingual-cased')

def encode(text):
    inputs = tokenizer(text, return_tensors='pt', truncation=True, padding=True)
    with torch.no_grad():
        outputs = model(**inputs)
    return outputs.last_hidden_state[:, 0, :].squeeze().numpy()

# LOAD DATA
df = pd.read_csv('data/clean_dataset_with_text.csv')

# 🔥 FIX: fokus ke kata, bukan kalimat
texts = df['manado'] + " = " + df['indonesia']

embeddings = []

for text in texts:
    emb = encode(text)
    embeddings.append(emb)

embeddings = np.array(embeddings)

np.save('data/embeddings.npy', embeddings)

print("Embedding baru selesai dibuat (tanpa kalimat).")