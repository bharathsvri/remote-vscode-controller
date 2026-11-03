import { ChildProcess, spawn, spawnSync } from 'child_process';
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

    const cleanWorkspace = workspacePath.replace(/[/\\]+$/, '');
    const cleanUserData = context.userDataDir.replace(/[/\\]+$/, '');
    const quoteIfSpaces = (p: string) => p.includes(' ') ? `"${p}"` : p;

    const bindHost = process.env.PROVIDER_BIND_HOST || '0.0.0.0';

    // Run without connection token so page reloads and multiple tabs
    // connect seamlessly without "Unauthorized client refused" token mismatch errors
    const args = [
      'serve-web',
      '--host', bindHost,
      '--port', port.toString(),
      '--without-connection-token',
      '--server-data-dir', quoteIfSpaces(cleanUserData),
      '--default-folder', quoteIfSpaces(cleanWorkspace),
      '--accept-server-license-terms',
      '--disable-telemetry',
    ];

    console.log(`[VSCodeManager] Spawning dedicated VS Code instance on port ${port} (bound to ${bindHost})...`);
    console.log(`[VSCodeManager] Command: ${vscodeInfo.executablePath} ${args.join(' ')}`);

    // Detect host GitHub token from Git Credential Manager / env
    const hostGitHubToken = this.detectHostGitHubToken();
    const envVars: NodeJS.ProcessEnv = {
      ...process.env,
    };

    if (hostGitHubToken) {
      console.log(`[VSCodeManager] Detected host GitHub account. Injecting credentials into VS Code session.`);
      envVars.GITHUB_TOKEN = hostGitHubToken;
      envVars.GH_TOKEN = hostGitHubToken;
      envVars.COPILOT_GITHUB_TOKEN = hostGitHubToken;
    }

    if (process.env.PROVIDER_FULL_ACCESS === 'false') {
      envVars.VSCODE_CLI_DATA_DIR = context.sessionDir;
    }

    const child = spawn(vscodeInfo.executablePath, args, {
      shell: true,
      windowsHide: true, // Guarantees no CMD/console window pops up on the Provider desktop
      cwd: workspacePath,
      env: envVars,
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

    const reachableHost = DeviceInfoService.getReachableHost();

    // Normalize workspace path for VS Code Web URL (forward slashes and leading slash for Windows drive letters)
    // e.g. "D:\Work\Repositories" -> "/D:/Work/Repositories"
    // Without the leading slash, VS Code's browser URI parser treats "D:" as a protocol scheme (like 'http:'),
    // which causes the error: "unable to resolve filesystem provider with relative file path"
    let normalizedFolder = workspacePath.replace(/\\/g, '/').replace(/\/+$/, '');
    if (!normalizedFolder.startsWith('/')) {
      normalizedFolder = '/' + normalizedFolder;
    }

    const webUrl = `http://${reachableHost}:${port}/?folder=${encodeURIComponent(normalizedFolder)}`;

    const instance: LaunchedVSCodeInstance = {
      sessionId,
      process: child,
      port,
      connectionToken: '',
      webUrl,
      context,
      startedAt: Date.now(),
    };

    this.instances.set(sessionId, instance);
    console.log(`[VSCodeManager] Remote VS Code successfully launched: ${webUrl}`);
    console.log(`[VSCodeManager] Accessible locally and from another system via: http://${reachableHost}:${port}`);
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

  /**
   * Attempts to discover the host machine's GitHub OAuth token from Git Credential Manager or env
   */
  private detectHostGitHubToken(): string | null {
    if (process.env.COPILOT_GITHUB_TOKEN) return process.env.COPILOT_GITHUB_TOKEN;
    if (process.env.GITHUB_TOKEN) return process.env.GITHUB_TOKEN;
    if (process.env.GH_TOKEN) return process.env.GH_TOKEN;

    try {
      const res = spawnSync('git', ['credential', 'fill'], {
        input: 'protocol=https\nhost=github.com\n\n',
        encoding: 'utf-8',
        timeout: 3000,
        stdio: ['pipe', 'pipe', 'ignore'],
      });
      const match = res.stdout?.match(/password=(.+)/);
      if (match && match[1]?.trim()) {
        return match[1].trim();
      }
    } catch {}
    return null;
  }
}

export const vscodeProcessManager = new VSCodeProcessManager();
