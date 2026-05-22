-- Tambahkan kolom metrik testing di tabel `models` (ganti tabel testing_results).
-- Jalankan di Supabase SQL Editor sekali.

alter table public.models
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
  add column if not exists train_roc_auc double precision;
