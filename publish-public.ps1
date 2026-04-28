#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Builds the obfuscated WXATA binary and pushes it to the wxata-public repo.

.DESCRIPTION
    Run this script from the workspace root whenever you make changes to the
    backend that should be shipped to buyers.

    What it does:
      1. Runs `bun run build:public` — bundles backend/index.ts with Bun,
         then obfuscates the output with javascript-obfuscator
      2. Copies static files (README, LICENSE, Dockerfile, etc.) into wxata-public/
         in case you've updated them
      3. Stages, commits, and pushes the changes to github.com/TADSTech/wxata-public

.USAGE
    .\publish-public.ps1
    .\publish-public.ps1 -Message "Add anti-spam feature"
    .\publish-public.ps1 -SkipBuild   # only push, don't rebuild

.PARAMETER Message
    Git commit message. Defaults to "Release — <timestamp>"

.PARAMETER SkipBuild
    Skip the bun build step and just push whatever is already in wxata-public/dist/
#>

param(
    [string]$Message = "",
    [switch]$SkipBuild
)

$ErrorActionPreference = "Stop"
$Root = $PSScriptRoot

# ── Helpers ───────────────────────────────────────────────────────────────────

function Write-Step([string]$text) {
    Write-Host "`n▶  $text" -ForegroundColor Cyan
}

function Write-Success([string]$text) {
    Write-Host "✓  $text" -ForegroundColor Green
}

function Write-Fail([string]$text) {
    Write-Host "✗  $text" -ForegroundColor Red
}

# ── Step 1: Build ─────────────────────────────────────────────────────────────

if (-not $SkipBuild) {
    Write-Step "Building obfuscated binary (bun run build:public)..."

    Push-Location $Root
    try {
        bun run build:public
        if ($LASTEXITCODE -ne 0) {
            # javascript-obfuscator exits 1 even on success (promo message to stderr)
            # Check the output file actually exists and is non-empty
            $distFile = Join-Path $Root "wxata-public\dist\index.js"
            if (-not (Test-Path $distFile) -or (Get-Item $distFile).Length -eq 0) {
                Write-Fail "Build failed — wxata-public/dist/index.js is missing or empty"
                exit 1
            }
        }
        Write-Success "Build complete → wxata-public/dist/index.js"
    } finally {
        Pop-Location
    }
} else {
    Write-Host "⚠  Skipping build (--SkipBuild flag set)" -ForegroundColor Yellow
    $distFile = Join-Path $Root "wxata-public\dist\index.js"
    if (-not (Test-Path $distFile)) {
        Write-Fail "wxata-public/dist/index.js not found. Run without -SkipBuild first."
        exit 1
    }
}

# ── Step 2: Sync static files ─────────────────────────────────────────────────

Write-Step "Syncing static files into wxata-public/..."

$publicDir = Join-Path $Root "wxata-public"

# These files are maintained in the private repo and should be kept in sync
$staticFiles = @(
    @{ Src = "DOCUMENTATION.md";  Dst = "DOCUMENTATION.md" }
    @{ Src = "PLUGIN_SPEC.md";    Dst = "PLUGIN_SPEC.md" }
)

foreach ($f in $staticFiles) {
    $src = Join-Path $Root $f.Src
    $dst = Join-Path $publicDir $f.Dst
    if (Test-Path $src) {
        Copy-Item -Path $src -Destination $dst -Force
        Write-Host "   synced $($f.Src)" -ForegroundColor DarkGray
    }
}

Write-Success "Static files synced"

# ── Step 3: Commit and push ───────────────────────────────────────────────────

Write-Step "Committing and pushing to github.com/TADSTech/wxata-public..."

Push-Location $publicDir
try {
    # Check there's actually something to commit
    $status = git status --porcelain 2>&1
    if ([string]::IsNullOrWhiteSpace($status)) {
        Write-Host "   Nothing to commit — wxata-public is already up to date." -ForegroundColor DarkGray
        exit 0
    }

    # Build commit message
    if ([string]::IsNullOrWhiteSpace($Message)) {
        $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm"
        $Message = "Release — $timestamp"
    }

    git add .
    if ($LASTEXITCODE -ne 0) { Write-Fail "git add failed"; exit 1 }

    git commit -m $Message
    if ($LASTEXITCODE -ne 0) { Write-Fail "git commit failed"; exit 1 }

    git push origin main
    if ($LASTEXITCODE -ne 0) { Write-Fail "git push failed"; exit 1 }

    Write-Success "Pushed: `"$Message`""
} finally {
    Pop-Location
}

# ── Done ──────────────────────────────────────────────────────────────────────

Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Green
Write-Host "  wxata-public published successfully!" -ForegroundColor Green
Write-Host "  https://github.com/TADSTech/wxata-public" -ForegroundColor Green
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Green
