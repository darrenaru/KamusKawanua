# Setup KamusKawanua di Laptop Windows (Aman)

Panduan ini untuk laptop baru setelah clone dari GitHub. Ikuti **urutan nomor**; jangan lewati langkah cek.

---

## Ringkasan

| Komponen | Versi / catatan |
|----------|------------------|
| Python | **3.12.x** (installer `.exe`, **bukan** file `.zip`) |
| Jangan pakai | Python **3.14** untuk project ini |
| Backend | FastAPI di port **8000** |
| Frontend | Static di port **5500** |
| Ruang disk | ~5–6 GB untuk `.venv` (dengan PyTorch CUDA) |

---

## 0. Prasyarat

- Windows 10/11 (64-bit)
- Internet
- Akun **Supabase** (URL + API keys)
- **Opsional:** GPU NVIDIA + driver CUDA (training lebih cepat). Tanpa GPU tetap bisa (pakai PyTorch CPU).

---

## 1. Install Python 3.12 (sekali per laptop)

1. Buka: https://www.python.org/downloads/
2. Unduh **Python 3.12.x** → pilih **Windows installer (64-bit)**  
   File: `python-3.12.x-amd64.exe` (**bukan** `.zip` / embeddable).
3. Jalankan installer:
   - Centang **Add python.exe to PATH**
   - Klik **Install Now**
4. Tutup installer, buka **CMD baru** (bukan yang lama).

**Cek:**

```cmd
py -0p
py -3.12 --version
```

Harus ada baris `3.12` dan versi `Python 3.12.x`.

> Python 3.14 boleh tetap terpasang di PC; project ini memakai **venv 3.12** saja.

---

## 2. Clone / salin project

```cmd
cd C:\PPL
git clone <URL-repo-anda> KamusKawanua-Final
cd KamusKawanua-Final\KamusKawanua-Final
```

(Sesuaikan path folder jika berbeda.)

---

## 3. File `.env` (wajib sebelum backend jalan)

Di **root project** (folder yang berisi `backend\` dan `frontend\`), buat file `.env`:

```env
SUPABASE_URL=https://xxxxxxxx.supabase.co
SUPABASE_KEY=eyJxxxxxxxx_service_role_key
```

- Ambil dari Supabase → **Project Settings → API**
- `SUPABASE_KEY` = **service role** (hanya backend, jangan dibagikan).

---

## 4. Buat virtual environment (Python 3.12)

**Tutup** semua CMD/terminal yang membuka folder project ini.

CMD baru:

```cmd
cd C:\PPL\KamusKawanua-Final\KamusKawanua-Final
```

Hapus venv lama jika pernah gagal (abaikan error "tidak ditemukan"):

```cmd
rmdir /s /q .venv
```

Jika **Access is denied**:

1. Tutup semua terminal + Task Manager → akhiri **python.exe**
2. `rename .venv .venv_old` lalu `rmdir /s /q .venv_old`  
   atau restart PC, lalu ulangi `rmdir`.

Buat venv:

```cmd
py -3.12 -m venv .venv
```

**Cek wajib** (harus 3.12, bukan 3.14):

```cmd
.venv\Scripts\python.exe --version
```

Contoh benar: `Python 3.12.0`

Jika `py -3.12 -m venv` gagal, pakai path dari `py -0p`:

```cmd
"C:\Users\NAMA_ANDA\AppData\Local\Programs\Python\Python312\python.exe" -m venv .venv
.venv\Scripts\python.exe --version
```

(Ganti `NAMA_ANDA` sesuai `py -0p`.)

---

## 5. Install library Python

**Selalu** pakai Python di dalam `.venv`, **bukan** perintah `python` global:

```cmd
cd C:\PPL\KamusKawanua-Final\KamusKawanua-Final
.venv\Scripts\python.exe -m pip install --upgrade pip
.venv\Scripts\python.exe -m pip install -r backend\requirements.txt
```

Tunggu sampai selesai (bisa 10–30 menit).

### Jika error `torch==2.6.0+cu124` (umum di laptop tanpa CUDA)

```cmd
.venv\Scripts\python.exe -m pip install torch --index-url https://download.pytorch.org/whl/cpu
.venv\Scripts\python.exe -m pip install fastapi uvicorn pandas numpy transformers rapidfuzz supabase scikit-learn sastrawi
```

### Jangan lakukan ini

| Salah | Benar |
|-------|--------|
| `python -m venv .venv` | `py -3.12 -m venv .venv` |
| `python -m pip install ...` (tanpa cek) | `.venv\Scripts\python.exe -m pip install ...` |
| `python -m venv` saat `(.venv)` aktif | Hapus `.venv` dulu, venv nonaktif |
| Install dari file `.zip` Python | Installer `.exe` |

---

## 6. Supabase — migrasi kolom (sekali)

Di Supabase → **SQL Editor**, jalankan isi file (berurutan):

1. `supabase/models_testing_columns.sql` — kolom metrik di tabel `models`
2. `supabase/training_logs_and_epoch_metrics.sql` — tabel `training_logs` & `model_epoch_metrics`

---

## 7. Konfigurasi frontend Supabase (anon key)

```cmd
Copy-Item frontend\admin\js\supabase-config.example.js frontend\admin\js\supabase-config.js
```

Edit **`frontend/admin/js/supabase-config.js`** — isi `url` + **anon key** (bukan service role).

Helper `createKamusSupabaseClient` ada di `supabase-init.js` (ikut Git). Lihat juga `SETUP_CLONE.md` dan `NOADVERB_README.md`.

---

## 8. XLM generasi 1 atau 2 (opsional)

Edit **satu baris** di `backend/xlm_generation.py`:

```python
ACTIVE_XLM_PROFILE: str = "xlm-r-2"   # xlm milik Brad
# ACTIVE_XLM_PROFILE: str = "xlm-r"   # xlm milik Tesa
```

Restart backend setelah mengubah.

---

## 9. Menjalankan aplikasi

### Terminal 1 — Backend

```cmd
cd C:\PPL\KamusKawanua-Final\KamusKawanua-Final
.venv\Scripts\python.exe -m uvicorn backend.main:app --reload
```

Biarkan terbuka. Cek: http://127.0.0.1:8000/docs

### Terminal 2 — Frontend

```cmd
cd C:\PPL\KamusKawanua-Final\KamusKawanua-Final\frontend
python -m http.server 5500
```

Buka browser:

- Login: http://127.0.0.1:5500/login/login.html
- Admin: http://127.0.0.1:5500/admin/pages/dashboard.html

Backend **harus** tetap jalan di port 8000.

---

## 10. PowerShell: jika `Activate.ps1` diblokir

Pakai **CMD** dan:

```cmd
.venv\Scripts\activate.bat
```

Atau tanpa activate, selalu:

```cmd
.venv\Scripts\python.exe ...
```

---

## Checklist cepat

```
[ ] Python 3.12 installer .exe + Add to PATH
[ ] py -3.12 --version OK
[ ] File .env di root project
[ ] py -3.12 -m venv .venv
[ ] .venv\Scripts\python.exe --version = 3.12.x
[ ] .venv\Scripts\python.exe -m pip install -r backend\requirements.txt
[ ] (opsional) SQL models_testing_columns.sql
[ ] Anon key Supabase di file JS frontend
[ ] uvicorn jalan → /docs terbuka
[ ] http.server 5500 → login terbuka
```

---

## Troubleshooting

| Masalah | Solusi |
|---------|--------|
| `python --version` = 3.14 | Normal di global; pakai `.venv\Scripts\python.exe` |
| `torch==2.6.0+cu124` not found | Pakai Python 3.12 + venv; atau install torch CPU (langkah 5) |
| `Access is denied` hapus `.venv` | Tutup terminal, kill python.exe, rename folder, restart |
| `Missing Supabase config` | Buat/perbaiki `.env` |
| `activate.bat` tidak dikenali | `.venv` belum ada atau rusak → ulangi langkah 4 |
| Training: model not found | Train di Processing atau salin folder ke `backend/trained_models/` |

---

## Perintah satu halaman (copy-paste)

Ganti `cd` ke path project Anda:

```cmd
cd C:\PPL\KamusKawanua-Final\KamusKawanua-Final
rmdir /s /q .venv
py -3.12 -m venv .venv
.venv\Scripts\python.exe --version
.venv\Scripts\python.exe -m pip install --upgrade pip
.venv\Scripts\python.exe -m pip install -r backend\requirements.txt
.venv\Scripts\python.exe -m uvicorn backend.main:app --reload
```

Terminal kedua:

```cmd
cd C:\PPL\KamusKawanua-Final\KamusKawanua-Final\frontend
python -m http.server 5500
```
