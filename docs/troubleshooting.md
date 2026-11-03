# Troubleshooting Guide: Remote VS Code Controller

## Common Issues & Resolutions

### 1. "VS Code is not installed on the Provider system"
- **Cause**: The `code` CLI executable is not in the system `PATH` or standard installation directories.
- **Resolution**:
  - Open VS Code manually.
  - Press `Ctrl + Shift + P` -> Select `Shell Command: Install 'code' command in PATH`.
  - Alternatively, check `%LOCALAPPDATA%\Programs\Microsoft VS Code\bin\code.cmd`.

### 2. "Signaling Offline" on Controller Dashboard
- **Cause**: The Signaling Server is not running or the WebSocket URL is unreachable.
- **Resolution**:
  - Verify signaling server is active: `curl http://localhost:4000/health`.
  - Check firewall settings on port 4000 (WSS/HTTP).
  - Ensure `.env` points `CONTROLLER_SIGNALING_URL` to the correct IP.

### 3. "Path traversal attempt detected" Error
- **Cause**: An operation requested a path outside the workspace authorized during session approval.
- **Resolution**:
  - Access is intentionally blocked for security.
  - If access to another folder is required, ask the Provider to grant access to that folder path as an allowed workspace.

### 4. Port Conflict During Isolated VS Code Spawning
- **Cause**: Port already in use.
- **Resolution**:
  - `VSCodeProcessManager` automatically scans for the next available port starting from 14000.
  - Check `netstat -ano | findstr 1400` to review active listeners.
