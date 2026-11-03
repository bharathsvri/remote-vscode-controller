export const DEFAULT_PORTS = {
  SIGNALING_SERVER: 4000,
  PROVIDER_AGENT: 4001,
  ISOLATED_VSCODE_BASE: 14000,
} as const;

export const MESSAGE_TYPES = {
  // Device Lifecycle
  DEVICE_REGISTER: 'device:register',
  DEVICE_REGISTERED: 'device:registered',
  DEVICE_UNREGISTER: 'device:unregister',
  DEVICE_LIST: 'device:list',
  DEVICE_UPDATE: 'device:update',
  DEVICE_PAIR_REQUEST: 'device:pair:request',
  DEVICE_PAIR_RESPONSE: 'device:pair:response',

  // Session Management
  SESSION_REQUEST: 'session:request',
  SESSION_APPROVAL_PENDING: 'session:approval:pending',
  SESSION_APPROVAL_DECISION: 'session:approval:decision',
  SESSION_STARTED: 'session:started',
  SESSION_TERMINATE: 'session:terminate',
  SESSION_TERMINATED: 'session:terminated',
  SESSION_ERROR: 'session:error',

  // WebRTC Signaling
  WEBRTC_OFFER: 'webrtc:offer',
  WEBRTC_ANSWER: 'webrtc:answer',
  WEBRTC_ICE: 'webrtc:ice',

  // Input Forwarding
  INPUT_MOUSE: 'input:mouse',
  INPUT_KEYBOARD: 'input:keyboard',
  INPUT_CLIPBOARD: 'input:clipboard',

  // Remote Terminal
  TERMINAL_CREATE: 'terminal:create',
  TERMINAL_CREATED: 'terminal:created',
  TERMINAL_INPUT: 'terminal:input',
  TERMINAL_OUTPUT: 'terminal:output',
  TERMINAL_RESIZE: 'terminal:resize',
  TERMINAL_CLOSE: 'terminal:close',

  // File System
  FS_LIST: 'fs:list',
  FS_READ: 'fs:read',
  FS_WRITE: 'fs:write',
  FS_CREATE: 'fs:create',
  FS_DELETE: 'fs:delete',
  FS_RENAME: 'fs:rename',
  FS_SEARCH: 'fs:search',

  // Heartbeat
  PING: 'ping',
  PONG: 'pong',
} as const;

export const ERROR_CODES = {
  UNAUTHORIZED: 'AUTH_001',
  DEVICE_NOT_FOUND: 'DEV_001',
  DEVICE_OFFLINE: 'DEV_002',
  PAIRING_REJECTED: 'DEV_003',
  VSCODE_NOT_FOUND: 'VSC_001',
  VSCODE_SPAWN_FAILED: 'VSC_002',
  SESSION_REJECTED: 'SES_001',
  SESSION_NOT_FOUND: 'SES_002',
  SESSION_ACTIVE: 'SES_003',
  PATH_TRAVERSAL_DETECTED: 'SEC_001',
  PERMISSION_DENIED: 'SEC_002',
} as const;
