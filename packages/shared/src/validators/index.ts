/**
 * Cross-platform path normalization (works in both Node.js and Browser environments).
 */
export function normalizePath(p: string): string {
  if (!p) return '';
  const isWindowsAbsolute = /^[a-zA-Z]:/.test(p);
  let drivePrefix = '';
  let workingPath = p.replace(/\\/g, '/');

  if (isWindowsAbsolute) {
    drivePrefix = workingPath.substring(0, 2);
    workingPath = workingPath.substring(2);
  }

  const segments = workingPath.split('/').filter(Boolean);
  const resolvedSegments: string[] = [];

  for (const seg of segments) {
    if (seg === '.') continue;
    if (seg === '..') {
      if (resolvedSegments.length > 0 && resolvedSegments[resolvedSegments.length - 1] !== '..') {
        resolvedSegments.pop();
      } else {
        resolvedSegments.push('..');
      }
    } else {
      resolvedSegments.push(seg);
    }
  }

  const joined = resolvedSegments.join('/');
  return drivePrefix ? `${drivePrefix}/${joined}` : (workingPath.startsWith('/') ? `/${joined}` : joined);
}

/**
 * Validates that requestedPath resides strictly within workspaceRoot.
 * Prevents directory traversal attacks (e.g. "../", UNC paths, alternate data streams).
 */
export function isPathInsideWorkspace(workspaceRoot: string, targetPath: string): boolean {
  if (!workspaceRoot || !targetPath) return false;

  const normRoot = normalizePath(workspaceRoot).toLowerCase().replace(/\/+$/, '');
  const normTarget = normalizePath(targetPath).toLowerCase().replace(/\/+$/, '');

  // Exact match
  if (normTarget === normRoot) {
    return true;
  }

  // Check prefix + path separator
  const isInside = normTarget.startsWith(normRoot + '/');

  // Check for alternate data streams (Windows :stream)
  if (targetPath.includes(':') && !targetPath.match(/^[a-zA-Z]:/)) {
    return false;
  }

  return isInside;
}

/**
 * Sanitizes and safely resolves a relative path against an approved workspace root.
 * Throws an Error if a path traversal attempt is detected.
 */
export function safeResolvePath(workspaceRoot: string, relativePath: string): string {
  if (!workspaceRoot) {
    throw new Error('Workspace root is required');
  }

  // Treat absolute paths as relative to workspace root if passed
  const cleanRelative = relativePath ? relativePath.replace(/^([a-zA-Z]:|\/|\\)+/, '') : '';
  const normRoot = normalizePath(workspaceRoot).replace(/\/+$/, '');
  const normRel = normalizePath(cleanRelative);

  const resolved = normRel ? `${normRoot}/${normRel}` : normRoot;

  if (!isPathInsideWorkspace(normRoot, resolved)) {
    throw new Error(`Security Violation: Path traversal detected outside workspace: ${relativePath}`);
  }

  return resolved;
}

/**
 * Validates device IDs and pairing codes
 */
export function isValidPairingCode(code: string): boolean {
  return /^[A-Z0-9]{6}$/.test(code.toUpperCase());
}

export function isValidDeviceId(id: string): boolean {
  return /^[a-zA-Z0-9_-]{8,64}$/.test(id);
}
