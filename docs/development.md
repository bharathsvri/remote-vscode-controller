# Development Guide: Remote VS Code Controller

## 1. Monorepo Organization

This repository uses npm workspaces:
- `packages/shared`: Shared types, protocol validators, message definitions.
- `apps/signaling-server`: Fastify + WebSocket signaling broker.
- `apps/provider-agent`: Node.js daemon running on the Provider host.
- `apps/controller-desktop`: Electron + React + Vite application.

---

## 2. Quick Start for Developers

To run all three components concurrently in development mode:

```powershell
.\scripts\start-development.ps1
```

Or manually using individual terminal tabs:

### Terminal 1: Signaling Server
```cmd
npm.cmd run dev:signaling
```

### Terminal 2: Provider Agent
```cmd
npm.cmd run dev:provider
```

### Terminal 3: Controller Desktop (Vite + Electron)
```cmd
npm.cmd run dev:controller
```

---

## 3. Testing

Run unit and integration tests across all workspaces:
```cmd
npm.cmd test
```

Build all packages:
```cmd
npm.cmd run build
```
