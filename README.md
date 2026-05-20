# KamusKawanua

Project ini membangun sistem penerjemahan/klasifikasi berbasis data kamus bahasa Manado (kamarna) dengan pipeline:
`Data Collection -> Pre Processing -> Processing (Training) -> Testing (Evaluasi)`.

Backend menggunakan **FastAPI**, penyimpanan data menggunakan **Supabase**, dan project ini menargetkan 5 algoritma utama:
- **mBERT**
- **IndoBERT**
- **XLM-R**
- **Word2Vec**
- **GloVe**

## Konfigurasi Environment (WAJIB)
Backend membaca konfigurasi Supabase dari environment variable atau file `.env` di root project.

1. Salin contoh env:
   - Windows (PowerShell): `Copy-Item .env.example .env`
2. Isi variabel berikut di `.env`:
   - `SUPABASE_URL=...`
   - `SUPABASE_KEY=...` (**service role key**, hanya untuk backend)

Catatan:
- File `.env` sudah di-`gitignore` (jangan pernah di-commit).
- Backend otomatis me-load `.env` (tanpa dependency tambahan).

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
  - Gunakan **anon key** untuk frontend (bukan service role key).

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
1. **8 kolom (NEW)** (disarankan, sesuai dataset saat ini)
   - `id_kata, manado, indonesia, jenis, kalimat_manado, kalimat_indonesia, kategori, sumber`
   - Kolom `inggris` dan `kalimat_inggris` akan diisi otomatis sebagai `""` untuk kompatibilitas schema lama.
2. **8 kolom (legacy)** (lengkap)
   - `id_kata, jenis, manado, indonesia, inggris, kalimat_manado, kalimat_indonesia, kalimat_inggris`
3. **6 kolom (legacy)** (tanpa kolom Inggris)
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

Perubahan penting:
- Preprocess akan memproses ulang baris yang `input_ids/attention_mask` bernilai **NULL / "" / "[]"** (dataset lama sering tersimpan sebagai string kosong).
- Preprocess menyimpan secara konsisten: `jenis`, `input_ids`, `attention_mask`, `bert_tokens` (serta token-token lain).

Catatan implementasi (untuk kesesuaian dengan IndoBERT):
- Stemming tidak dilakukan manual di pipeline preprocessing.
- Tokenisasi word/sentence konsisten memakai tokenizer pilihan.
- Deduplikasi dan filtering panjang diterapkan saat seed awal.

## Processing / Training (Backend)
Roadmap algoritma pada tahap processing/testing:
- mBERT
- IndoBERT
- XLM-R
- Word2Vec
- GloVe

Implementasi endpoint yang sudah tersedia saat ini (aktif):
- `POST /processing/train/indobert/async`
- `GET  /processing/train/status/{job_id}`

Training memakai model klasifikasi `AutoModelForSequenceClassification` dan menyimpan:
- `trained_models/<model_name>/...`
- `label_map.json`

Input text untuk training dibangun dari kolom:
- `manado_clean`, `indonesia_clean`, `kalimat_manado_clean`, `kalimat_indonesia_clean`

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

## Menjalankan Aplikasi

### Backend (Python + FastAPI)

1. **Setup Virtual Environment**
   ```bash
   python -m venv .venv
   
   # Windows (PowerShell)
   .\.venv\Scripts\Activate.ps1
   
   # Linux / macOS
   source .venv/bin/activate
   ```

2. **Install Dependencies**
   ```bash
   pip install -r backend/requirements.txt
   ```

3. **Jalankan Backend Server**
   ```bash
   uvicorn backend.main:app --reload
   ```
   Backend akan berjalan di `http://localhost:8000`
   
   Dokumentasi API: `http://localhost:8000/docs` (Swagger UI)

### Frontend (Static HTML + JavaScript)

1. **Buka di Browser**
   - Halaman utama: `frontend/index.html`
   - Halaman admin: `frontend/admin/pages/` (dashboard, data-collection, preprocessing, processing, testing, evaluasi)

2. **Jalankan dengan Live Server (opsional)**
   Jika menggunakan VS Code, install extension **Live Server** (5500):
   - Klik kanan di `frontend/index.html` → "Open with Live Server"
   - Atau gunakan `python -m http.server 8080` di folder `frontend/`

3. **Konfigurasi Supabase di Frontend**
   - Update `SUPABASE_URL` dan `SUPABASE_ANON_KEY` di file-file JavaScript:
     - `frontend/admin/js/data-collection.js`
     - `frontend/admin/js/preprocessing.js`
     - `frontend/admin/js/processing.js`
     - `frontend/admin/js/testing.js`
     - `frontend/admin/js/evaluasi.js`

### Struktur Folder Backend
```
backend/
├── main.py                    # Entry point FastAPI
├── config.py                  # Konfigurasi
├── model.py                   # Model utility
├── supabase_client.py         # Klien Supabase
├── requirements.txt           # Dependencies Python
├── preprocessing/             # Pipeline preprocessing
├── processing/                # Pipeline training/processing
├── testing/                   # Pipeline testing
├── evaluasi/                  # Pipeline evaluasi
└── trained_models/            # Folder model yang sudah di-train
```

