export type SessionState =
  | 'Requested'
  | 'PendingApproval'
  | 'Approved'
  | 'Rejected'
  | 'Starting'
  | 'Active'
  | 'Disconnected'
  | 'Terminated'
  | 'Error';

export interface SessionPermissions {
  fileRead: boolean;
  fileWrite: boolean;
  fileDelete: boolean;
  terminalExecute: boolean;
  debugging: boolean;
  git: boolean;
  clipboardSync: boolean;
}

export const DEFAULT_SESSION_PERMISSIONS: SessionPermissions = {
  fileRead: true,
  fileWrite: true,
  fileDelete: false,
  terminalExecute: true,
  debugging: true,
  git: true,
  clipboardSync: true,
};

export interface SessionApprovalRequest {
  sessionId: string;
  controllerDeviceId: string;
  controllerName: string;
  requestedWorkspace: string;
  requestedPermissions: SessionPermissions;
  timestamp: number;
}

export interface SessionApprovalDecision {
  sessionId: string;
  approved: boolean;
  reason?: string;
  approvedWorkspace?: string;
  grantedPermissions?: SessionPermissions;
  connectionToken?: string;
  webUrl?: string;
  streamUrl?: string;
  inputUrl?: string;
  wsUrl?: string;
  isolationMode: 'DedicatedServerWeb' | 'DedicatedProcess' | 'VirtualDesktop';
}

export interface ActiveSessionInfo {
  sessionId: string;
  providerId: string;
  providerName: string;
  controllerId: string;
  controllerName: string;
  workspacePath: string;
  startTime: number;
  isolationMode: 'DedicatedServerWeb' | 'DedicatedProcess' | 'VirtualDesktop';
  port: number;
  connectionToken: string;
  status: SessionState;
  grantedPermissions: SessionPermissions;
  webUrl?: string;
  streamUrl?: string;
  inputUrl?: string;
}

export interface SessionAuditLog {
  id: string;
  sessionId: string;
  timestamp: number;
  eventType: 'START' | 'STOP' | 'TERMINAL_CMD' | 'FILE_READ' | 'FILE_WRITE' | 'FILE_DELETE' | 'APPROVAL';
  details: string;
  actor: 'Controller' | 'Provider' | 'System';
}
