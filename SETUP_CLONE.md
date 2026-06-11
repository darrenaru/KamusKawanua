# Setup setelah `git clone` — KamusKawanua (noadverb)

Jalankan otomatis (Windows):

```powershell
.\scripts\setup-after-clone.ps1
```

URL/key **hanya di `.env` tidak cukup**. Admin memakai `supabase-config.js` (kredensial). Helper `createKamusSupabaseClient` ada di **`supabase-init.js`** (ikut Git).

## 1. Dua file konfigurasi (beda fungsi)

| File | Dipakai oleh | Isi key |
|------|----------------|---------|
| `.env` (root) | Backend `uvicorn` | `SUPABASE_URL` + **service_role** |
| `frontend/admin/js/supabase-config.js` | Halaman admin (browser) | `url` + **anon** (boleh service_role sementara, tidak aman) |

```powershell
Copy-Item .env.example .env
Copy-Item frontend\admin\js\supabase-config.example.js frontend\admin\js\supabase-config.js
```

Edit **kedua** file dengan URL project yang sama.

## 2. Jalankan server dari folder yang benar

**Terminal 1** — root project (ada folder `backend`):

```cmd
cd path\to\KamusKawanua(noadverb)
.venv\Scripts\python.exe -m uvicorn backend.main:app --reload
```

Cek: http://127.0.0.1:8000/docs harus terbuka.

**Terminal 2** — folder **`frontend`** (penting untuk CSS/layout):

```cmd
cd path\to\KamusKawanua(noadverb)\frontend
python -m http.server 5500
```

Buka: http://127.0.0.1:5500/login/login.html

Jangan:
- `python -m http.server` dari **root** repo (tampilan/CSS sering rusak)
- Buka file lewat `file://` di Explorer

## 3. Database Supabase

Jalankan sekali di SQL Editor project baru:

- `supabase/schema_3kelas_full.sql`

## 4. Cek cepat di browser (F12 → Console)

| Gejala | Penyebab |
|--------|----------|
| `supabase-config.js` 404 | File belum dibuat (langkah 1) |
| `createKamusSupabaseClient is not defined` | `supabase-init.js` tidak termuat — pull repo terbaru |
| `Server not reachable` (login) | Backend port 8000 tidak jalan |
| CSS polos / layout hancur | HTTP server bukan dari folder `frontend` |
| `Missing Supabase config` (uvicorn) | `.env` tidak ada di root |

## 5. Model (opsional untuk training/testing)

Folder `backend/trained_models/` tidak ikut Git. Latih ulang di laptop itu atau kirim folder model via ZIP.
