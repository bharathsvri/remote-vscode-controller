import { Server as HttpServer } from 'http';
import { WebSocket, WebSocketServer } from 'ws';
import {
  Envelope,
  MESSAGE_TYPES,
  createEnvelope,
  isEnvelope,
  DeviceRegistrationRequest,
  DevicePairingRequest,
  SessionApprovalRequest,
  SessionApprovalDecision,
} from '@remote-vscode/shared';
import { deviceRegistry } from '../device/device-registry';
import { sessionManager } from '../session/session-manager';
import { AuthService } from '../authentication/auth-service';
import { SignalingHandler } from '../signaling/signaling-handler';

export class SignalingWsServer {
  private wss: WebSocketServer;
  private clientRoles = new Map<WebSocket, { deviceId?: string; role: 'provider' | 'controller' }>();
  private sessionControllerSockets = new Map<string, WebSocket>();
  private pendingRequestSockets = new Map<string, WebSocket>();

  constructor(server: HttpServer) {
    this.wss = new WebSocketServer({ server, path: '/ws' });
    this.init();
  }

  private init(): void {
    this.wss.on('connection', (ws: WebSocket, req) => {
      // Periodic ping
      const pingInterval = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.ping();
        }
      }, 30000);

      ws.on('close', () => {
        clearInterval(pingInterval);
        const client = this.clientRoles.get(ws);
        if (client?.deviceId) {
          deviceRegistry.detachSocket(client.deviceId);
          this.broadcastDeviceUpdate();
        }
        this.clientRoles.delete(ws);
        for (const [sId, sWs] of this.sessionControllerSockets.entries()) {
          if (sWs === ws) {
            this.sessionControllerSockets.delete(sId);
          }
        }
        for (const [rId, rWs] of this.pendingRequestSockets.entries()) {
          if (rWs === ws) {
            this.pendingRequestSockets.delete(rId);
          }
        }
      });

      ws.on('message', (data: Buffer | string) => {
        try {
          const parsed = JSON.parse(data.toString());
          if (!isEnvelope(parsed)) {
            ws.send(JSON.stringify({ error: 'Invalid envelope structure' }));
            return;
          }
          this.handleMessage(ws, parsed);
        } catch (err: any) {
          ws.send(JSON.stringify({ error: 'Failed to process message', details: err.message }));
        }
      });
    });
  }

  private handleMessage(ws: WebSocket, env: Envelope): void {
    switch (env.type) {
      // 1. Device Registration (from Provider)
      case MESSAGE_TYPES.DEVICE_REGISTER: {
        const payload = env.payload as DeviceRegistrationRequest;
        const { device, pairingCode } = deviceRegistry.register(payload, ws);
        this.clientRoles.set(ws, { deviceId: device.id, role: 'provider' });

        const token = AuthService.generateToken({ deviceId: device.id, role: 'provider', name: device.name });
        ws.send(JSON.stringify(createEnvelope(MESSAGE_TYPES.DEVICE_REGISTERED, {
          device,
          pairingCode,
          token,
        }, { sessionId: env.sessionId })));

        this.broadcastDeviceUpdate();
        break;
      }

      // 2. Device List (requested by Controller)
      case MESSAGE_TYPES.DEVICE_LIST: {
        const devices = deviceRegistry.listOnlineDevices();
        ws.send(JSON.stringify(createEnvelope(MESSAGE_TYPES.DEVICE_LIST, { devices })));
        break;
      }

      // 3. Pairing Request (Controller pairing with Provider by 6-digit code)
      case MESSAGE_TYPES.DEVICE_PAIR_REQUEST: {
        const req = env.payload as DevicePairingRequest;
        const valid = deviceRegistry.verifyPairing(req.targetDeviceId, req.pairingCode);
        if (!valid) {
          ws.send(JSON.stringify(createEnvelope(MESSAGE_TYPES.DEVICE_PAIR_RESPONSE, {
            success: false,
            error: 'Invalid pairing code or device not found',
          })));
          return;
        }

        const device = deviceRegistry.getDevice(req.targetDeviceId);
        this.clientRoles.set(ws, { deviceId: req.controllerId, role: 'controller' });
        const authToken = AuthService.generateSessionToken(req.controllerId, req.targetDeviceId, 'paired');
        ws.send(JSON.stringify(createEnvelope(MESSAGE_TYPES.DEVICE_PAIR_RESPONSE, {
          success: true,
          device,
          authToken,
        })));
        break;
      }

      // 4. Session Request (Controller asking Provider for access)
      case MESSAGE_TYPES.SESSION_REQUEST: {
        const targetDeviceId = env.targetId;
        if (!targetDeviceId) {
          ws.send(JSON.stringify(createEnvelope(MESSAGE_TYPES.SESSION_ERROR, { error: 'Target device ID is required' })));
          return;
        }

        const providerWs = deviceRegistry.getDeviceSocket(targetDeviceId);
        if (!providerWs || providerWs.readyState !== WebSocket.OPEN) {
          ws.send(JSON.stringify(createEnvelope(MESSAGE_TYPES.SESSION_ERROR, { error: 'Provider device is offline' })));
          return;
        }

        const pending = sessionManager.createApprovalRequest(env.payload);
        this.clientRoles.set(ws, { deviceId: pending.controllerDeviceId, role: 'controller' });
        this.sessionControllerSockets.set(pending.sessionId, ws);

        // Relay approval request directly to Provider Agent
        providerWs.send(JSON.stringify(createEnvelope(
          MESSAGE_TYPES.SESSION_APPROVAL_PENDING,
          pending,
          { sessionId: pending.sessionId, senderId: env.senderId, targetId: targetDeviceId }
        )));

        // Notify Controller that approval is pending
        ws.send(JSON.stringify(createEnvelope(
          MESSAGE_TYPES.SESSION_APPROVAL_PENDING,
          { sessionId: pending.sessionId, status: 'Waiting for Provider approval...' },
          { sessionId: pending.sessionId }
        )));
        break;
      }

      // 5. Provider Session Approval Decision
      case MESSAGE_TYPES.SESSION_APPROVAL_DECISION: {
        const decision = env.payload as SessionApprovalDecision;
        const pending = sessionManager.getPendingApproval(decision.sessionId);
        if (!pending) {
          ws.send(JSON.stringify(createEnvelope(MESSAGE_TYPES.SESSION_ERROR, { error: 'Session request expired or not found' })));
          return;
        }

        const providerDevice = deviceRegistry.getDevice(env.senderId || '');
        const sessionInfo = sessionManager.handleApprovalDecision(decision, providerDevice?.name || 'Provider');

        // Relay decision to Controller
        const controllerWs = this.sessionControllerSockets.get(decision.sessionId) || this.findSocketByDeviceId(pending.controllerDeviceId);
        if (controllerWs && controllerWs.readyState === WebSocket.OPEN) {
          controllerWs.send(JSON.stringify(createEnvelope(
            MESSAGE_TYPES.SESSION_APPROVAL_DECISION,
            { decision, sessionInfo },
            { sessionId: decision.sessionId }
          )));
        }
        this.sessionControllerSockets.delete(decision.sessionId);

        if (sessionInfo) {
          deviceRegistry.updateStatus(sessionInfo.providerId || env.senderId || '', 'Session Active');
          this.broadcastDeviceUpdate();
        }
        break;
      }

      // 6. Terminate Session
      case MESSAGE_TYPES.SESSION_TERMINATE: {
        const { sessionId, reason } = env.payload;
        const session = sessionManager.getSession(sessionId);
        if (session) {
          sessionManager.terminateSession(sessionId, 'Controller', reason);
          const providerWs = deviceRegistry.getDeviceSocket(session.providerId);
          if (providerWs && providerWs.readyState === WebSocket.OPEN) {
            providerWs.send(JSON.stringify(createEnvelope(MESSAGE_TYPES.SESSION_TERMINATED, { sessionId, reason })));
          }
        }
        ws.send(JSON.stringify(createEnvelope(MESSAGE_TYPES.SESSION_TERMINATED, { sessionId })));
        break;
      }

      // 7. WebRTC Signaling pass-through
      case MESSAGE_TYPES.WEBRTC_OFFER:
      case MESSAGE_TYPES.WEBRTC_ANSWER:
      case MESSAGE_TYPES.WEBRTC_ICE: {
        SignalingHandler.handleSignal(env as any, ws);
        break;
      }

      // Heartbeat
      case MESSAGE_TYPES.PING: {
        ws.send(JSON.stringify(createEnvelope(MESSAGE_TYPES.PONG, {})));
        break;
      }

      default: {
        // 1. Check if this is a response to a pending request (matching envelope id)
        if (env.id && this.pendingRequestSockets.has(env.id)) {
          const callerWs = this.pendingRequestSockets.get(env.id);
          this.pendingRequestSockets.delete(env.id);
          if (callerWs && callerWs.readyState === WebSocket.OPEN) {
            callerWs.send(JSON.stringify(env));
            return;
          }
        }

        // 2. Forward to target device if targetId is specified
        if (env.targetId) {
          const targetWs = deviceRegistry.getDeviceSocket(env.targetId) || this.findSocketByDeviceId(env.targetId);
          if (targetWs && targetWs.readyState === WebSocket.OPEN) {
            if (env.id) {
              this.pendingRequestSockets.set(env.id, ws);
            }
            targetWs.send(JSON.stringify(env));
            return;
          }
        }

        // 3. Forward by session if sessionId is present (e.g. terminal streaming, events)
        if (env.sessionId) {
          const session = sessionManager.getSession(env.sessionId);
          const clientRole = this.clientRoles.get(ws);

          if (clientRole?.role === 'provider') {
            const controllerWs = this.sessionControllerSockets.get(env.sessionId)
              || (session ? this.findSocketByDeviceId(session.controllerId) : undefined);
            if (controllerWs && controllerWs.readyState === WebSocket.OPEN) {
              controllerWs.send(JSON.stringify(env));
              return;
            }
          } else {
            if (session) {
              const providerWs = deviceRegistry.getDeviceSocket(session.providerId);
              if (providerWs && providerWs.readyState === WebSocket.OPEN) {
                providerWs.send(JSON.stringify(env));
                return;
              }
            }
          }
        }
        break;
      }
    }
  }

  private findSocketByDeviceId(deviceId: string): WebSocket | undefined {
    // Check registered devices
    const direct = deviceRegistry.getDeviceSocket(deviceId);
    if (direct) return direct;

    // Check controllers
    for (const [ws, info] of this.clientRoles.entries()) {
      if (info.deviceId === deviceId) {
        return ws;
      }
    }
    return undefined;
  }

  private broadcastDeviceUpdate(): void {
    const devices = deviceRegistry.listOnlineDevices();
    const message = JSON.stringify(createEnvelope(MESSAGE_TYPES.DEVICE_LIST, { devices }));
    for (const client of this.wss.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    }
  }
}
