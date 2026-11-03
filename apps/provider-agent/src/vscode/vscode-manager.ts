import { ChildProcess, spawn } from 'child_process';
import net from 'net';
import { v4 as uuidv4 } from 'uuid';
import { IsolationContext, IsolationManager } from '../isolation/isolation-manager';
import { DeviceInfoService } from '../device/device-info';

export interface LaunchedVSCodeInstance {
  sessionId: string;
  process: ChildProcess;
  port: number;
  connectionToken: string;
  webUrl: string;
  context: IsolationContext;
  startedAt: number;
}

export class VSCodeProcessManager {
  private instances = new Map<string, LaunchedVSCodeInstance>();
  private isolationManager: IsolationManager;

  constructor(isolationManager?: IsolationManager) {
    this.isolationManager = isolationManager || new IsolationManager();
  }

  /**
   * Finds an available TCP port for the dedicated VS Code instance
   */
  public async findFreePort(startPort: number = 14000): Promise<number> {
    return new Promise((resolve, reject) => {
      const server = net.createServer();
      server.unref();
      server.on('error', (err) => {
        if ((err as any).code === 'EADDRINUSE') {
          resolve(this.findFreePort(startPort + 1));
        } else {
          reject(err);
        }
      });
      server.listen(startPort, '127.0.0.1', () => {
        const address = server.address() as net.AddressInfo;
        const port = address.port;
        server.close(() => resolve(port));
      });
    });
  }

  /**
   * Launches a dedicated, isolated VS Code web server instance.
   * This runs completely headless in the background without opening any GUI window
   * on the Provider desktop, preventing any desktop focus theft or mouse cursor interference.
   */
  public async launchDedicatedSession(sessionId: string, workspacePath: string): Promise<LaunchedVSCodeInstance> {
    const existing = this.instances.get(sessionId);
    if (existing) {
      return existing;
    }

    const vscodeInfo = DeviceInfoService.detectVSCode();
    if (!vscodeInfo.installed || !vscodeInfo.executablePath) {
      throw new Error('VS Code is not installed on the Provider system');
    }

    const port = await this.findFreePort();
    const connectionToken = uuidv4().replace(/-/g, '');
    const context = this.isolationManager.prepareIsolatedEnvironment(sessionId, workspacePath, port, connectionToken);

    const args = [
      'serve-web',
      '--host', '127.0.0.1',
      '--port', port.toString(),
      '--connection-token', connectionToken,
      '--server-data-dir', context.userDataDir,
      '--default-folder', workspacePath,
      '--accept-server-license-terms',
      '--disable-telemetry',
    ];

    console.log(`[VSCodeManager] Spawning isolated VS Code instance on port ${port}...`);
    console.log(`[VSCodeManager] Command: ${vscodeInfo.executablePath} ${args.join(' ')}`);

    const child = spawn(vscodeInfo.executablePath, args, {
      shell: true,
      windowsHide: true, // Guarantees no CMD/console window pops up on the Provider desktop
      cwd: workspacePath,
      env: {
        ...process.env,
        VSCODE_CLI_DATA_DIR: context.sessionDir,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let outputLog = '';
    child.stdout?.on('data', (data) => {
      const str = data.toString();
      outputLog += str;
      // console.log(`[VSCode #${port}] ${str}`);
    });

    child.stderr?.on('data', (data) => {
      const str = data.toString();
      outputLog += str;
      console.warn(`[VSCode #${port} ERR] ${str}`);
    });

    child.on('exit', (code, signal) => {
      console.log(`[VSCodeManager] Session ${sessionId} process exited with code ${code}, signal: ${signal}`);
      this.instances.delete(sessionId);
      this.isolationManager.cleanupSession(sessionId);
    });

    // Wait until server is listening or 15 seconds timeout
    await this.waitForPort(port, 15000);

    const webUrl = `http://127.0.0.1:${port}/?tkn=${connectionToken}&folder=${encodeURIComponent(workspacePath)}`;

    const instance: LaunchedVSCodeInstance = {
      sessionId,
      process: child,
      port,
      connectionToken,
      webUrl,
      context,
      startedAt: Date.now(),
    };

    this.instances.set(sessionId, instance);
    console.log(`[VSCodeManager] Isolated VS Code successfully launched: ${webUrl}`);
    return instance;
  }

  public getInstance(sessionId: string): LaunchedVSCodeInstance | undefined {
    return this.instances.get(sessionId);
  }

  public async stopSession(sessionId: string): Promise<void> {
    const instance = this.instances.get(sessionId);
    if (!instance) return;

    console.log(`[VSCodeManager] Stopping session ${sessionId}...`);
    try {
      if (process.platform === 'win32' && instance.process.pid) {
        // Kill process tree on Windows
        spawn('taskkill', ['/pid', instance.process.pid.toString(), '/T', '/F']);
      } else {
        instance.process.kill('SIGTERM');
      }
    } catch (err) {
      console.error(`[VSCodeManager] Error stopping process:`, err);
    }

    this.instances.delete(sessionId);
    this.isolationManager.cleanupSession(sessionId);
  }

  private async waitForPort(port: number, timeoutMs: number): Promise<void> {
    const startTime = Date.now();
    while (Date.now() - startTime < timeoutMs) {
      try {
        await new Promise<void>((resolve, reject) => {
          const socket = net.createConnection({ port, host: '127.0.0.1' }, () => {
            socket.destroy();
            resolve();
          });
          socket.on('error', (err) => reject(err));
          socket.setTimeout(500, () => {
            socket.destroy();
            reject(new Error('Timeout'));
          });
        });
        return; // Port is open!
      } catch {
        await new Promise(r => setTimeout(r, 400));
      }
    }
    throw new Error(`Timed out waiting for VS Code server on port ${port}`);
  }
}

export const vscodeProcessManager = new VSCodeProcessManager();
