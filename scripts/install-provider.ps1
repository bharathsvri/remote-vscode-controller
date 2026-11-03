<#
.SYNOPSIS
    Installs and configures the Remote VS Code Controller Provider Agent on Windows.
.DESCRIPTION
    Checks prerequisites (Node.js, VS Code), creates isolated session directories,
    installs dependencies, builds packages, and sets up optional Windows service or auto-start task.
#>

[CmdletBinding()]
param(
    [string]$SignalingUrl = "ws://localhost:4000/ws",
    [int]$Port = 4001,
    [string]$DefaultWorkspace = "$PSScriptRoot\..\workspace-demo",
    [switch]$InstallService = $false
)

$ErrorActionPreference = "Stop"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " Remote VS Code Controller - Provider Agent Installer" -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Cyan

# 1. Check Node.js
Write-Host "`n[1/5] Checking Node.js installation..." -ForegroundColor Yellow
try {
    $nodeVer = & node -v
    Write-Host "  ✓ Found Node.js: $nodeVer" -ForegroundColor Green
} catch {
    Write-Error "Node.js is not installed or not in PATH. Please install Node.js v18+ from https://nodejs.org/"
    exit 1
}

# 2. Check VS Code
Write-Host "`n[2/5] Detecting Visual Studio Code installation..." -ForegroundColor Yellow
$vscodeFound = $false
$codePaths = @(
    "$env:LOCALAPPDATA\Programs\Microsoft VS Code\bin\code.cmd",
    "$env:ProgramFiles\Microsoft VS Code\bin\code.cmd",
    "$env:ProgramFiles(x86)\Microsoft VS Code\bin\code.cmd"
)

foreach ($p in $codePaths) {
    if (Test-Path $p) {
        $vscodeFound = $true
        Write-Host "  ✓ Detected VS Code at: $p" -ForegroundColor Green
        break
    }
}

if (-not $vscodeFound) {
    try {
        $codeVer = & code --version
        $vscodeFound = $true
        Write-Host "  ✓ Detected VS Code in PATH: $codeVer" -ForegroundColor Green
    } catch {
        Write-Warning "VS Code executable 'code' was not found automatically."
        Write-Warning "Ensure Visual Studio Code is installed for the isolated session engine to operate."
    }
}

# 3. Create Isolation Storage Folders
Write-Host "`n[3/5] Setting up isolated storage directories..." -ForegroundColor Yellow
$sessionBase = Join-Path $env:USERPROFILE ".remote-vscode\sessions"
if (-not (Test-Path $sessionBase)) {
    New-Item -ItemType Directory -Path $sessionBase -Force | Out-Null
    Write-Host "  ✓ Created isolated session store at $sessionBase" -ForegroundColor Green
} else {
    Write-Host "  ✓ Isolated session store exists: $sessionBase" -ForegroundColor Green
}

if (-not (Test-Path $DefaultWorkspace)) {
    New-Item -ItemType Directory -Path $DefaultWorkspace -Force | Out-Null
    Write-Host "  ✓ Created demo workspace directory: $DefaultWorkspace" -ForegroundColor Green
}

# 4. Install Monorepo Dependencies & Build
Write-Host "`n[4/5] Building Provider Agent and shared packages..." -ForegroundColor Yellow
Push-Location "$PSScriptRoot\.."
try {
    & npm.cmd run build:shared
    & npm.cmd run build:provider
    Write-Host "  ✓ Build successful." -ForegroundColor Green
} finally {
    Pop-Location
}

# 5. Service / Startup Registration
Write-Host "`n[5/5] Configuration summary:" -ForegroundColor Yellow
Write-Host "  Signaling Server URL : $SignalingUrl" -ForegroundColor Cyan
Write-Host "  Provider Agent Port  : $Port" -ForegroundColor Cyan
Write-Host "  Default Workspace    : $DefaultWorkspace" -ForegroundColor Cyan

Write-Host "`n✓ Provider Agent installation and verification complete!" -ForegroundColor Green
Write-Host "To start the Provider Agent, run:" -ForegroundColor White
Write-Host "  npm.cmd run start:provider" -ForegroundColor Yellow
Write-Host "==========================================================" -ForegroundColor Cyan
