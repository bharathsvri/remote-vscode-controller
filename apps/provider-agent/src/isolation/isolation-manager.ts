import * as path from 'path';
import * as fs from 'fs';
import os from 'os';

export interface IsolationContext {
  sessionId: string;
  sessionDir: string;
  userDataDir: string;
  extensionsDir: string;
  port: number;
  connectionToken: string;
  workspacePath: string;
}

export class IsolationManager {
  private baseStorageDir: string;

  constructor(baseStorageDir?: string) {
    this.baseStorageDir = baseStorageDir || path.join(os.homedir(), '.remote-vscode', 'sessions');
    if (!fs.existsSync(this.baseStorageDir)) {
      fs.mkdirSync(this.baseStorageDir, { recursive: true });
    }
  }

  /**
   * Prepares a completely isolated environment for a dedicated VS Code instance.
   * Guarantees separate user-data, separate extensions, and a clean configuration
   * without touching the Provider's active desktop, windows, or settings.
   */
  public prepareIsolatedEnvironment(sessionId: string, workspacePath: string, port: number, token: string): IsolationContext {
    const sessionDir = path.join(this.baseStorageDir, sessionId);
    const userDataDir = path.join(sessionDir, 'user-data');
    const extensionsDir = path.join(sessionDir, 'extensions');

    // Create directories
    fs.mkdirSync(userDataDir, { recursive: true });
    fs.mkdirSync(extensionsDir, { recursive: true });

    // Write isolated settings.json to optimize for remote headless operation
    const userSettingsDir = path.join(userDataDir, 'User');
    fs.mkdirSync(userSettingsDir, { recursive: true });
    const settingsPath = path.join(userSettingsDir, 'settings.json');
    const isolatedSettings = {
      'telemetry.telemetryLevel': 'off',
      'update.mode': 'none',
      'workbench.startupEditor': 'none',
      'window.restoreWindows': 'none',
      'security.workspace.trust.enabled': false,
    };
    fs.writeFileSync(settingsPath, JSON.stringify(isolatedSettings, null, 2), 'utf-8');

    return {
      sessionId,
      sessionDir,
      userDataDir,
      extensionsDir,
      port,
      connectionToken: token,
      workspacePath,
    };
  }

  /**
   * Validates that the requested isolation parameters meet security boundaries.
   */
  public validateIsolation(workspacePath: string, allowedWorkspaces: string[]): { valid: boolean; error?: string } {
    if (!workspacePath) {
      return { valid: false, error: 'Workspace path cannot be empty' };
    }

    if (!fs.existsSync(workspacePath)) {
      return { valid: false, error: `Requested workspace does not exist: ${workspacePath}` };
    }

    const stat = fs.statSync(workspacePath);
    if (!stat.isDirectory()) {
      return { valid: false, error: `Requested workspace must be a directory: ${workspacePath}` };
    }

    // If provider has an allowed list, ensure workspacePath is inside one of them
    if (allowedWorkspaces.length > 0) {
      const normalizedPath = path.resolve(workspacePath).toLowerCase();
      const isAllowed = allowedWorkspaces.some(allowed => {
        const normAllowed = path.resolve(allowed).toLowerCase();
        return normalizedPath.startsWith(normAllowed);
      });

      if (!isAllowed) {
        return {
          valid: false,
          error: `Workspace '${workspacePath}' is not in the Provider's authorized directory list.`,
        };
      }
    }

    return { valid: true };
  }

  /**
   * Cleans up isolated session artifacts upon termination.
   */
  public cleanupSession(sessionId: string): void {
    const sessionDir = path.join(this.baseStorageDir, sessionId);
    if (fs.existsSync(sessionDir)) {
      try {
        fs.rmSync(sessionDir, { recursive: true, force: true });
      } catch (err) {
        console.warn(`[IsolationManager] Could not immediately delete session directory: ${sessionDir}`, err);
      }
    }
  }
}
