import { ChildProcess, spawn, execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import net from 'net';
import { DeviceInfoService } from '../device/device-info';

export interface StreamerInstance {
  port: number;
  process: ChildProcess;
  streamUrl: string;
  inputUrl: string;
}

export class DesktopStreamerManager {
  private currentInstance?: StreamerInstance;
  private exePath: string;
  private csSourcePath: string;

  constructor() {
    this.exePath = path.resolve(__dirname, '../../desktop-streamer.exe');
    this.csSourcePath = path.resolve(__dirname, '../../src/streamer/DesktopStreamer.cs');
  }

  public async findFreePort(startPort: number = 14500): Promise<number> {
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

  public ensureBinaryExists(): void {
    if (fs.existsSync(this.exePath)) return;

    console.log('[DesktopStreamer] Compiling native desktop streamer...');
    const cscPaths = [
      'C:\\Windows\\Microsoft.NET\\Framework64\\v4.0.30319\\csc.exe',
      'C:\\Windows\\Microsoft.NET\\Framework\\v4.0.30319\\csc.exe',
    ];

    const compiler = cscPaths.find(p => fs.existsSync(p));
    if (!compiler) {
      throw new Error('C# compiler csc.exe not found on system');
    }

    const cmd = `"${compiler}" /out:"${this.exePath}" /r:System.Drawing.dll /r:System.Windows.Forms.dll "${this.csSourcePath}"`;
    execSync(cmd, { stdio: 'inherit' });
    console.log('[DesktopStreamer] Native streamer compiled successfully.');
  }

  public async startStreamer(): Promise<StreamerInstance> {
    if (this.currentInstance) {
      return this.currentInstance;
    }

    this.ensureBinaryExists();

    const port = await this.findFreePort();
    const args = ['--port', port.toString(), '--fps', '30', '--quality', '75'];

    console.log(`[DesktopStreamer] Spawning native streamer on port ${port}...`);
    const child = spawn(this.exePath, args, {
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    child.stdout?.on('data', (d) => console.log(d.toString().trim()));
    child.stderr?.on('data', (d) => console.warn('[DesktopStreamer ERR]', d.toString().trim()));

    child.on('exit', (code) => {
      console.log(`[DesktopStreamer] Process exited with code ${code}`);
      this.currentInstance = undefined;
    });

    // Wait until server is listening
    await this.waitForPort(port, 10000);

    const reachableHost = DeviceInfoService.getReachableHost();
    const streamUrl = `http://${reachableHost}:${port}/stream`;
    const inputUrl = `http://${reachableHost}:${port}/input`;

    this.currentInstance = {
      port,
      process: child,
      streamUrl,
      inputUrl,
    };

    console.log(`[DesktopStreamer] Stream active at: ${streamUrl}`);
    console.log(`[DesktopStreamer] Input endpoint at: ${inputUrl}`);

    return this.currentInstance;
  }

  public stopStreamer(): void {
    if (!this.currentInstance) return;

    try {
      if (this.currentInstance.process.pid) {
        spawn('taskkill', ['/pid', this.currentInstance.process.pid.toString(), '/T', '/F']);
      }
    } catch {}

    this.currentInstance = undefined;
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
          socket.setTimeout(400, () => {
            socket.destroy();
            reject(new Error('Timeout'));
          });
        });
        return;
      } catch {
        await new Promise(r => setTimeout(r, 300));
      }
    }
    throw new Error(`Timed out waiting for Desktop Streamer on port ${port}`);
  }
}

export const desktopStreamerManager = new DesktopStreamerManager();
