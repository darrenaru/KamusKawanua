"""
Preprocessing khusus IndoBERT (tokenizer `indobenchmark/indobert-base-p2`).

- Tanpa stemming Sastrawi pada teks Indonesia (subword IndoBERT menangani morfologi).
- Endpoint HTTP: ``POST /preprocess/indobert/start/{dataset_id}`` dan
  ``POST /preprocess/indobert/{dataset_id}`` di ``backend.main``.
"""

TOKENIZER_MODE = "indobert"
BASE_MODEL_ID = "indobenchmark/indobert-base-p2"
