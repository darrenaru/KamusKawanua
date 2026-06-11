# KamusKawanua (noadverb) — 3 kelas kata

Folder ini adalah versi **3 jenis kata** (kerja, benda, sifat). Project Supabase **terpisah** dari versi 4 kelas.

## Perbedaan dari versi 4 kelas

| Aspek | Versi ini (noadverb) |
|--------|----------------------|
| Kelas `jenis` | `kata kerja`, `kata benda`, `kata sifat` saja |
| UI admin | Tanpa kolom/kartu Adverb |
| Tabel `datasets` | Tanpa kolom `kata_keterangan` |
| Schema SQL | `supabase/schema_3kelas_full.sql` |

Perubahan di atas **tidak mengubah** alur fitur: Data Collection → Preprocessing → Processing → Testing → Evaluasi. Hanya kelas ke-4 yang dihapus.

## Setup cepat (setelah clone)

```powershell
cd "path\to\KamusKawanua(noadverb)"
.\scripts\setup-after-clone.ps1
```

Lalu ikuti `SETUP_CLONE.md`.

## File konfigurasi (dua tempat)

| File | Untuk |
|------|--------|
| `.env` | Backend (service_role) |
| `frontend/admin/js/supabase-config.js` | Browser admin (anon idealnya) |

`frontend/admin/js/supabase-init.js` **ikut Git** — berisi helper `createKamusSupabaseClient` sehingga clone tidak error "function not defined".

## Menjalankan

```cmd
REM Terminal 1 — root project
.venv\Scripts\python.exe -m uvicorn backend.main:app --reload

REM Terminal 2 — folder frontend (wajib untuk CSS)
cd frontend
python -m http.server 5500
```

## CSV

Hapus baris `jenis = kata keterangan` sebelum upload.

## Model

`backend/trained_models/` tidak ikut Git. Latih ulang setelah data 3 kelas terisi.

## XLM generasi 1 vs 2

Satu sumber: `backend/xlm_generation.py` → `ACTIVE_XLM_PROFILE` (`xlm-r` atau `xlm-r-2`).

- Hasil training disimpan ke Supabase dengan `algoritma` = profil aktif (gen2 → `xlm-r-2`, bukan disamakan ke gen1).
- UI tetap satu bucket **XLM-R**; filter model hanya menampilkan generasi yang aktif.
- **Cari rasio** memakai `fast_mode: true` (partial fine-tune, max_length efektif lebih pendek untuk XLM).
- **Training final** memakai `fast_mode: false`.
- Training log menampilkan `max_length`, `fast_mode`, dan generasi XLM saat job dimulai.

Setelah ganti profil: restart `uvicorn` + refresh browser.
