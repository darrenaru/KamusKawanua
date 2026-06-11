# Setup KamusKawanua (noadverb) setelah git clone — Windows PowerShell
# Jalankan dari root project:  .\scripts\setup-after-clone.ps1

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $Root

Write-Host "=== KamusKawanua (3 kelas) — setup clone ===" -ForegroundColor Cyan

if (-not (Test-Path ".env")) {
    Copy-Item ".env.example" ".env"
    Write-Host "[+] .env dibuat dari .env.example — isi SUPABASE_URL dan SUPABASE_KEY (service_role)" -ForegroundColor Yellow
} else {
    Write-Host "[=] .env sudah ada" -ForegroundColor Green
}

$cfg = "frontend\admin\js\supabase-config.js"
$cfgEx = "frontend\admin\js\supabase-config.example.js"
if (-not (Test-Path $cfg)) {
    Copy-Item $cfgEx $cfg
    Write-Host "[+] supabase-config.js dibuat — isi url + anonKey untuk halaman admin" -ForegroundColor Yellow
} else {
    Write-Host "[=] supabase-config.js sudah ada" -ForegroundColor Green
}

if (-not (Test-Path ".venv\Scripts\python.exe")) {
    Write-Host "[!] .venv belum ada. Buat dengan:" -ForegroundColor Yellow
    Write-Host "    py -3.12 -m venv .venv" -ForegroundColor White
    Write-Host "    .venv\Scripts\python.exe -m pip install -r backend\requirements.txt" -ForegroundColor White
} else {
    Write-Host "[=] .venv ditemukan" -ForegroundColor Green
}

Write-Host ""
Write-Host "Langkah berikutnya:" -ForegroundColor Cyan
Write-Host "  1. Edit .env dan frontend\admin\js\supabase-config.js"
Write-Host "  2. Jalankan schema: supabase\schema_3kelas_full.sql di Supabase SQL Editor"
Write-Host "  3. Terminal 1 (root): .venv\Scripts\python.exe -m uvicorn backend.main:app --reload"
Write-Host "  4. Terminal 2 (frontend): cd frontend ; python -m http.server 5500"
Write-Host "  5. Buka http://127.0.0.1:5500/login/login.html"
Write-Host ""
Write-Host "Panduan lengkap: SETUP_CLONE.md" -ForegroundColor Cyan
