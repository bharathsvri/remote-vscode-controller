import {
  createEnvelope,
  Envelope,
  isEnvelope,
  MESSAGE_TYPES,
  DeviceInfo,
  DevicePairingRequest,
  SessionApprovalDecision,
  DEFAULT_SESSION_PERMISSIONS,
  TerminalCreateRequest,
  TerminalSessionInfo,
  DirectoryListResponse,
  FileNode,
  FileReadResponse,
} from '@remote-vscode/shared';

export type MessageListener = (env: Envelope) => void;

export class SignalingClient {
  private ws: WebSocket | null = null;
  private url: string;
  private listeners: Set<MessageListener> = new Set();
  private pendingRequests = new Map<string, { resolve: (val: any) => void; reject: (err: any) => void; timer: any }>();
  private reconnectTimer: any = null;
  private isConnected: boolean = false;
  private onStatusChange?: (online: boolean) => void;

  constructor(url: string = 'ws://localhost:4000/ws') {
    this.url = url;
  }

  public setStatusCallback(cb: (online: boolean) => void): void {
    this.onStatusChange = cb;
  }

  public connect(): void {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    try {
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        console.log('[SignalingClient] Connected to server at', this.url);
        this.isConnected = true;
        this.onStatusChange?.(true);
        if (this.reconnectTimer) {
          clearTimeout(this.reconnectTimer);
          this.reconnectTimer = null;
        }
        this.requestDeviceList();
      };

      this.ws.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data);
          if (isEnvelope(parsed)) {
            // Check if this fulfills a pending request
            if (parsed.id && this.pendingRequests.has(parsed.id)) {
              const pending = this.pendingRequests.get(parsed.id)!;
              clearTimeout(pending.timer);
              this.pendingRequests.delete(parsed.id);
              pending.resolve(parsed.payload);
            }

            for (const listener of this.listeners) {
              listener(parsed);
            }
          }
        } catch (err) {
          console.error('[SignalingClient] Failed to parse message:', err);
        }
      };

      this.ws.onclose = () => {
        console.warn('[SignalingClient] Disconnected. Retrying in 3s...');
        this.isConnected = false;
        this.onStatusChange?.(false);
        this.scheduleReconnect();
      };

      this.ws.onerror = (err) => {
        console.warn('[SignalingClient] Socket error:', err);
      };
    } catch (err) {
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect(): void {
    if (!this.reconnectTimer) {
      this.reconnectTimer = setTimeout(() => {
        this.reconnectTimer = null;
        this.connect();
      }, 3000);
    }
  }

  public subscribe(listener: MessageListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  public send<T>(type: string, payload: T, options?: { id?: string; targetId?: string; sessionId?: string }): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('Signaling server is not connected');
    }
    const env = createEnvelope(type, payload, options);
    this.ws.send(JSON.stringify(env));
  }

  public async request<TResp = any, TReq = any>(
    type: string,
    payload: TReq,
    options?: { targetId?: string; sessionId?: string; timeoutMs?: number }
  ): Promise<TResp> {
    const id = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`Request timed out after ${options?.timeoutMs || 10000}ms`));
      }, options?.timeoutMs || 10000);

      this.pendingRequests.set(id, { resolve, reject, timer });
      this.send(type, payload, { id, targetId: options?.targetId, sessionId: options?.sessionId });
    });
  }

  public requestDeviceList(): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.send(MESSAGE_TYPES.DEVICE_LIST, {});
    }
  }

  public async pairDevice(targetDeviceId: string, pairingCode: string, controllerId: string, controllerName: string): Promise<any> {
    return this.request(MESSAGE_TYPES.DEVICE_PAIR_REQUEST, {
      targetDeviceId,
      pairingCode,
      controllerId,
      controllerName,
    });
  }

  public requestSession(
    targetDeviceId: string,
    controllerId: string,
    controllerName: string,
    requestedWorkspace: string
  ): void {
    this.send(
      MESSAGE_TYPES.SESSION_REQUEST,
      {
        controllerDeviceId: controllerId,
        controllerName,
        requestedWorkspace,
        requestedPermissions: DEFAULT_SESSION_PERMISSIONS,
      },
      { targetId: targetDeviceId }
    );
  }

  public terminateSession(sessionId: string, targetId: string): void {
    this.send(MESSAGE_TYPES.SESSION_TERMINATE, { sessionId }, { targetId, sessionId });
  }

  public createTerminal(sessionId: string, targetDeviceId: string, shell: 'powershell' | 'cmd' | 'bash' = 'powershell'): void {
    this.send(MESSAGE_TYPES.TERMINAL_CREATE, { sessionId, shell }, { targetId: targetDeviceId, sessionId });
  }

  public sendTerminalInput(sessionId: string, targetDeviceId: string, terminalId: string, data: string): void {
    this.send(MESSAGE_TYPES.TERMINAL_INPUT, { terminalId, data }, { targetId: targetDeviceId, sessionId });
  }

  public closeTerminal(sessionId: string, targetDeviceId: string, terminalId: string): void {
    this.send(MESSAGE_TYPES.TERMINAL_CLOSE, { terminalId }, { targetId: targetDeviceId, sessionId });
  }

  public async listFiles(sessionId: string, targetDeviceId: string, relPath: string = ''): Promise<DirectoryListResponse> {
    return this.request(MESSAGE_TYPES.FS_LIST, { path: relPath, sessionId }, { targetId: targetDeviceId, sessionId });
  }

  public async readFile(sessionId: string, targetDeviceId: string, relPath: string): Promise<FileReadResponse> {
    return this.request(MESSAGE_TYPES.FS_READ, { path: relPath, sessionId }, { targetId: targetDeviceId, sessionId });
  }

  public async writeFile(sessionId: string, targetDeviceId: string, relPath: string, content: string): Promise<any> {
    return this.request(MESSAGE_TYPES.FS_WRITE, { path: relPath, content, sessionId }, { targetId: targetDeviceId, sessionId });
  }

  public async deleteFile(sessionId: string, targetDeviceId: string, relPath: string, isDirectory: boolean = false): Promise<any> {
    return this.request(MESSAGE_TYPES.FS_DELETE, { path: relPath, isDirectory, sessionId }, { targetId: targetDeviceId, sessionId });
  }

  public async createFile(sessionId: string, targetDeviceId: string, relPath: string, isDirectory: boolean = false): Promise<any> {
    return this.request(MESSAGE_TYPES.FS_CREATE, { path: relPath, isDirectory, sessionId }, { targetId: targetDeviceId, sessionId });
  }

  public async searchFiles(sessionId: string, targetDeviceId: string, query: string): Promise<{ results: FileNode[] }> {
    return this.request(MESSAGE_TYPES.FS_SEARCH, { query, sessionId }, { targetId: targetDeviceId, sessionId });
  }
}

export const signalingClient = new SignalingClient();
