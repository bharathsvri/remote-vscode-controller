# Installation Guide: Remote VS Code Controller

## 1. Prerequisites

### Operating System Support
- Windows 10 (Build 19041+)
- Windows 11 (All builds)
- Node.js LTS v18.0.0 or v20.0.0+
- Visual Studio Code installed on the Provider machine

---

## 2. Provider Machine Setup

### Automated PowerShell Setup
Run PowerShell as Administrator or standard user and execute:
```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\scripts\install-provider.ps1 -SignalingUrl "ws://<signaling-ip>:4000/ws" -Port 4001
```

### Manual Setup
1. Clone repository:
   ```cmd
   git clone <repo-url>
   cd "Remote VS Code Controller"
   ```
2. Install dependencies:
   ```cmd
   npm.cmd install
   ```
3. Copy environment template:
   ```cmd
   copy .env.example .env
   ```
   Edit `.env` and set `PROVIDER_DEFAULT_WORKSPACE` to your intended development directory.
4. Build the packages:
   ```cmd
   npm.cmd run build:shared
   npm.cmd run build:provider
   ```
5. Start the Provider Agent:
   ```cmd
   npm.cmd run start:provider
   ```

---

## 3. Controller Desktop Setup

1. Build the desktop app:
   ```cmd
   npm.cmd run build:shared
   npm.cmd run build:controller
   ```
2. Start the Controller Desktop App:
   ```cmd
   npm.cmd run start:controller
   ```
3. In the Desktop App:
   - Click **Pair Device**.
   - Enter the Provider's Device ID and the 6-digit pairing code shown in the Provider Agent console.
   - Click **Connect** to request an isolated session.
   - Once approved on the Provider machine, the isolated VS Code workspace will load directly in your controller window.

---

## 4. Connection Signaling Server Setup

For private or cloud deployment:
```cmd
npm.cmd run build:signaling
npm.cmd run start:signaling
```
Or with Docker Compose:
```cmd
cd infrastructure/docker
docker-compose up -d
```
