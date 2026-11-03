<#
.SYNOPSIS
    Starts the complete Remote VS Code Controller ecosystem in development mode.
.DESCRIPTION
    Launches:
      1. Signaling Server (port 4000)
      2. Provider Agent (port 4001)
      3. Controller Desktop Application (Electron + Vite)
#>

[CmdletBinding()]
param()

$root = Resolve-Path "$PSScriptRoot\.."

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " Remote VS Code Controller - Development Launcher" -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Cyan

# 1. Build shared package first
Write-Host "`n[Step 1] Building @remote-vscode/shared..." -ForegroundColor Yellow
& npm.cmd run build:shared

# 2. Launch Signaling Server in background process
Write-Host "`n[Step 2] Launching Signaling Server (Port 4000)..." -ForegroundColor Yellow
$signalingJob = Start-Process -FilePath "cmd.exe" -ArgumentList "/c npm run dev:signaling" -WorkingDirectory $root -PassThru
Start-Sleep -Seconds 2

# 3. Launch Provider Agent in background process
Write-Host "`n[Step 3] Launching Provider Agent (Port 4001)..." -ForegroundColor Yellow
$providerJob = Start-Process -FilePath "cmd.exe" -ArgumentList "/c npm run dev:provider" -WorkingDirectory $root -PassThru
Start-Sleep -Seconds 2

# 4. Launch Controller Desktop Application
Write-Host "`n[Step 4] Launching Controller Desktop Application (Electron)..." -ForegroundColor Yellow
try {
    Push-Location "$root\apps\controller-desktop"
    & npm.cmd run dev
} finally {
    Pop-Location
    Write-Host "`nShutting down background services..." -ForegroundColor Yellow
    if ($signalingJob -and -not $signalingJob.HasExited) { Stop-Process -Id $signalingJob.Id -Force -ErrorAction SilentlyContinue }
    if ($providerJob -and -not $providerJob.HasExited) { Stop-Process -Id $providerJob.Id -Force -ErrorAction SilentlyContinue }
    Write-Host "Cleanup complete." -ForegroundColor Green
}
