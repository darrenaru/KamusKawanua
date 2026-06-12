# 📖 KamusKawanua

<p align="center">
  <img src="frontend/assets/images/logo.png" alt="KamusKawanua Logo" width="400"/>
</p>

[![Python](https://img.shields.io/badge/Python-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)](https://supabase.com/)
[![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=for-the-badge&logo=html5&logoColor=white)](https://developer.mozilla.org/en-US/docs/Web/HTML)
[![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
[![CSS3](https://img.shields.io/badge/CSS3-1572B6?style=for-the-badge&logo=css3&logoColor=white)](https://developer.mozilla.org/en-US/docs/Web/CSS)
![Status](https://img.shields.io/badge/Status-Active_Development-blue?style=for-the-badge)

**KamusKawanua** adalah sistem cerdas untuk penerjemahan dan klasifikasi bahasa daerah Manado (Kawanua). Proyek ini dirancang sebagai platform lengkap (end-to-end) yang mendukung pengelolaan data mentah hingga evaluasi model *Machine Learning* / *Natural Language Processing* (NLP).

---

## 🚀 Pipeline Sistem

Sistem ini beroperasi berdasarkan *pipeline* utama berikut:

**`Data Collection ➔ Pre-Processing ➔ Processing (Training) ➔ Testing ➔ Evaluasi`**

Sistem ini mendukung dan menargetkan 5 algoritma NLP utama:
1. **mBERT** (Multilingual BERT)
2. **IndoBERT**
3. **XLM-R** (XLM-RoBERTa)
4. **Word2Vec**
5. **GloVe**

---

## 🛠️ Teknologi yang Digunakan

* **Backend**: Python, FastAPI, Uvicorn, PyTorch, Transformers, Scikit-learn
* **Frontend**: Vanilla HTML5, CSS3, JavaScript (Dashboard Admin interaktif)
* **Database & BaaS**: Supabase (PostgreSQL)

---

## ⚙️ Persiapan & Instalasi (Getting Started)

### 1. Konfigurasi Environment (Supabase)
Sistem ini menggunakan Supabase sebagai database utama. Anda memerlukan file `.env` di root direktori proyek.

1. Salin contoh env:
   ```bash
   # Windows (PowerShell)
   Copy-Item .env.example .env
   ```
2. Buka `.env` dan isi variabel berikut:
   ```ini
   SUPABASE_URL=https://<project-ref>.supabase.co
   SUPABASE_KEY=<your-service-role-key> 
   ```
   > ⚠️ **Catatan**: Gunakan **Service Role Key** untuk backend. File `.env` sudah diabaikan dalam Git, jangan pernah men-commit file ini.

### 2. Menjalankan Backend (Python / FastAPI)

Backend melayani berbagai proses berat seperti NLP tokenization dan model training.

1. **Buat Virtual Environment**
   ```bash
   python -m venv .venv
   
   # Aktivasi di Windows (PowerShell)
   .\.venv\Scripts\Activate.ps1
   
   # Aktivasi di Linux / macOS
   source .venv/bin/activate
   ```

2. **Install Dependensi**
   ```bash
   pip install -r backend/requirements.txt
   ```
   *(Membutuhkan CUDA 12.4 untuk akselerasi GPU - `torch==2.6.0+cu124`)*

3. **Jalankan Server**
   ```bash
   uvicorn backend.main:app --reload
   ```
   - API berjalan di: `http://localhost:8000`
   - Dokumentasi Swagger UI: `http://localhost:8000/docs`

### 3. Menjalankan Frontend (Static Web)
Frontend dapat langsung dibuka di peramban (browser) modern tanpa perlu kompilasi.
- **Halaman Publik**: Buka `frontend/index.html`
- **Dashboard Admin**: Buka `frontend/admin/pages/dashboard.html`

Untuk pengalaman pengembangan terbaik, gunakan ekstensi **Live Server** di VS Code atau jalankan perintah ini di direktori `frontend/`:
```bash
python -m http.server 8080
```
> **Penting**: Pastikan untuk mengisi `SUPABASE_URL` dan `SUPABASE_ANON_KEY` (Anon Key, bukan Service Key) langsung di dalam file JS frontend yang membutuhkan akses real-time (seperti `frontend/admin/js/data-collection.js`).

---

## 🗄️ Struktur Database

Proyek ini menggunakan skema relasional di Supabase:
* `datasets`: Metadata untuk setiap dataset yang diimpor.
* `raw_data`: Data mentah yang diimpor dari file CSV.
* `preprocessed_data`: Hasil text cleaning, normalisasi slang/stopword, dan tokenisasi.
* `models`: Registri model AI yang telah dilatih.
* `model_training_runs`: Riwayat proses training per *epoch*.
* `testing_results`: Ringkasan hasil testing/prediksi model.
* `slang_words` & `stopwords`: Kamus referensi untuk normalisasi data.

---

## 🧬 Arsitektur Modul

### 1. Data Collection
Menerima impor data CSV dengan format struktur kolom (Strict 8 kolom atau Legacy 6/8 kolom):
`id_kata`, `manado`, `indonesia`, `inggris`, `jenis`, `kalimat_manado`, `kalimat_indonesia`, `kalimat_inggris`.

### 2. Pre-Processing
Endpoint: `POST /preprocess/start/{dataset_id}?tokenizer=mbert|indobert`
* **Flow**: Pemindahan data mentah ➔ Cleaning Text ➔ Normalisasi (Slang/Stopwords) ➔ Tokenisasi.
* Sistem memastikan agar `input_ids` dan `attention_mask` selalu diisi dengan benar.

### 3. Processing (Training)
Endpoint: `POST /processing/train/indobert/async`
* Model pelatihan klasifikasi didasarkan pada `AutoModelForSequenceClassification`.
* Model yang sudah dilatih akan disimpan di direktori `backend/trained_models/<model_name>/...` beserta `label_map.json`.
* Metrik performa dan *Confusion Matrix* otomatis dihitung dan disimpan tiap epoch.

### 4. Testing & Evaluasi
Endpoint: `POST /testing/indobert`
* Mendukung sinkronisasi parameter dari database UI.
* Metrik evaluasi seperti *Accuracy*, *Precision*, *Recall*, *F1-Score*, *MCC* serta visualisasi *Confusion Matrix* disajikan secara langsung pada halaman Evaluasi Admin.

---

## 📂 Struktur Direktori Utama

```text
KamusKawanua/
├── backend/                  # Kode sumber Backend (FastAPI)
│   ├── evaluasi/             # Pipeline perhitungan evaluasi & metrics
│   ├── preprocessing/        # Pipeline data cleaning & tokenizer
│   ├── processing/           # Pipeline training model
│   ├── testing/              # Pipeline inferensi (prediksi) model
│   ├── trained_models/       # Penyimpanan artefak model ML lokal
│   ├── main.py               # Entry point API server
│   └── requirements.txt      # Dependensi Python backend
├── frontend/                 # Kode sumber Frontend (HTML/CSS/JS)
│   ├── admin/                # Dashboard Admin panel
│   │   ├── css/              # Styling untuk admin
│   │   ├── js/               # Logika aplikasi frontend (API call, UI state)
│   │   └── pages/            # Halaman admin (dashboard, evaluasi, dsb.)
│   ├── assets/               # Aset gambar publik
│   └── index.html            # Halaman utama (Landing Page)
└── README.md                 # Dokumentasi utama proyek
```
