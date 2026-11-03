import React, { useState, useEffect } from 'react';
import { ActiveSessionInfo, DeviceInfo } from '@remote-vscode/shared';
import { TerminalView } from '../components/TerminalView';
import { FileManager } from '../components/FileManager';
import {
  Code,
  FolderOpen,
  Terminal,
  Activity,
  ShieldCheck,
  RotateCcw,
  Power,
  ChevronRight,
  ChevronLeft,
  Maximize2,
  Tv,
} from 'lucide-react';

interface RemoteWorkspaceProps {
  session: ActiveSessionInfo;
  device: DeviceInfo;
  onDisconnect: () => void;
  onReconnect: () => void;
}

export const RemoteWorkspace: React.FC<RemoteWorkspaceProps> = ({
  session,
  device,
  onDisconnect,
  onReconnect,
}) => {
  // Session duration timer
  const [duration, setDuration] = useState('00:00:00');
  const [quality, setQuality] = useState<'low' | 'medium' | 'high' | 'ultra'>('high');
  const [sidePanelTab, setSidePanelTab] = useState<'files' | 'terminal' | 'diagnostics'>('files');
  const [sidePanelOpen, setSidePanelOpen] = useState(true);

  useEffect(() => {
    const start = session.startTime || Date.now();
    const interval = setInterval(() => {
      const diffSec = Math.floor((Date.now() - start) / 1000);
      const hrs = Math.floor(diffSec / 3600).toString().padStart(2, '0');
      const mins = Math.floor((diffSec % 3600) / 60).toString().padStart(2, '0');
      const secs = (diffSec % 60).toString().padStart(2, '0');
      setDuration(`${hrs}:${mins}:${secs}`);
    }, 1000);

    return () => clearInterval(interval);
  }, [session.startTime]);

  return (
    <div className="flex flex-col h-screen w-screen bg-[#1e1e1e] overflow-hidden select-none">
      {/* Top Toolbar */}
      <div className="h-11 bg-[#252526] border-b border-[#333] px-4 flex items-center justify-between text-xs text-gray-300">
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2 font-semibold text-white">
            <Code className="w-4 h-4 text-blue-400" />
            <span>{device.name}</span>
          </div>

          <span className="text-gray-500">|</span>

          <div className="flex items-center space-x-1.5">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-green-400 font-medium">Session Active (Isolated)</span>
          </div>

          <span className="text-gray-500">|</span>

          <div className="flex items-center space-x-1 font-mono text-gray-400">
            <span>⏱️</span>
            <span>{duration}</span>
          </div>
        </div>

        {/* Center: Quality and Workspace Tag */}
        <div className="hidden md:flex items-center space-x-3">
          <div className="flex items-center space-x-1.5 px-2.5 py-0.5 rounded bg-[#181818] border border-[#333] text-[11px]">
            <FolderOpen className="w-3.5 h-3.5 text-yellow-500" />
            <span className="font-mono text-gray-300 truncate max-w-xs">{session.workspacePath}</span>
          </div>

          <div className="flex items-center space-x-1 text-[11px]">
            <Tv className="w-3.5 h-3.5 text-gray-400" />
            <select
              value={quality}
              onChange={(e) => setQuality(e.target.value as any)}
              className="bg-[#181818] border border-[#3c3c3c] rounded px-1.5 py-0.5 text-gray-200 focus:outline-none"
            >
              <option value="low">Quality: Low (15fps)</option>
              <option value="medium">Quality: Medium (30fps)</option>
              <option value="high">Quality: High (60fps)</option>
              <option value="ultra">Quality: Ultra (HD)</option>
            </select>
          </div>
        </div>

        {/* Right Action Buttons */}
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setSidePanelOpen(!sidePanelOpen)}
            title={sidePanelOpen ? 'Collapse Tools Panel' : 'Expand Tools Panel'}
            className="flex items-center space-x-1 px-2.5 py-1 bg-[#333] hover:bg-[#444] rounded text-gray-200"
          >
            {sidePanelOpen ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">Tools</span>
          </button>

          <button
            onClick={onReconnect}
            title="Reconnect Session"
            className="flex items-center space-x-1 px-2.5 py-1 bg-[#333] hover:bg-[#444] rounded text-gray-200"
          >
            <RotateCcw className="w-3.5 h-3.5 text-blue-400" />
            <span className="hidden sm:inline">Reconnect</span>
          </button>

          <button
            onClick={onDisconnect}
            title="Disconnect & Terminate Session"
            className="flex items-center space-x-1 px-3 py-1 bg-red-600/80 hover:bg-red-600 text-white rounded font-medium shadow"
          >
            <Power className="w-3.5 h-3.5" />
            <span>Disconnect</span>
          </button>
        </div>
      </div>

      {/* Main Workspace Area + Side Tools Panel */}
      <div className="flex-1 flex overflow-hidden">
        {/* Isolated VS Code Workspace Frame */}
        <div className="flex-1 flex flex-col bg-[#181818] relative">
          {session.webUrl ? (
            <iframe
              src={session.webUrl}
              className="w-full h-full border-none"
              title="Remote Isolated VS Code"
              allow="clipboard-read; clipboard-write;"
            />
          ) : (
            <div className="h-full flex flex-col items-center justify-center space-y-4 p-8 text-center">
              <Code className="w-16 h-16 text-blue-500 opacity-60 animate-pulse" />
              <h2 className="text-lg font-bold text-gray-200">Isolated VS Code Workspace Ready</h2>
              <p className="text-xs text-gray-400 max-w-md">
                Dedicated VS Code instance is actively running on {device.name} in complete isolation.
                Provider desktop mouse and keyboard are untouched.
              </p>
            </div>
          )}
        </div>

        {/* Collapsible Side Panel (Files, Terminal, Diagnostics) */}
        {sidePanelOpen && (
          <div className="w-80 md:w-96 flex flex-col bg-[#252526] border-l border-[#333] transition-all">
            {/* Panel Tabs */}
            <div className="flex items-center bg-[#181818] border-b border-[#333] text-xs">
              <button
                onClick={() => setSidePanelTab('files')}
                className={`flex-1 py-2 text-center flex items-center justify-center space-x-1.5 ${
                  sidePanelTab === 'files'
                    ? 'text-white border-b-2 border-blue-500 font-semibold bg-[#252526]'
                    : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                <FolderOpen className="w-3.5 h-3.5 text-yellow-500" />
                <span>Files</span>
              </button>
              <button
                onClick={() => setSidePanelTab('terminal')}
                className={`flex-1 py-2 text-center flex items-center justify-center space-x-1.5 ${
                  sidePanelTab === 'terminal'
                    ? 'text-white border-b-2 border-blue-500 font-semibold bg-[#252526]'
                    : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                <Terminal className="w-3.5 h-3.5 text-blue-400" />
                <span>Terminal</span>
              </button>
              <button
                onClick={() => setSidePanelTab('diagnostics')}
                className={`flex-1 py-2 text-center flex items-center justify-center space-x-1.5 ${
                  sidePanelTab === 'diagnostics'
                    ? 'text-white border-b-2 border-blue-500 font-semibold bg-[#252526]'
                    : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                <Activity className="w-3.5 h-3.5 text-green-400" />
                <span>Info</span>
              </button>
            </div>

            {/* Panel Content */}
            <div className="flex-1 overflow-hidden">
              {sidePanelTab === 'files' && (
                <FileManager sessionId={session.sessionId} targetDeviceId={device.id} />
              )}
              {sidePanelTab === 'terminal' && (
                <TerminalView sessionId={session.sessionId} targetDeviceId={device.id} />
              )}
              {sidePanelTab === 'diagnostics' && (
                <div className="p-4 space-y-4 text-xs overflow-y-auto h-full text-gray-300">
                  <div className="p-3 bg-[#181818] rounded-lg border border-[#333] space-y-2">
                    <h4 className="font-semibold text-white flex items-center space-x-1.5">
                      <ShieldCheck className="w-4 h-4 text-green-400" />
                      <span>Isolation Status: ACTIVE</span>
                    </h4>
                    <p className="text-[11px] text-gray-400 leading-relaxed">
                      This session is operating in <strong>Dedicated Server & Process Isolation</strong> mode.
                      Zero keyboard/mouse events can escape to the Provider's active desktop.
                    </p>
                  </div>

                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between py-1 border-b border-[#333]">
                      <span className="text-gray-500">Session ID:</span>
                      <span className="font-mono text-gray-300 truncate max-w-[150px]">{session.sessionId}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-[#333]">
                      <span className="text-gray-500">Provider Host:</span>
                      <span className="text-gray-300">{device.name}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-[#333]">
                      <span className="text-gray-500">OS Version:</span>
                      <span className="text-gray-300">{device.osVersion}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-[#333]">
                      <span className="text-gray-500">VS Code Core:</span>
                      <span className="text-green-400">v{device.vscodeVersion}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-[#333]">
                      <span className="text-gray-500">Screen Quality:</span>
                      <span className="text-blue-400 uppercase">{quality}</span>
                    </div>
                  </div>

                  <div className="pt-2">
                    <h5 className="font-semibold text-gray-400 mb-2 uppercase text-[10px] tracking-wider">
                      Granted Session Permissions
                    </h5>
                    <div className="space-y-1 text-xs">
                      {Object.entries(session.grantedPermissions || {}).map(([perm, granted]) => (
                        <div key={perm} className="flex items-center justify-between">
                          <span className="capitalize">{perm}</span>
                          <span className={`px-1.5 py-0.5 rounded text-[10px] ${granted ? 'bg-green-900/40 text-green-300' : 'bg-red-900/40 text-red-300'}`}>
                            {granted ? 'Allowed' : 'Denied'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
