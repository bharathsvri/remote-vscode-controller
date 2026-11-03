import os from 'os';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { DeviceCapabilities, DeviceInfo } from '@remote-vscode/shared';

export class DeviceInfoService {
  private static cachedId: string | null = null;

  public static getDeviceId(): string {
    if (this.cachedId) return this.cachedId;

    // Generate or load persistent device ID
    const storageDir = process.env.PROVIDER_STORAGE_DIR || path.join(os.homedir(), '.remote-vscode');
    if (!fs.existsSync(storageDir)) {
      fs.mkdirSync(storageDir, { recursive: true });
    }

    const idFile = path.join(storageDir, 'device-id.txt');
    if (fs.existsSync(idFile)) {
      this.cachedId = fs.readFileSync(idFile, 'utf-8').trim();
    } else {
      const generatedId = `win-${os.hostname().toLowerCase().replace(/[^a-z0-9]/g, '-')}-${Math.random().toString(36).substring(2, 8)}`;
      fs.writeFileSync(idFile, generatedId, 'utf-8');
      this.cachedId = generatedId;
    }

    return this.cachedId;
  }

  /**
   * Resolves the primary reachable IP or host of the provider machine
   * so other systems on the network can access services.
   */
  public static getReachableHost(): string {
    if (process.env.PROVIDER_HOST) {
      return process.env.PROVIDER_HOST;
    }

    const nets = os.networkInterfaces();
    // 1. Prefer physical LAN/Wi-Fi adapters over virtual switches
    for (const name of Object.keys(nets)) {
      const isVirtual = /vethernet|hyper-v|wsl|docker|virtual|vmware|vbox/i.test(name);
      if (isVirtual) continue;

      for (const net of nets[name] || []) {
        if (net.family === 'IPv4' && !net.internal) {
          return net.address;
        }
      }
    }

    // 2. Fallback to any active non-internal IPv4
    for (const name of Object.keys(nets)) {
      for (const net of nets[name] || []) {
        if (net.family === 'IPv4' && !net.internal) {
          return net.address;
        }
      }
    }

    return '127.0.0.1';
  }

  public static detectVSCode(): { installed: boolean; version?: string; executablePath?: string } {
    // 1. Try `code --version` in PATH
    try {
      const output = execSync('code --version', { encoding: 'utf-8', timeout: 3000, stdio: ['pipe', 'pipe', 'ignore'] });
      const lines = output.trim().split('\n');
      return {
        installed: true,
        version: lines[0]?.trim(),
        executablePath: 'code',
      };
    } catch {
      // Continue to search standard paths
    }

    // 2. Search common Windows locations
    const localAppData = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
    const programFiles = process.env['ProgramFiles'] || 'C:\\Program Files';
    const programFilesX86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';

    const potentialPaths = [
      path.join(localAppData, 'Programs', 'Microsoft VS Code', 'bin', 'code.cmd'),
      path.join(programFiles, 'Microsoft VS Code', 'bin', 'code.cmd'),
      path.join(programFilesX86, 'Microsoft VS Code', 'bin', 'code.cmd'),
    ];

    for (const p of potentialPaths) {
      if (fs.existsSync(p)) {
        try {
          const out = execSync(`"${p}" --version`, { encoding: 'utf-8', timeout: 3000, stdio: ['pipe', 'pipe', 'ignore'] });
          return {
            installed: true,
            version: out.trim().split('\n')[0]?.trim(),
            executablePath: p,
          };
        } catch {
          return { installed: true, executablePath: p };
        }
      }
    }

    return { installed: false };
  }

  public static getAvailableShells(): ('powershell' | 'cmd' | 'bash')[] {
    const shells: ('powershell' | 'cmd' | 'bash')[] = ['powershell', 'cmd'];

    // Check Git Bash
    const gitBashPaths = [
      'C:\\Program Files\\Git\\bin\\bash.exe',
      'C:\\Program Files (x86)\\Git\\bin\\bash.exe',
      path.join(process.env.LOCALAPPDATA || '', 'Programs\\Git\\bin\\bash.exe'),
    ];

    for (const p of gitBashPaths) {
      if (fs.existsSync(p)) {
        shells.push('bash');
        break;
      }
    }

    return shells;
  }

  public static getDeviceDetails(allowedWorkspaces: string[]): DeviceInfo {
    const vscode = this.detectVSCode();
    const shells = this.getAvailableShells();

    const capabilities: DeviceCapabilities = {
      supportsWebRTC: true,
      supportsIsolatedVSCode: vscode.installed,
      supportsTerminal: true,
      supportsFileSystem: true,
      availableShells: shells,
    };

    return {
      id: this.getDeviceId(),
      name: process.env.PROVIDER_DEVICE_NAME || os.hostname(),
      os: 'Windows',
      osVersion: `${os.type()} ${os.release()}`,
      vscodeInstalled: vscode.installed,
      vscodeVersion: vscode.version,
      status: 'Online',
      lastSeen: Date.now(),
      allowedWorkspaces,
      capabilities,
    };
  }
}
