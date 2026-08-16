# WXATA Setup Script (PowerShell)
# Run this after cloning the repository

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "  ╔══════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "  ║        WXATA Setup Script            ║" -ForegroundColor Cyan
Write-Host "  ╚══════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# Check if Bun is installed
if (!(Get-Command bun -ErrorAction SilentlyContinue)) {
    Write-Host "[!] Bun is not installed." -ForegroundColor Yellow
    Write-Host "    Install it from: https://bun.sh" -ForegroundColor Yellow
    Write-Host "    Or run: npm install -g bun" -ForegroundColor Yellow
    exit 1
}

Write-Host "[1/4] Creating .env from template..." -ForegroundColor Green
if (!(Test-Path .env)) {
    Copy-Item .env.example .env
    Write-Host "      Created .env — edit it with your settings" -ForegroundColor Gray
} else {
    Write-Host "      .env already exists, skipping" -ForegroundColor Gray
}

Write-Host "[2/4] Creating botinfo.json from template..." -ForegroundColor Green
if (!(Test-Path botinfo.json)) {
    Copy-Item botinfo.example.json botinfo.json
    Write-Host "      Created botinfo.json" -ForegroundColor Gray
} else {
    Write-Host "      botinfo.json already exists, skipping" -ForegroundColor Gray
}

Write-Host "[3/4] Creating primary/secondary config directories..." -ForegroundColor Green
if (!(Test-Path primary)) { New-Item -ItemType Directory -Path primary | Out-Null }
if (!(Test-Path secondary)) { New-Item -ItemType Directory -Path secondary | Out-Null }

# Copy botinfo.json into account dirs if not present
if (!(Test-Path primary\botinfo.json)) {
    Copy-Item botinfo.example.json primary\botinfo.json
    Write-Host "      Created primary/botinfo.json" -ForegroundColor Gray
}
if (!(Test-Path secondary\botinfo.json)) {
    Copy-Item botinfo.example.json secondary\botinfo.json
    Write-Host "      Created secondary/botinfo.json" -ForegroundColor Gray
}

Write-Host "[4/4] Installing dependencies..." -ForegroundColor Green
bun run install:all

Write-Host ""
Write-Host "  ✓ Setup complete!" -ForegroundColor Green
Write-Host ""
Write-Host "  Next steps:" -ForegroundColor Cyan
Write-Host "    1. Edit .env with your configuration" -ForegroundColor White
Write-Host "    2. Edit botinfo.json to customize commands" -ForegroundColor White
Write-Host "    3. Run: bun run all" -ForegroundColor White
Write-Host ""
Write-Host "  Dashboard: http://localhost:5173" -ForegroundColor Yellow
Write-Host "  Backend:   ws://localhost:5000" -ForegroundColor Yellow
Write-Host ""
