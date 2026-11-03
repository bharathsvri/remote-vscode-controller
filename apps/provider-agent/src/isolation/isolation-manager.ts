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
  private isFullAccess: boolean;

  constructor(baseStorageDir?: string) {
    this.baseStorageDir = baseStorageDir || path.join(os.homedir(), '.remote-vscode');
    this.isFullAccess = process.env.PROVIDER_FULL_ACCESS !== 'false'; // Default to full access mode
    if (!fs.existsSync(this.baseStorageDir)) {
      fs.mkdirSync(this.baseStorageDir, { recursive: true });
    }
  }

  /**
   * Prepares the session environment for the VS Code server instance.
   * In Full Access mode, retains a persistent profile and links host extensions
   * (including GitHub Copilot, linters, tools) and settings.
   */
  public prepareIsolatedEnvironment(sessionId: string, workspacePath: string, port: number, token: string): IsolationContext {
    const sessionDir = this.isFullAccess
      ? path.join(this.baseStorageDir, 'persistent-profile')
      : path.join(this.baseStorageDir, 'sessions', sessionId);

    const userDataDir = path.join(sessionDir, 'user-data');
    const extensionsDir = path.join(userDataDir, 'extensions');

    fs.mkdirSync(userDataDir, { recursive: true });

    // In full access mode, link host extensions directory so Copilot & all extensions are available
    if (this.isFullAccess) {
      const hostExtensionsDir = path.join(os.homedir(), '.vscode', 'extensions');
      if (!fs.existsSync(extensionsDir)) {
        if (fs.existsSync(hostExtensionsDir)) {
          try {
            fs.symlinkSync(hostExtensionsDir, extensionsDir, 'junction');
            console.log(`[IsolationManager] Linked host extensions from ${hostExtensionsDir} to session extensions`);
          } catch (err) {
            console.warn(`[IsolationManager] Could not junction host extensions, creating directory:`, err);
            fs.mkdirSync(extensionsDir, { recursive: true });
          }
        } else {
          fs.mkdirSync(extensionsDir, { recursive: true });
        }
      }
    } else {
      if (!fs.existsSync(extensionsDir)) {
        fs.mkdirSync(extensionsDir, { recursive: true });
      }
    }

    // Write / merge user settings in both locations used by VS Code Web & Server
    const userDirs = [
      path.join(userDataDir, 'User'),
      path.join(userDataDir, 'data', 'User'),
    ];

    let hostSettings: Record<string, any> = {};
    if (this.isFullAccess) {
      const hostSettingsPath = path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'Code', 'User', 'settings.json');
      if (fs.existsSync(hostSettingsPath)) {
        try {
          hostSettings = JSON.parse(fs.readFileSync(hostSettingsPath, 'utf-8'));
        } catch {
          // Ignore JSON parse errors in host settings
        }
      }
    }

    const mergedSettings = {
      ...hostSettings,
      'telemetry.telemetryLevel': 'off',
      'update.mode': 'none',
      'workbench.startupEditor': 'none',
      'security.workspace.trust.enabled': false,
      'github.copilot.enable': {
        '*': true,
        'plaintext': true,
        'markdown': true,
        'scminput': true,
      },
      'github.copilot.editor.enableAutoCompletions': true,
      'github.copilot.chat.welcomeMessage': 'never',
      'chat.commandCenter.enabled': true,
    };

    for (const uDir of userDirs) {
      fs.mkdirSync(uDir, { recursive: true });
      fs.writeFileSync(path.join(uDir, 'settings.json'), JSON.stringify(mergedSettings, null, 2), 'utf-8');
    }

    // Seed globalStorage (account state, database, tokens) if available from host
    if (this.isFullAccess) {
      const hostGlobalStorage = path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'Code', 'User', 'globalStorage');
      const targetGlobalStorage = path.join(userDataDir, 'data', 'User', 'globalStorage');
      fs.mkdirSync(targetGlobalStorage, { recursive: true });

      const filesToSeed = ['state.vscdb', 'storage.json'];
      for (const f of filesToSeed) {
        const src = path.join(hostGlobalStorage, f);
        const dst = path.join(targetGlobalStorage, f);
        if (fs.existsSync(src) && !fs.existsSync(dst)) {
          try {
            fs.copyFileSync(src, dst);
            console.log(`[IsolationManager] Seeded ${f} from host into remote profile`);
          } catch (err) {
            console.warn(`[IsolationManager] Could not seed ${f}:`, err);
          }
        }
      }
    }

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
   * Cleans up session artifacts upon termination.
   */
  public cleanupSession(sessionId: string): void {
    if (this.isFullAccess) {
      // Retain persistent profile for future sessions (extensions, Copilot auth, settings)
      console.log(`[IsolationManager] Retaining persistent profile for future sessions.`);
      return;
    }

    const sessionDir = path.join(this.baseStorageDir, 'sessions', sessionId);
    if (fs.existsSync(sessionDir)) {
      try {
        fs.rmSync(sessionDir, { recursive: true, force: true });
      } catch (err) {
        console.warn(`[IsolationManager] Could not immediately delete session directory: ${sessionDir}`, err);
      }
    }
  }
}
