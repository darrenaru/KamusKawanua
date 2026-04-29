# KamusKawanua

Project ini membangun sistem penerjemahan/klasifikasi berbasis data kamus bahasa Manado (kamarna) dengan pipeline:
`Data Collection -> Pre Processing -> Processing (Training) -> Testing (Evaluasi)`.

Backend menggunakan **FastAPI**, training/inferensi menggunakan **IndoBERT**, dan penyimpanan data menggunakan **Supabase**.

## Prasyarat

### Backend (Python)
`backend/requirements.txt`
- `fastapi`
- `uvicorn`
- `pandas`
- `numpy`
- `torch==2.6.0+cu124` (CUDA 12.4)
- `transformers`
- `rapidfuzz`
- `supabase`
- `scikit-learn`
- `sastrawi`

### Frontend (Static)
- Halaman admin bersifat static (`frontend/admin/...`) dan memanggil backend via `fetch`.
- Koneksi Supabase dibuat langsung di beberapa file JS (contoh: `frontend/admin/js/data-collection.js`, `frontend/admin/js/preprocessing.js`).

## Struktur Database (ringkas)
Tabel yang dipakai untuk pipeline utama:
- `datasets` (metadata dataset)
- `raw_data` (data mentah dari CSV)
- `preprocessed_data` (hasil cleaning/tokenisasi)
- `models` (registry model training)
- `model_training_runs` (history training run, bila digunakan)
- `testing_results` (ringkasan hasil testing)
- `slang_words`, `stopwords` (resource normalisasi)

## Format CSV yang didukung (Data Collection)
Parser `parseCSVStrict()` di `frontend/admin/js/data-collection.js` menerima:
1. **8 kolom** (lengkap)
   - `id_kata, jenis, manado, indonesia, inggris, kalimat_manado, kalimat_indonesia, kalimat_inggris`
2. **6 kolom** (tanpa kolom Inggris)
   - `id_kata, jenis, manado, indonesia, kalimat_manado, kalimat_indonesia`
   - Untuk format 6 kolom, parser mengisi `inggris` dan `kalimat_inggris` sebagai `""`.

## Pre Processing (Backend)
Flow preprocessing:
1. Seeding `preprocessed_data` dari `raw_data` jika `preprocessed_data` belum ada.
2. Cleaning + normalisasi slang/stopword.
3. Tokenisasi menggunakan tokenizer yang dipilih.
4. Hasil token disimpan ke `preprocessed_data`.

Endpoint:
- `POST /preprocess/start/{dataset_id}?tokenizer=mbert|indobert`
- `GET  /preprocess/status/{job_id}`
- `POST /preprocess/cancel/{job_id}`

Catatan implementasi (untuk kesesuaian dengan IndoBERT):
- Stemming tidak dilakukan manual di pipeline preprocessing.
- Tokenisasi word/sentence konsisten memakai tokenizer pilihan.
- Deduplikasi dan filtering panjang diterapkan saat seed awal.

## Processing / Training (Backend)
Endpoint training IndoBERT (async):
- `POST /processing/train/indobert/async`
- `GET  /processing/train/status/{job_id}`

Training memakai model klasifikasi `AutoModelForSequenceClassification` dan menyimpan:
- `trained_models/<model_name>/...`
- `label_map.json`

## Testing (Backend)
Registry model untuk dropdown UI:
- `GET  /testing/models`

Testing model (sinkron):
- `POST /testing/indobert`
  - Request: `dataset_id, model_name, model_id, max_length, limit, save_result`

Testing UI (halaman `frontend/admin/pages/testing.html`) sekarang mengambil:
- daftar `Algoritma` dan `Model` dari tabel `models` melalui backend (`/testing/models`)
- `dataset_id` langsung terkait dengan model terpilih

## Confusion Matrix
Confusion matrix ditampilkan pada modal “Training Results” (halaman `frontend/admin/pages/processing.html`) dengan mengambil:
- epoch validasi dengan **akurasi tertinggi**
- confusion matrix yang dihitung backend per-epoch
