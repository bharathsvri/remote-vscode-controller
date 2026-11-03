import { ChildProcess, spawn } from 'child_process';
import { v4 as uuidv4 } from 'uuid';
import { ShellType, TerminalSessionInfo } from '@remote-vscode/shared';

export interface ActiveTerminal {
  id: string;
  sessionId: string;
  shell: ShellType;
  process: ChildProcess;
  cwd: string;
  createdAt: number;
}

export class TerminalManager {
  private terminals = new Map<string, ActiveTerminal>();

  public createTerminal(
    sessionId: string,
    workspacePath: string,
    shell: ShellType = 'powershell',
    onData: (data: string) => void,
    onExit: (code: number | null) => void
  ): TerminalSessionInfo {
    const terminalId = uuidv4();
    let shellExecutable = 'powershell.exe';
    let shellArgs: string[] = ['-NoLogo'];

    if (shell === 'cmd') {
      shellExecutable = 'cmd.exe';
      shellArgs = [];
    } else if (shell === 'bash') {
      // Find Git Bash
      shellExecutable = 'bash.exe';
      shellArgs = ['--login', '-i'];
    }

    const child = spawn(shellExecutable, shellArgs, {
      cwd: workspacePath,
      windowsHide: true,
      env: {
        ...process.env,
        TERM: 'xterm-256color',
        COLORTERM: 'truecolor',
      },
    });

    child.stdout?.on('data', (data) => {
      onData(data.toString());
    });

    child.stderr?.on('data', (data) => {
      onData(data.toString());
    });

    child.on('exit', (code) => {
      this.terminals.delete(terminalId);
      onExit(code);
    });

    const terminalEntry: ActiveTerminal = {
      id: terminalId,
      sessionId,
      shell,
      process: child,
      cwd: workspacePath,
      createdAt: Date.now(),
    };

    this.terminals.set(terminalId, terminalEntry);

    return {
      terminalId,
      sessionId,
      shell,
      title: `${shell} (${terminalId.substring(0, 6)})`,
      createdAt: terminalEntry.createdAt,
      cwd: workspacePath,
      active: true,
    };
  }

  public writeInput(terminalId: string, input: string): boolean {
    const terminal = this.terminals.get(terminalId);
    if (!terminal || !terminal.process.stdin || terminal.process.stdin.destroyed) {
      return false;
    }

    terminal.process.stdin.write(input);
    return true;
  }

  public closeTerminal(terminalId: string): void {
    const terminal = this.terminals.get(terminalId);
    if (!terminal) return;

    try {
      if (process.platform === 'win32' && terminal.process.pid) {
        spawn('taskkill', ['/pid', terminal.process.pid.toString(), '/T', '/F']);
      } else {
        terminal.process.kill('SIGTERM');
      }
    } catch (err) {
      console.warn(`[TerminalManager] Error closing terminal ${terminalId}:`, err);
    }

    this.terminals.delete(terminalId);
  }

  public closeAllForSession(sessionId: string): void {
    for (const [id, terminal] of this.terminals.entries()) {
      if (terminal.sessionId === sessionId) {
        this.closeTerminal(id);
      }
    }
  }
}

export const terminalManager = new TerminalManager();
