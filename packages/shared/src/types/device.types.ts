export type DeviceStatus =
  | 'Online'
  | 'Offline'
  | 'Connecting'
  | 'Connected'
  | 'Session Active'
  | 'Session Disconnected';

export interface DeviceCapabilities {
  supportsWebRTC: boolean;
  supportsIsolatedVSCode: boolean;
  supportsTerminal: boolean;
  supportsFileSystem: boolean;
  availableShells: ('powershell' | 'cmd' | 'bash')[];
}

export interface DeviceInfo {
  id: string;
  name: string;
  os: 'Windows' | 'Linux' | 'macOS';
  osVersion: string;
  vscodeInstalled: boolean;
  vscodeVersion?: string;
  status: DeviceStatus;
  ipAddress?: string;
  localAddress?: string;
  port?: number;
  lastSeen: number;
  allowedWorkspaces: string[];
  capabilities: DeviceCapabilities;
}

export interface DeviceRegistrationRequest {
  id: string;
  name: string;
  os: 'Windows' | 'Linux' | 'macOS';
  osVersion: string;
  vscodeInstalled: boolean;
  vscodeVersion?: string;
  pairingCode?: string;
  allowedWorkspaces: string[];
  capabilities: DeviceCapabilities;
  localAddress?: string;
  port?: number;
}

export interface DevicePairingRequest {
  targetDeviceId: string;
  pairingCode: string;
  controllerName: string;
  controllerId: string;
}

export interface DevicePairingResponse {
  success: boolean;
  device?: DeviceInfo;
  authToken?: string;
  error?: string;
}
