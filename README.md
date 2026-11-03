# Remote VS Code Controller

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Platform: Windows 10 / 11](https://img.shields.io/badge/Platform-Windows%2010%20%7C%2011-0078D6.svg)](https://microsoft.com/windows)
[![Electron: v30](https://img.shields.io/badge/Electron-30.0-47848F.svg)](https://electronjs.org)
[![TypeScript: v5.4](https://img.shields.io/badge/TypeScript-5.4-3178C6.svg)](https://typescriptlang.org)

> **Dedicated, isolated application-level remote access for Visual Studio Code on Windows.**

The Controller connects to a Provider machine and independently accesses, views, and controls a dedicated Visual Studio Code instance **without disturbing the Provider's existing desktop session, mouse, keyboard, active applications, or ongoing work**.

---

## Key Features

- 🛡️ **Complete Desktop & Input Isolation**: Never injects global input into the Provider's active desktop. Provider can browse, code, and work without mouse focus hijacking.
- 🚀 **Dedicated VS Code Server Instance**: Spawns isolated headless VS Code engine (`code serve-web`) with isolated `user-data` and `extensions` directories.
- ⚡ **Application-Level Control**: Full Monaco editor, terminal, extensions, file explorer, git, and debugging inside a high-performance Electron desktop app.
- 🔐 **Zero-Trust Security**: 6-digit cryptographic pairing PINs, explicit Provider approval dialogues, and instant session revocation.
- 📂 **Sandboxed File Manager & Multi-Tab Terminal**: Secure file operations with canonical path traversal protection and multi-session PowerShell/CMD terminals.

---

## Architecture Overview

```
Controller Desktop App (Electron + React)
       │
       ▼ (WSS / WebRTC DTLS)
Signaling & Auth Server (Node.js)
       │
       ▼ (WSS / WebRTC DTLS)
Provider Agent (Windows Background Service)
       │
       ▼ (Headless IPC & Dynamic Port Binding)
Dedicated VS Code Server Instance (`code serve-web`)
       │
       ▼
Authorized Workspace Sandbox
```

---

## Quick Start

### 1. Prerequisites
- Windows 10 / Windows 11
- Node.js LTS v18+ or v20+
- Visual Studio Code installed on the Provider system

### 2. Install & Build
```powershell
# Clone the repository
git clone <repository-url>
cd "Remote VS Code Controller"

# Install dependencies across all monorepo workspaces
npm.cmd install

# Build all packages
npm.cmd run build
```

### 3. Start Development Environment
```powershell
# Launch Signaling, Provider Agent, and Controller Desktop in parallel
.\scripts\start-development.ps1
```

---

## Documentation

Detailed documentation is available in the [`docs/`](./docs) directory:
- [System Architecture](./docs/architecture.md)
- [Security Model & Isolation Verification](./docs/security.md)
- [Installation Guide](./docs/installation.md)
- [Development Workflow](./docs/development.md)
- [Troubleshooting & Diagnostics](./docs/troubleshooting.md)

---

## License

This project is licensed under the MIT License - see the LICENSE file for details.
