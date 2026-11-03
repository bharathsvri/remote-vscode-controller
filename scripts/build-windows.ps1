<#
.SYNOPSIS
    Builds production binaries and distribution packages for Windows.
.DESCRIPTION
    Compiles TypeScript across all packages, packages the Electron controller app,
    and bundles the standalone Provider Agent.
#>

[CmdletBinding()]
param(
    [switch]$SkipTests = $false
)

$ErrorActionPreference = "Stop"
$root = Resolve-Path "$PSScriptRoot\.."

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " Remote VS Code Controller - Windows Build Pipeline" -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Cyan

Push-Location $root
try {
    # 1. Clean previous build artifacts
    Write-Host "`n[1/4] Building all monorepo workspaces..." -ForegroundColor Yellow
    & npm.cmd run build

    # 2. Run Test Suite
    if (-not $SkipTests) {
        Write-Host "`n[2/4] Running test suite..." -ForegroundColor Yellow
        & npm.cmd test
    } else {
        Write-Host "`n[2/4] Skipping tests (-SkipTests passed)" -ForegroundColor DarkGray
    }

    # 3. Build Controller Electron App
    Write-Host "`n[3/4] Packaging Electron Desktop Application..." -ForegroundColor Yellow
    Push-Location "$root\apps\controller-desktop"
    try {
        & npm.cmd run build
        Write-Host "  ✓ Electron Main & Renderer bundles ready in dist/" -ForegroundColor Green
    } finally {
        Pop-Location
    }

    # 4. Packaging Provider Agent bundle
    Write-Host "`n[4/4] Verifying Provider Agent distribution bundle..." -ForegroundColor Yellow
    Push-Location "$root\apps\provider-agent"
    try {
        & npm.cmd run build
        Write-Host "  ✓ Provider Agent distribution bundle ready in dist/" -ForegroundColor Green
    } finally {
        Pop-Location
    }

    Write-Host "`n==========================================================" -ForegroundColor Green
    Write-Host " 🎉 Windows Build Completed Successfully!" -ForegroundColor Green
    Write-Host "==========================================================" -ForegroundColor Green
} finally {
    Pop-Location
}
