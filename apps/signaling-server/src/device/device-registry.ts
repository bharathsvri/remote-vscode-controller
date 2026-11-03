import { DeviceInfo, DeviceRegistrationRequest, DeviceStatus } from '@remote-vscode/shared';
import { WebSocket } from 'ws';

export interface RegisteredDeviceEntry {
  device: DeviceInfo;
  pairingCode: string;
  ws?: WebSocket;
  registeredAt: number;
}

export class DeviceRegistry {
  private devices = new Map<string, RegisteredDeviceEntry>();
  private codeToDeviceId = new Map<string, string>();

  public register(req: DeviceRegistrationRequest, ws?: WebSocket): { device: DeviceInfo; pairingCode: string } {
    let pairingCode = req.pairingCode;
    if (!pairingCode) {
      pairingCode = this.generatePairingCode();
    }

    const device: DeviceInfo = {
      id: req.id,
      name: req.name,
      os: req.os,
      osVersion: req.osVersion,
      vscodeInstalled: req.vscodeInstalled,
      vscodeVersion: req.vscodeVersion,
      status: 'Online',
      lastSeen: Date.now(),
      allowedWorkspaces: req.allowedWorkspaces || [],
      capabilities: req.capabilities,
      localAddress: req.localAddress,
      port: req.port,
    };

    this.devices.set(req.id, {
      device,
      pairingCode,
      ws,
      registeredAt: Date.now(),
    });

    this.codeToDeviceId.set(pairingCode.toUpperCase(), req.id);
    return { device, pairingCode };
  }

  public updateStatus(deviceId: string, status: DeviceStatus): void {
    const entry = this.devices.get(deviceId);
    if (entry) {
      entry.device.status = status;
      entry.device.lastSeen = Date.now();
    }
  }

  public attachSocket(deviceId: string, ws: WebSocket): void {
    const entry = this.devices.get(deviceId);
    if (entry) {
      entry.ws = ws;
      entry.device.status = 'Online';
      entry.device.lastSeen = Date.now();
    }
  }

  public detachSocket(deviceId: string): void {
    const entry = this.devices.get(deviceId);
    if (entry) {
      entry.ws = undefined;
      entry.device.status = 'Offline';
      entry.device.lastSeen = Date.now();
    }
  }

  public getDevice(deviceId: string): DeviceInfo | undefined {
    return this.devices.get(deviceId)?.device;
  }

  public getDeviceSocket(deviceId: string): WebSocket | undefined {
    return this.devices.get(deviceId)?.ws;
  }

  public findByPairingCode(code: string): DeviceInfo | undefined {
    const deviceId = this.codeToDeviceId.get(code.toUpperCase());
    if (!deviceId) return undefined;
    return this.devices.get(deviceId)?.device;
  }

  public verifyPairing(deviceId: string, code: string): boolean {
    const entry = this.devices.get(deviceId);
    if (!entry) return false;
    return entry.pairingCode.toUpperCase() === code.toUpperCase();
  }

  public listOnlineDevices(): DeviceInfo[] {
    const list: DeviceInfo[] = [];
    for (const entry of this.devices.values()) {
      list.push(entry.device);
    }
    return list;
  }

  private generatePairingCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }
}

export const deviceRegistry = new DeviceRegistry();
