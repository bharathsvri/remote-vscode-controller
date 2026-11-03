export type ShellType = 'powershell' | 'cmd' | 'bash';

export interface TerminalSessionInfo {
  terminalId: string;
  sessionId: string;
  shell: ShellType;
  title: string;
  createdAt: number;
  cwd: string;
  active: boolean;
}

export interface TerminalCreateRequest {
  terminalId?: string;
  shell?: ShellType;
  cwd?: string;
  cols?: number;
  rows?: number;
}

export interface TerminalInputPayload {
  terminalId: string;
  data: string;
}

export interface TerminalOutputPayload {
  terminalId: string;
  data: string;
}

export interface TerminalResizePayload {
  terminalId: string;
  cols: number;
  rows: number;
}

export interface TerminalClosePayload {
  terminalId: string;
  exitCode?: number;
}
