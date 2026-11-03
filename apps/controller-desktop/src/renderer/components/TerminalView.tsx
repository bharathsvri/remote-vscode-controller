import React, { useEffect, useRef, useState } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import 'xterm/css/xterm.css';
import { TerminalSessionInfo, ShellType } from '@remote-vscode/shared';
import { signalingClient } from '../services/signalingClient';
import { Plus, X, Terminal as TerminalIcon } from 'lucide-react';

interface TerminalViewProps {
  sessionId: string;
  targetDeviceId: string;
}

export const TerminalView: React.FC<TerminalViewProps> = ({ sessionId, targetDeviceId }) => {
  const [terminals, setTerminals] = useState<TerminalSessionInfo[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const terminalRefs = useRef<Map<string, { term: Terminal; fitAddon: FitAddon }>>(new Map());
  const containerRef = useRef<HTMLDivElement>(null);

  // Listen for terminal events from WebSocket
  useEffect(() => {
    const unsubscribe = signalingClient.subscribe((env) => {
      if (env.type === 'terminal:created' && env.sessionId === sessionId) {
        const info = env.payload as TerminalSessionInfo;
        setTerminals((prev) => [...prev, info]);
        setActiveTabId(info.terminalId);
      } else if (env.type === 'terminal:output' && env.sessionId === sessionId) {
        const { terminalId, data } = env.payload;
        const entry = terminalRefs.current.get(terminalId);
        if (entry) {
          entry.term.write(data);
        }
      } else if (env.type === 'terminal:close' && env.sessionId === sessionId) {
        const { terminalId } = env.payload;
        setTerminals((prev) => prev.filter((t) => t.terminalId !== terminalId));
        terminalRefs.current.delete(terminalId);
      }
    });

    return () => unsubscribe();
  }, [sessionId]);

  // Mount active terminal in container
  useEffect(() => {
    if (!activeTabId || !containerRef.current) return;

    let entry = terminalRefs.current.get(activeTabId);
    if (!entry) {
      const term = new Terminal({
        theme: {
          background: '#181818',
          foreground: '#cccccc',
          cursor: '#007acc',
          selectionBackground: '#264f78',
        },
        fontSize: 13,
        fontFamily: 'Consolas, "Courier New", monospace',
        cursorBlink: true,
      });

      const fitAddon = new FitAddon();
      term.loadAddon(fitAddon);

      entry = { term, fitAddon };
      terminalRefs.current.set(activeTabId, entry);

      term.onData((data) => {
        signalingClient.sendTerminalInput(sessionId, targetDeviceId, activeTabId, data);
      });
    }

    containerRef.current.innerHTML = '';
    entry.term.open(containerRef.current);
    entry.fitAddon.fit();

    const handleResize = () => entry?.fitAddon.fit();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [activeTabId, sessionId, targetDeviceId]);

  const handleCreateTerminal = (shell: ShellType = 'powershell') => {
    signalingClient.createTerminal(sessionId, targetDeviceId, shell);
  };

  const handleCloseTerminal = (terminalId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    signalingClient.closeTerminal(sessionId, targetDeviceId, terminalId);
    setTerminals((prev) => prev.filter((t) => t.terminalId !== terminalId));
    if (activeTabId === terminalId) {
      const remaining = terminals.filter((t) => t.terminalId !== terminalId);
      setActiveTabId(remaining.length > 0 ? remaining[remaining.length - 1].terminalId : null);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#181818] border-t border-[#2d2d2d]">
      {/* Terminal tabs */}
      <div className="flex items-center justify-between bg-[#252526] px-2 py-1 border-b border-[#2d2d2d] text-xs">
        <div className="flex items-center space-x-1 overflow-x-auto">
          {terminals.map((t) => (
            <div
              key={t.terminalId}
              onClick={() => setActiveTabId(t.terminalId)}
              className={`flex items-center space-x-1.5 px-3 py-1 cursor-pointer rounded-t ${
                activeTabId === t.terminalId
                  ? 'bg-[#181818] text-white border-t-2 border-[#007acc]'
                  : 'text-gray-400 hover:bg-[#2a2d2e] hover:text-gray-200'
              }`}
            >
              <TerminalIcon className="w-3.5 h-3.5 text-blue-400" />
              <span className="font-mono">{t.shell}</span>
              <button
                onClick={(e) => handleCloseTerminal(t.terminalId, e)}
                className="hover:text-red-400 p-0.5 rounded"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}

          {terminals.length === 0 && (
            <span className="text-gray-400 italic px-2">No active terminals</span>
          )}
        </div>

        {/* New Terminal actions */}
        <div className="flex items-center space-x-1">
          <button
            onClick={() => handleCreateTerminal('powershell')}
            title="New PowerShell"
            className="flex items-center space-x-1 px-2 py-0.5 bg-[#333333] hover:bg-[#444444] text-gray-200 rounded text-[11px]"
          >
            <Plus className="w-3 h-3" />
            <span>PowerShell</span>
          </button>
          <button
            onClick={() => handleCreateTerminal('cmd')}
            title="New Command Prompt"
            className="flex items-center space-x-1 px-2 py-0.5 bg-[#333333] hover:bg-[#444444] text-gray-200 rounded text-[11px]"
          >
            <Plus className="w-3 h-3" />
            <span>CMD</span>
          </button>
          <button
            onClick={() => handleCreateTerminal('bash')}
            title="New Git Bash"
            className="flex items-center space-x-1 px-2 py-0.5 bg-[#333333] hover:bg-[#444444] text-gray-200 rounded text-[11px]"
          >
            <Plus className="w-3 h-3" />
            <span>Bash</span>
          </button>
        </div>
      </div>

      {/* Terminal emulator container */}
      <div className="flex-1 p-2 overflow-hidden relative">
        {terminals.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-gray-500 space-y-2">
            <TerminalIcon className="w-8 h-8 opacity-40" />
            <p className="text-sm">Launch a dedicated terminal inside the isolated workspace session</p>
            <button
              onClick={() => handleCreateTerminal('powershell')}
              className="px-3 py-1 bg-[#007acc] hover:bg-[#0062a3] text-white text-xs rounded"
            >
              Start PowerShell
            </button>
          </div>
        ) : (
          <div ref={containerRef} className="h-full w-full" />
        )}
      </div>
    </div>
  );
};
