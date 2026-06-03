-- Tambahkan kolom metrik testing/training di tabel `models`.
-- Jalankan di Supabase SQL Editor sekali (menghindari error simpan model: train_roc_auc / test_roc_auc).
--
-- Catatan schema:
-- - `std_deviation` = kolom legacy (std dev training); Evaluasi & Processing membacanya.
-- - `train_std_deviation` = nama baru (disarankan); isi keduanya jika memungkinkan.
-- - `test_std_deviation` = std dev hasil testing (kolom Testing / Comparison).

alter table public.models
  add column if not exists std_deviation double precision,
  add column if not exists test_accuracy double precision,
  add column if not exists test_precision_macro double precision,
  add column if not exists test_recall_macro double precision,
  add column if not exists test_f1_macro double precision,
  add column if not exists test_std_deviation double precision,
  add column if not exists test_weighted_avg double precision,
  add column if not exists test_roc_auc double precision,
  add column if not exists test_mcc double precision,
  add column if not exists test_max_length integer,
  add column if not exists tested_at timestamptz,
  add column if not exists macro_avg double precision,
  add column if not exists train_weighted_avg double precision,
  add column if not exists train_std_deviation double precision,
  add column if not exists train_roc_auc double precision,
  add column if not exists train_mcc double precision,
  add column if not exists train_loss double precision;
