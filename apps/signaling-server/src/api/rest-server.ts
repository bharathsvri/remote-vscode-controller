import express from 'express';
import cors from 'cors';
import { deviceRegistry } from '../device/device-registry';
import { sessionManager } from '../session/session-manager';
import { AuthService } from '../authentication/auth-service';

export function createExpressApp() {
  const app = express();
  app.use(cors());
  app.use(express.json());

  // Health check
  app.get('/health', (req, res) => {
    res.json({
      status: 'ok',
      service: 'Remote VS Code Controller Signaling Server',
      timestamp: Date.now(),
    });
  });

  // Get active online devices
  app.get('/api/devices', (req, res) => {
    const devices = deviceRegistry.listOnlineDevices();
    res.json({ success: true, devices });
  });

  // Pair device by code
  app.post('/api/devices/pair', (req, res) => {
    const { deviceId, pairingCode, controllerId } = req.body;
    if (!deviceId || !pairingCode) {
      return res.status(400).json({ success: false, error: 'Device ID and pairing code are required' });
    }

    const valid = deviceRegistry.verifyPairing(deviceId, pairingCode);
    if (!valid) {
      return res.status(403).json({ success: false, error: 'Invalid pairing code' });
    }

    const device = deviceRegistry.getDevice(deviceId);
    const authToken = AuthService.generateSessionToken(controllerId || 'controller', deviceId, 'paired');
    res.json({ success: true, device, authToken });
  });

  // Get audit logs
  app.get('/api/sessions/:sessionId/audit', (req, res) => {
    const logs = sessionManager.getAuditLogs(req.params.sessionId);
    res.json({ success: true, logs });
  });

  return app;
}
