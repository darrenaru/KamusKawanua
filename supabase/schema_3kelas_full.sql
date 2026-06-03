-- =============================================================================
-- Kamus Kawanua — FULL SCHEMA (3 kelas kata)
-- Untuk project Supabase BARU di organisasi yang sama.
--
-- Kelas `jenis` yang diizinkan:
--   kata kerja | kata benda | kata sifat
--
-- Cara pakai:
--   1. Buat project baru di Supabase Dashboard
--   2. SQL Editor → New query → paste seluruh file ini → Run
--   3. Update .env backend + anon key di frontend (URL project baru)
--
-- Catatan: Jangan jalankan di project produksi 4 kelas.
-- =============================================================================

begin;

-- ---------------------------------------------------------------------------
-- (Opsional) Hapus objek lama jika Anda re-run di project yang sudah terisi
-- Uncomment blok di bawah HANYA jika ingin reset penuh:
-- ---------------------------------------------------------------------------
/*
drop table if exists public.model_epoch_metrics cascade;
drop table if exists public.testing_results cascade;
drop table if exists public.training_logs cascade;
drop table if exists public.preprocessed_data cascade;
drop table if exists public.raw_data cascade;
drop table if exists public.models cascade;
drop table if exists public.datasets cascade;
drop table if exists public.dictionary cascade;
drop table if exists public.stopwords cascade;
drop table if exists public.slang_words cascade;
drop table if exists public.users cascade;
*/

-- ---------------------------------------------------------------------------
-- Helper: validasi jenis (3 kelas)
-- ---------------------------------------------------------------------------
create or replace function public.is_valid_jenis_3(j text)
returns boolean
language sql
immutable
as $$
  select
    j is null
    or btrim(j) = ''
    or lower(btrim(j)) in (
      'kata kerja',
      'kata benda',
      'kata sifat'
    );
$$;

-- ---------------------------------------------------------------------------
-- datasets (tanpa kata_keterangan)
-- ---------------------------------------------------------------------------
create table if not exists public.datasets (
  id bigint generated always as identity not null,
  name text not null,
  file_name text,
  total_data integer not null default 0,
  kata_kerja integer not null default 0,
  kata_benda integer not null default 0,
  kata_sifat integer not null default 0,
  uploaded_by text,
  is_preprocessed boolean not null default false,
  created_at timestamptz not null default now(),
  constraint datasets_pkey primary key (id)
);

comment on table public.datasets is 'Metadata upload CSV; agregat per jenis (3 kelas).';

-- ---------------------------------------------------------------------------
-- raw_data
-- ---------------------------------------------------------------------------
create table if not exists public.raw_data (
  id bigint generated always as identity not null,
  dataset_id bigint not null,
  id_kata text not null,
  jenis text,
  manado text,
  indonesia text,
  inggris text default ''::text,
  kalimat_manado text,
  kalimat_indonesia text,
  kalimat_inggris text default ''::text,
  constraint raw_data_pkey primary key (id),
  constraint raw_data_dataset_id_fkey
    foreign key (dataset_id) references public.datasets (id) on delete cascade,
  constraint raw_data_jenis_3kelas_check
    check (public.is_valid_jenis_3(jenis))
);

create index if not exists raw_data_dataset_id_idx
  on public.raw_data (dataset_id);

create unique index if not exists raw_data_dataset_id_kata_uidx
  on public.raw_data (dataset_id, id_kata);

-- ---------------------------------------------------------------------------
-- preprocessed_data
-- ---------------------------------------------------------------------------
create table if not exists public.preprocessed_data (
  id bigint generated always as identity not null,
  dataset_id bigint not null,
  id_kata text not null,
  jenis text,
  manado text,
  indonesia text,
  kalimat_manado text,
  kalimat_indonesia text,
  manado_clean text,
  indonesia_clean text,
  kalimat_manado_clean text,
  kalimat_indonesia_clean text,
  manado_tokens text,
  indonesia_tokens text,
  kalimat_manado_tokens text,
  kalimat_indonesia_tokens text,
  final_text text,
  bert_tokens text,
  input_ids text,
  attention_mask text,
  jenis_label integer,
  constraint preprocessed_data_pkey primary key (id),
  constraint preprocessed_data_dataset_id_fkey
    foreign key (dataset_id) references public.datasets (id) on delete cascade,
  constraint preprocessed_data_jenis_3kelas_check
    check (public.is_valid_jenis_3(jenis))
);

create index if not exists preprocessed_data_dataset_id_idx
  on public.preprocessed_data (dataset_id);

create unique index if not exists preprocessed_data_dataset_id_kata_uidx
  on public.preprocessed_data (dataset_id, id_kata);

-- ---------------------------------------------------------------------------
-- models (kolom inti + kolom testing/training dari models_testing_columns.sql)
-- ---------------------------------------------------------------------------
create table if not exists public.models (
  id bigint generated always as identity not null,
  nama_model text not null,
  algoritma text,
  mode text,
  dataset_id bigint,
  split_ratio text,
  k_fold integer,
  learning_rate double precision,
  epoch integer,
  batch_size integer,
  max_length integer,
  seed integer,
  optimizer text,
  weight_decay text,
  scheduler text,
  warmup_ratio double precision,
  dropout text,
  early_stopping text,
  gradient_accumulation text,
  vector_size text,
  window_size text,
  min_count text,
  model_type text,
  negative text,
  x_max text,
  alpha text,
  accuracy double precision,
  precision double precision,
  recall double precision,
  f1_score double precision,
  macro_avg double precision,
  train_loss double precision,
  train_mcc double precision,
  std_deviation double precision,
  train_weighted_avg double precision,
  train_std_deviation double precision,
  train_roc_auc double precision,
  test_accuracy double precision,
  test_precision_macro double precision,
  test_recall_macro double precision,
  test_f1_macro double precision,
  test_std_deviation double precision,
  test_weighted_avg double precision,
  test_roc_auc double precision,
  test_mcc double precision,
  test_max_length integer,
  tested_at timestamptz,
  created_at timestamptz not null default now(),
  constraint models_pkey primary key (id),
  constraint models_dataset_id_fkey
    foreign key (dataset_id) references public.datasets (id) on delete set null
);

create index if not exists models_dataset_id_idx on public.models (dataset_id);
create index if not exists models_nama_model_idx on public.models (nama_model);

-- ---------------------------------------------------------------------------
-- model_epoch_metrics
-- ---------------------------------------------------------------------------
create table if not exists public.model_epoch_metrics (
  id bigint generated always as identity not null,
  model_id bigint not null,
  epoch integer not null,
  accuracy double precision,
  precision double precision,
  recall double precision,
  f1_score double precision,
  loss double precision,
  roc_auc double precision,
  mcc double precision,
  confusion_matrix jsonb,
  confusion_labels jsonb,
  created_at timestamptz default now(),
  constraint model_epoch_metrics_pkey primary key (id),
  constraint model_epoch_metrics_model_id_fkey
    foreign key (model_id) references public.models (id) on delete cascade
);

create index if not exists model_epoch_metrics_model_id_idx
  on public.model_epoch_metrics (model_id);

create index if not exists model_epoch_metrics_model_epoch_idx
  on public.model_epoch_metrics (model_id, epoch);

-- ---------------------------------------------------------------------------
-- training_logs
-- ---------------------------------------------------------------------------
create table if not exists public.training_logs (
  id uuid not null default gen_random_uuid(),
  name text not null,
  algo text not null,
  date text not null,
  ratio text not null,
  dataset text not null,
  params jsonb,
  hasil jsonb,
  created_at timestamptz not null default timezone('utc'::text, now()),
  constraint training_logs_pkey primary key (id)
);

create index if not exists training_logs_created_at_idx
  on public.training_logs (created_at desc);

-- ---------------------------------------------------------------------------
-- testing_results
-- ---------------------------------------------------------------------------
create table if not exists public.testing_results (
  id bigint generated always as identity not null,
  dataset_id bigint not null,
  model_id bigint,
  model_name text,
  dataset_name text,
  total_data integer not null default 0,
  accuracy double precision,
  precision_macro double precision,
  recall_macro double precision,
  f1_macro double precision,
  std_deviation double precision,
  weighted_avg double precision,
  roc_auc double precision,
  mcc double precision,
  max_length integer,
  created_at timestamptz not null default now(),
  constraint testing_results_pkey primary key (id),
  constraint testing_results_dataset_id_fkey
    foreign key (dataset_id) references public.datasets (id) on delete cascade,
  constraint testing_results_model_id_fkey
    foreign key (model_id) references public.models (id) on delete set null
);

create index if not exists testing_results_dataset_id_idx
  on public.testing_results (dataset_id);

create index if not exists testing_results_model_id_idx
  on public.testing_results (model_id);

-- ---------------------------------------------------------------------------
-- stopwords & slang
-- ---------------------------------------------------------------------------
create table if not exists public.stopwords (
  id bigint generated always as identity not null,
  word text not null,
  language text not null default 'manado'::text,
  constraint stopwords_pkey primary key (id)
);

create unique index if not exists stopwords_word_language_uidx
  on public.stopwords (lower(word), lower(language));

create table if not exists public.slang_words (
  id bigint generated always as identity not null,
  slang text not null,
  formal text not null,
  constraint slang_words_pkey primary key (id),
  constraint slang_words_slang_key unique (slang)
);

-- ---------------------------------------------------------------------------
-- users (login admin)
-- ---------------------------------------------------------------------------
create table if not exists public.users (
  id bigint generated always as identity not null,
  username text not null,
  password text not null,
  constraint users_pkey primary key (id),
  constraint users_username_key unique (username)
);

-- ---------------------------------------------------------------------------
-- dictionary (pencarian halaman utama)
-- ---------------------------------------------------------------------------
create table if not exists public.dictionary (
  id bigint generated always as identity not null,
  manado text,
  indonesia text,
  inggris text,
  jenis text,
  kalimat_manado text,
  kalimat_indonesia text,
  kalimat_inggris text,
  id_kata bigint,
  constraint dictionary_pkey primary key (id),
  constraint dictionary_jenis_3kelas_check
    check (public.is_valid_jenis_3(jenis))
);

create index if not exists dictionary_manado_idx on public.dictionary (lower(manado));
create index if not exists dictionary_indonesia_idx on public.dictionary (lower(indonesia));

-- ---------------------------------------------------------------------------
-- Row Level Security (frontend memakai anon key)
-- Policy permissive agar pipeline admin jalan tanpa konfigurasi tambahan.
-- Untuk produksi ketat, ganti dengan policy per-role.
-- ---------------------------------------------------------------------------
alter table public.datasets enable row level security;
alter table public.raw_data enable row level security;
alter table public.preprocessed_data enable row level security;
alter table public.models enable row level security;
alter table public.model_epoch_metrics enable row level security;
alter table public.training_logs enable row level security;
alter table public.testing_results enable row level security;
alter table public.stopwords enable row level security;
alter table public.slang_words enable row level security;
alter table public.users enable row level security;
alter table public.dictionary enable row level security;

do $policies$
declare
  t text;
  tables text[] := array[
    'datasets',
    'raw_data',
    'preprocessed_data',
    'models',
    'model_epoch_metrics',
    'training_logs',
    'testing_results',
    'stopwords',
    'slang_words',
    'users',
    'dictionary'
  ];
begin
  foreach t in array tables loop
    execute format('drop policy if exists "%s_anon_all" on public.%I', t, t);
    execute format(
      'create policy "%s_anon_all" on public.%I for all to anon, authenticated using (true) with check (true)',
      t,
      t
    );
  end loop;
end;
$policies$;

-- ---------------------------------------------------------------------------
-- Akun admin contoh (ganti password sebelum produksi)
-- ---------------------------------------------------------------------------
insert into public.users (username, password)
values ('admin', 'admin123')
on conflict (username) do nothing;

commit;

-- =============================================================================
-- Setelah schema:
--   • Import CSV lewat Data Collection (hanya 3 jenis pada kolom jenis)
--   • Salin stopwords/slang/dictionary dari project lama jika perlu:
--       insert into public.dictionary (...) select ... from dblink / export CSV
--   • Latih model baru (3 label); jangan pakai checkpoint 4 kelas dari project lama
-- =============================================================================
