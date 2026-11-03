# Security Architecture & Threat Model: Remote VS Code Controller

## 1. Threat Model & Security Boundaries

Remote VS Code Controller operates on a zero-trust model between endpoints, with mandatory Provider authorization at every step.

```
+--------------------------------------------------------------------------------+
|                             SECURITY PERIMETERS                                |
+--------------------------------------------------------------------------------+
|  Controller           Signaling Server                  Provider               |
|  [Untrusted Network]   [Authenticated Broker]            [Protected Host]      |
|                                                                                |
|  1. Pairing Code  --->  Validates PIN & Issues JWT   ---> Shows Approval UI    |
|  2. Session Req   --->  Dispatches Request Token    ---> Explicit Path Choice  |
|  3. Remote Input  --->  Encrypted WebRTC / WSS      ---> Scoped Process Only   |
|  4. File Access   --->  Workspace Path Checked      ---> Realpath Canonicalized|
+--------------------------------------------------------------------------------+
```

---

## 2. Core Security Controls

### 2.1 Explicit Provider Authorization
- Connections **cannot** be established silently or automatically.
- When a Controller initiates a session, the Provider receives an explicit approval modal displaying:
  - Controller Name and ID
  - Requested Workspace Path
  - Requested Permissions (File Read, File Write, Terminal Execution, Debugging)
- The Provider retains one-click instant revocation power at all times.

### 2.2 Path Traversal & File Sandbox Prevention
To prevent path traversal (`../../Windows/System32` or symlink evasion):
- All incoming file operations pass through `validatePathInsideWorkspace`:
```typescript
const resolvedTarget = path.resolve(targetPath);
const normalizedTarget = path.normalize(resolvedTarget).toLowerCase();
const normalizedRoot = path.normalize(path.resolve(workspaceRoot)).toLowerCase();

if (!normalizedTarget.startsWith(normalizedRoot)) {
  throw new SecurityError('Path traversal attempt detected. Access denied.');
}
```
- Realpath resolution (`fs.realpathSync`) is executed before any file read or write to defeat symbolic link escapes.

### 2.3 Terminal Confinement
- The remote terminal module (`node-pty`) executes with the working directory locked strictly to `workspaceRoot`.
- Processes are spawned under the local user's security token with standard privileges (no UAC bypass or privilege escalation).
- If terminal execution permission is revoked by the Provider, all terminal creation attempts return `PERMISSION_DENIED`.

### 2.4 Cryptographic Authentication & Tokens
- **Signaling Channel**: TLS 1.3 / WSS encryption.
- **Pairing PIN**: Cryptographically random 6-character alphanumeric code with a 5-minute expiry and rate-limited attempts.
- **Session Tokens**: RS256/HS256 signed JSON Web Tokens (JWT) containing ephemeral session claims.
- **WebRTC Data Channel**: End-to-end encrypted using DTLS-SRTP.

### 2.5 Audit Logging
Every security-critical event is written to the audit log:
- Device registration & pairing attempts
- Session approval, rejection, and termination
- File write, upload, and deletion operations
- Terminal shell creations and executions
