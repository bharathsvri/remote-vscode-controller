import http from 'http';
import express from 'express';
import cors from 'cors';
import { WebSocket, WebSocketServer } from 'ws';
import {
  createEnvelope,
  Envelope,
  isEnvelope,
  MESSAGE_TYPES,
  SessionApprovalDecision,
  SessionApprovalRequest,
  TerminalCreateRequest,
  TerminalInputPayload,
} from '@remote-vscode/shared';
import { DeviceInfoService } from '../device/device-info';
import { vscodeProcessManager } from '../vscode/vscode-manager';
import { desktopStreamerManager } from '../streaming/desktop-streamer-manager';
import { terminalManager } from '../terminal/terminal-manager';
import { fileSystemManager } from '../filesystem/filesystem-manager';
import { permissionManager } from '../security/permission-manager';
import { inputHandler } from '../input/input-handler';

export interface ProviderAgentConfig {
  signalingUrl: string;
  port: number;
  allowedWorkspaces: string[];
  defaultWorkspace: string;
}

export class ProviderAgent {
  private config: ProviderAgentConfig;
  private signalingWs?: WebSocket;
  private localServer?: http.Server;
  private localWss?: WebSocketServer;
  private pairingCode: string = '';
  private activeSessions = new Map<string, { workspace: string; port: number; webUrl: string }>();

  constructor(config: ProviderAgentConfig) {
    this.config = config;
  }

  public async start(): Promise<void> {
    const device = DeviceInfoService.getDeviceDetails(this.config.allowedWorkspaces);
    console.log(`[ProviderAgent] Device initialized: ${device.name} (${device.id})`);
    console.log(`[ProviderAgent] VS Code installed: ${device.vscodeInstalled} (${device.vscodeVersion || 'N/A'})`);

    // 1. Start direct local HTTP & WebSocket server
    this.startLocalServer();

    // 2. Connect to signaling server
    this.connectSignaling();
  }

  private startLocalServer(): void {
    const app = express();
    app.use(cors());
    app.use(express.json());

    app.get('/status', (req, res) => {
      const device = DeviceInfoService.getDeviceDetails(this.config.allowedWorkspaces);
      res.json({
        device,
        pairingCode: this.pairingCode,
        activeSessions: Array.from(this.activeSessions.keys()),
      });
    });

    this.localServer = http.createServer(app);
    this.localWss = new WebSocketServer({ server: this.localServer, path: '/agent-ws' });

    this.localWss.on('connection', (ws) => {
      ws.on('message', (data) => {
        try {
          const parsed = JSON.parse(data.toString());
          if (isEnvelope(parsed)) {
            this.handleIncomingMessage(ws, parsed);
          }
        } catch (err: any) {
          ws.send(JSON.stringify({ error: err.message }));
        }
      });
    });

    this.localServer.listen(this.config.port, '0.0.0.0', () => {
      console.log(`[ProviderAgent] Local agent server listening on port ${this.config.port}`);
    });
  }

  private connectSignaling(): void {
    console.log(`[ProviderAgent] Connecting to signaling server at ${this.config.signalingUrl}...`);

    try {
      this.signalingWs = new WebSocket(this.config.signalingUrl);

      this.signalingWs.on('open', () => {
        console.log('[ProviderAgent] Connected to signaling server');
        this.registerWithSignaling();
      });

      this.signalingWs.on('message', (data) => {
        try {
          const parsed = JSON.parse(data.toString());
          if (isEnvelope(parsed)) {
            this.handleIncomingMessage(this.signalingWs!, parsed);
          }
        } catch (err) {
          console.error('[ProviderAgent] Failed to parse signaling message:', err);
        }
      });

      this.signalingWs.on('close', () => {
        console.warn('[ProviderAgent] Disconnected from signaling server. Reconnecting in 5s...');
        setTimeout(() => this.connectSignaling(), 5000);
      });

      this.signalingWs.on('error', (err) => {
        console.warn(`[ProviderAgent] Signaling connection error: ${err.message}`);
      });
    } catch (err: any) {
      console.error(`[ProviderAgent] Connection error: ${err.message}. Retrying in 5s...`);
      setTimeout(() => this.connectSignaling(), 5000);
    }
  }

  private registerWithSignaling(): void {
    if (!this.signalingWs || this.signalingWs.readyState !== WebSocket.OPEN) return;

    const device = DeviceInfoService.getDeviceDetails(this.config.allowedWorkspaces);
    device.port = this.config.port;

    const registerMsg = createEnvelope(MESSAGE_TYPES.DEVICE_REGISTER, device, {
      senderId: device.id,
    });

    this.signalingWs.send(JSON.stringify(registerMsg));
  }

  private async handleIncomingMessage(sourceWs: WebSocket, env: Envelope): Promise<void> {
    switch (env.type) {
      case MESSAGE_TYPES.DEVICE_REGISTERED: {
        this.pairingCode = env.payload.pairingCode;
        console.log('\n=============================================================');
        console.log(`✅ Provider Registered Successfully!`);
        console.log(`🔑 Pairing Code:  [ ${this.pairingCode} ]`);
        console.log(`🖥️  Device ID:     ${env.payload.device.id}`);
        console.log('=============================================================\n');
        break;
      }

      // Incoming Session Request from Controller
      case MESSAGE_TYPES.SESSION_APPROVAL_PENDING: {
        const approvalReq = env.payload as SessionApprovalRequest;
        const decision = await permissionManager.requestApproval(approvalReq, this.config.defaultWorkspace);

        if (decision.approved) {
          try {
            const workspace = decision.approvedWorkspace || this.config.defaultWorkspace;
            const instance = await vscodeProcessManager.launchDedicatedSession(approvalReq.sessionId, workspace);

            decision.connectionToken = instance.connectionToken;
            decision.webUrl = instance.webUrl;

            // Start AnyDesk-style native desktop streamer
            try {
              const streamer = await desktopStreamerManager.startStreamer();
              decision.streamUrl = streamer.streamUrl;
              decision.inputUrl = streamer.inputUrl;
            } catch (sErr: any) {
              console.warn('[ProviderAgent] Native streamer start warning:', sErr.message);
            }

            this.activeSessions.set(approvalReq.sessionId, {
              workspace,
              port: instance.port,
              webUrl: instance.webUrl,
            });

            console.log(`[ProviderAgent] Session ${approvalReq.sessionId} active. Controller access authorized.`);
          } catch (err: any) {
            decision.approved = false;
            decision.reason = `Failed to launch isolated VS Code: ${err.message}`;
          }
        }

        // Return decision to signaling server or controller
        sourceWs.send(JSON.stringify(createEnvelope(
          MESSAGE_TYPES.SESSION_APPROVAL_DECISION,
          decision,
          { sessionId: approvalReq.sessionId, senderId: DeviceInfoService.getDeviceId() }
        )));
        break;
      }

      // Session Terminate
      case MESSAGE_TYPES.SESSION_TERMINATE:
      case MESSAGE_TYPES.SESSION_TERMINATED: {
        const { sessionId } = env.payload || {};
        if (sessionId) {
          console.log(`[ProviderAgent] Terminating session ${sessionId}`);
          desktopStreamerManager.stopStreamer();
          await vscodeProcessManager.stopSession(sessionId);
          terminalManager.closeAllForSession(sessionId);
          this.activeSessions.delete(sessionId);
        }
        break;
      }

      // Terminal Operations
      case MESSAGE_TYPES.TERMINAL_CREATE: {
        const { sessionId, shell, cwd } = env.payload as TerminalCreateRequest & { sessionId: string };
        const session = this.activeSessions.get(sessionId);
        const workspace = cwd || session?.workspace || this.config.defaultWorkspace;

        const terminalInfo = terminalManager.createTerminal(
          sessionId,
          workspace,
          shell || 'powershell',
          (data) => {
            sourceWs.send(JSON.stringify(createEnvelope(MESSAGE_TYPES.TERMINAL_OUTPUT, {
              terminalId: terminalInfo.terminalId,
              data,
            }, { sessionId })));
          },
          (code) => {
            sourceWs.send(JSON.stringify(createEnvelope(MESSAGE_TYPES.TERMINAL_CLOSE, {
              terminalId: terminalInfo.terminalId,
              exitCode: code,
            }, { sessionId })));
          }
        );

        sourceWs.send(JSON.stringify(createEnvelope(MESSAGE_TYPES.TERMINAL_CREATED, terminalInfo, { sessionId })));
        break;
      }

      case MESSAGE_TYPES.TERMINAL_INPUT: {
        const { terminalId, data } = env.payload as TerminalInputPayload;
        terminalManager.writeInput(terminalId, data);
        break;
      }

      case MESSAGE_TYPES.TERMINAL_CLOSE: {
        const { terminalId } = env.payload;
        terminalManager.closeTerminal(terminalId);
        break;
      }

      // File System Operations
      case MESSAGE_TYPES.FS_LIST: {
        const { path: relPath, sessionId } = env.payload;
        const session = this.activeSessions.get(sessionId);
        const workspace = session?.workspace || this.config.defaultWorkspace;

        try {
          const list = fileSystemManager.listDirectory(workspace, relPath);
          sourceWs.send(JSON.stringify(createEnvelope(MESSAGE_TYPES.FS_LIST, list, { id: env.id, sessionId })));
        } catch (err: any) {
          sourceWs.send(JSON.stringify(createEnvelope(MESSAGE_TYPES.FS_LIST, { error: err.message }, { id: env.id, sessionId })));
        }
        break;
      }

      case MESSAGE_TYPES.FS_READ: {
        const { path: relPath, sessionId } = env.payload;
        const session = this.activeSessions.get(sessionId);
        const workspace = session?.workspace || this.config.defaultWorkspace;

        try {
          const fileData = fileSystemManager.readFile(workspace, relPath);
          sourceWs.send(JSON.stringify(createEnvelope(MESSAGE_TYPES.FS_READ, fileData, { id: env.id, sessionId })));
        } catch (err: any) {
          sourceWs.send(JSON.stringify(createEnvelope(MESSAGE_TYPES.FS_READ, { error: err.message }, { id: env.id, sessionId })));
        }
        break;
      }

      case MESSAGE_TYPES.FS_WRITE: {
        const { path: relPath, content, encoding, sessionId } = env.payload;
        const session = this.activeSessions.get(sessionId);
        const workspace = session?.workspace || this.config.defaultWorkspace;

        try {
          fileSystemManager.writeFile(workspace, relPath, content, encoding);
          sourceWs.send(JSON.stringify(createEnvelope(MESSAGE_TYPES.FS_WRITE, { success: true, path: relPath }, { id: env.id, sessionId })));
        } catch (err: any) {
          sourceWs.send(JSON.stringify(createEnvelope(MESSAGE_TYPES.FS_WRITE, { error: err.message }, { id: env.id, sessionId })));
        }
        break;
      }

      case MESSAGE_TYPES.FS_CREATE: {
        const { path: relPath, isDirectory, sessionId } = env.payload;
        const session = this.activeSessions.get(sessionId);
        const workspace = session?.workspace || this.config.defaultWorkspace;

        try {
          fileSystemManager.createItem(workspace, relPath, isDirectory);
          sourceWs.send(JSON.stringify(createEnvelope(MESSAGE_TYPES.FS_CREATE, { success: true, path: relPath }, { id: env.id, sessionId })));
        } catch (err: any) {
          sourceWs.send(JSON.stringify(createEnvelope(MESSAGE_TYPES.FS_CREATE, { error: err.message }, { id: env.id, sessionId })));
        }
        break;
      }

      case MESSAGE_TYPES.FS_DELETE: {
        const { path: relPath, isDirectory, sessionId } = env.payload;
        const session = this.activeSessions.get(sessionId);
        const workspace = session?.workspace || this.config.defaultWorkspace;

        try {
          fileSystemManager.deleteItem(workspace, relPath, isDirectory);
          sourceWs.send(JSON.stringify(createEnvelope(MESSAGE_TYPES.FS_DELETE, { success: true, path: relPath }, { id: env.id, sessionId })));
        } catch (err: any) {
          sourceWs.send(JSON.stringify(createEnvelope(MESSAGE_TYPES.FS_DELETE, { error: err.message }, { id: env.id, sessionId })));
        }
        break;
      }

      case MESSAGE_TYPES.FS_RENAME: {
        const { oldPath, newPath, sessionId } = env.payload;
        const session = this.activeSessions.get(sessionId);
        const workspace = session?.workspace || this.config.defaultWorkspace;

        try {
          fileSystemManager.renameItem(workspace, oldPath, newPath);
          sourceWs.send(JSON.stringify(createEnvelope(MESSAGE_TYPES.FS_RENAME, { success: true }, { id: env.id, sessionId })));
        } catch (err: any) {
          sourceWs.send(JSON.stringify(createEnvelope(MESSAGE_TYPES.FS_RENAME, { error: err.message }, { id: env.id, sessionId })));
        }
        break;
      }

      case MESSAGE_TYPES.FS_SEARCH: {
        const { query, maxResults, sessionId } = env.payload;
        const session = this.activeSessions.get(sessionId);
        const workspace = session?.workspace || this.config.defaultWorkspace;

        try {
          const results = fileSystemManager.searchFiles(workspace, query, maxResults);
          sourceWs.send(JSON.stringify(createEnvelope(MESSAGE_TYPES.FS_SEARCH, { results }, { id: env.id, sessionId })));
        } catch (err: any) {
          sourceWs.send(JSON.stringify(createEnvelope(MESSAGE_TYPES.FS_SEARCH, { error: err.message }, { id: env.id, sessionId })));
        }
        break;
      }

      // Input Control (Isolated target)
      case MESSAGE_TYPES.INPUT_MOUSE: {
        if (env.sessionId) {
          inputHandler.handleMouseEvent(env.sessionId, env.payload);
        }
        break;
      }

      case MESSAGE_TYPES.INPUT_KEYBOARD: {
        if (env.sessionId) {
          inputHandler.handleKeyboardEvent(env.sessionId, env.payload);
        }
        break;
      }
    }
  }

  public getPairingCode(): string {
    return this.pairingCode;
  }
}
