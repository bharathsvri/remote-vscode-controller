import React, { useState } from 'react';
import { DeviceInfo } from '@remote-vscode/shared';
import { signalingClient } from '../services/signalingClient';
import {
  Server,
  Code,
  CheckCircle,
  XCircle,
  Key,
  RefreshCw,
  FolderOpen,
  ArrowRight,
  ShieldAlert,
  Sliders,
  Clock,
} from 'lucide-react';

interface DashboardProps {
  devices: DeviceInfo[];
  online: boolean;
  onConnect: (device: DeviceInfo, workspace: string) => void;
  onRefresh: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ devices, online, onConnect, onRefresh }) => {
  const [selectedDevice, setSelectedDevice] = useState<DeviceInfo | null>(null);
  const [targetWorkspace, setTargetWorkspace] = useState('');
  const [pairingModalOpen, setPairingModalOpen] = useState(false);
  const [pairingCode, setPairingCode] = useState('');
  const [pairingDeviceId, setPairingDeviceId] = useState('');
  const [pairingError, setPairingError] = useState<string | null>(null);
  const [pairingSuccess, setPairingSuccess] = useState<string | null>(null);

  const handlePairSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pairingCode.trim() || !pairingDeviceId.trim()) return;

    setPairingError(null);
    try {
      const resp = await signalingClient.pairDevice(pairingDeviceId.trim(), pairingCode.trim(), 'controller-local', 'Controller App');
      if (resp.success) {
        setPairingSuccess(`Successfully paired with ${resp.device?.name || 'Device'}!`);
        setTimeout(() => {
          setPairingModalOpen(false);
          setPairingSuccess(null);
          setPairingCode('');
          setPairingDeviceId('');
          onRefresh();
        }, 1200);
      } else {
        setPairingError(resp.error || 'Pairing rejected');
      }
    } catch (err: any) {
      setPairingError(err.message || 'Pairing failed');
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-[#1e1e1e] overflow-y-auto">
      {/* Top Banner / Logo */}
      <div className="bg-[#252526] px-8 py-6 border-b border-[#3c3c3c] flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 bg-blue-600/20 border border-blue-500 rounded-lg flex items-center justify-center text-blue-400">
            <Code className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white flex items-center space-x-2">
              <span>Remote VS Code Controller</span>
              <span className="text-[10px] bg-blue-600/30 text-blue-300 border border-blue-500/40 px-2 py-0.5 rounded font-mono">
                v1.0.0
              </span>
            </h1>
            <p className="text-xs text-gray-400 mt-0.5">
              Secure, isolated application-level remote control for Visual Studio Code
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2 px-3 py-1.5 rounded-full bg-[#181818] border border-[#333] text-xs">
            <span className={`w-2.5 h-2.5 rounded-full ${online ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
            <span className="text-gray-300">{online ? 'Signaling Online' : 'Signaling Offline'}</span>
          </div>

          <button
            onClick={() => setPairingModalOpen(true)}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-[#007acc] hover:bg-[#0062a3] text-white rounded text-xs font-medium shadow"
          >
            <Key className="w-3.5 h-3.5" />
            <span>Pair Device</span>
          </button>

          <button
            onClick={onRefresh}
            title="Refresh Devices"
            className="p-1.5 bg-[#333] hover:bg-[#444] text-gray-300 rounded"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="p-8 max-w-6xl w-full mx-auto space-y-6">
        {/* Device Selection Grid */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400 flex items-center space-x-2">
              <Server className="w-4 h-4 text-blue-400" />
              <span>Registered Provider Systems ({devices.length})</span>
            </h2>
          </div>

          {devices.length === 0 ? (
            <div className="bg-[#252526] border border-[#3c3c3c] rounded-xl p-8 text-center space-y-3">
              <Server className="w-10 h-10 mx-auto text-gray-500" />
              <h3 className="text-base font-medium text-gray-300">No Provider Devices Connected</h3>
              <p className="text-xs text-gray-400 max-w-md mx-auto">
                Install and launch the <strong>Provider Agent</strong> on target Windows machines, or pair a device using its 6-digit code.
              </p>
              <button
                onClick={() => setPairingModalOpen(true)}
                className="mt-2 inline-flex items-center space-x-1.5 px-4 py-2 bg-[#007acc] hover:bg-[#0062a3] text-white text-xs rounded"
              >
                <Key className="w-3.5 h-3.5" />
                <span>Pair With Code</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {devices.map((dev) => {
                const isSelected = selectedDevice?.id === dev.id;
                return (
                  <div
                    key={dev.id}
                    onClick={() => {
                      setSelectedDevice(dev);
                      setTargetWorkspace(dev.allowedWorkspaces[0] || '');
                    }}
                    className={`p-4 rounded-xl border transition-all cursor-pointer relative ${
                      isSelected
                        ? 'bg-[#2a2d2e] border-[#007acc] shadow-lg shadow-blue-900/20'
                        : 'bg-[#252526] border-[#3c3c3c] hover:border-gray-500'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 rounded-lg bg-[#181818] flex items-center justify-center text-blue-400 border border-[#333]">
                          <Server className="w-5 h-5" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-sm text-white">{dev.name}</h3>
                          <span className="text-[11px] text-gray-400 font-mono truncate block max-w-[140px]">
                            {dev.id}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center space-x-1 text-[11px] px-2 py-0.5 rounded-full bg-[#181818] border border-[#333]">
                        {dev.status === 'Online' ? (
                          <>
                            <CheckCircle className="w-3 h-3 text-green-400" />
                            <span className="text-green-400">Online</span>
                          </>
                        ) : dev.status === 'Session Active' ? (
                          <>
                            <span className="w-2 h-2 rounded-full bg-blue-400 animate-ping" />
                            <span className="text-blue-400">Active</span>
                          </>
                        ) : (
                          <>
                            <XCircle className="w-3 h-3 text-gray-500" />
                            <span className="text-gray-400">Offline</span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-[#333] space-y-1.5 text-xs text-gray-400">
                      <div className="flex justify-between">
                        <span>OS:</span>
                        <span className="text-gray-200">{dev.os} {dev.osVersion}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>VS Code:</span>
                        <span className={dev.vscodeInstalled ? 'text-green-400' : 'text-red-400'}>
                          {dev.vscodeInstalled ? `v${dev.vscodeVersion || 'Installed'}` : 'Not Found'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Shells:</span>
                        <span className="text-gray-200">{dev.capabilities.availableShells.join(', ')}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Connection Configuration Panel */}
        {selectedDevice && (
          <div className="bg-[#252526] border border-[#007acc]/40 rounded-xl p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-white flex items-center space-x-2">
                  <span>Connect to {selectedDevice.name}</span>
                </h3>
                <p className="text-xs text-gray-400">
                  Select an authorized workspace. The Provider will be prompted to approve your session.
                </p>
              </div>

              <div className="flex items-center space-x-2 text-xs bg-blue-950/40 text-blue-300 border border-blue-800/60 px-3 py-1.5 rounded-lg">
                <ShieldAlert className="w-4 h-4 text-blue-400" />
                <span>Zero Desktop Interference Enforced</span>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs text-gray-300 font-medium">Target Workspace Path:</label>
              <div className="relative">
                <FolderOpen className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={targetWorkspace}
                  onChange={(e) => setTargetWorkspace(e.target.value)}
                  placeholder="e.g. D:/Work/Repositories/my-project"
                  className="w-full pl-9 pr-3 py-2 text-xs bg-[#181818] border border-[#3c3c3c] rounded text-white font-mono focus:outline-none focus:border-[#007acc]"
                />
              </div>

              {selectedDevice.allowedWorkspaces.length > 0 && (
                <div className="flex items-center space-x-2 text-[11px] text-gray-400 mt-1">
                  <span>Authorized presets:</span>
                  {selectedDevice.allowedWorkspaces.map((w) => (
                    <button
                      key={w}
                      type="button"
                      onClick={() => setTargetWorkspace(w)}
                      className="px-2 py-0.5 bg-[#333] hover:bg-[#444] rounded text-blue-300 underline font-mono"
                    >
                      {w}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                onClick={() => setSelectedDevice(null)}
                className="px-4 py-2 bg-[#333] hover:bg-[#444] text-xs text-gray-300 rounded"
              >
                Cancel
              </button>
              <button
                onClick={() => onConnect(selectedDevice, targetWorkspace)}
                disabled={!selectedDevice.vscodeInstalled}
                className="flex items-center space-x-2 px-5 py-2 bg-[#007acc] hover:bg-[#0062a3] disabled:opacity-40 text-white text-xs font-semibold rounded shadow-lg"
              >
                <span>Request Remote VS Code Session</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Pairing Modal */}
      {pairingModalOpen && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
          <form onSubmit={handlePairSubmit} className="bg-[#252526] border border-[#3c3c3c] rounded-xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center space-x-2 mb-2">
              <Key className="w-5 h-5 text-blue-400" />
              <h3 className="text-base font-bold text-white">Pair New Provider Device</h3>
            </div>
            <p className="text-xs text-gray-400 mb-4">
              Enter the Device ID and 6-digit pairing code displayed on the Provider Agent console.
            </p>

            {pairingError && (
              <div className="mb-4 p-2 bg-red-900/40 border border-red-700/60 text-red-200 text-xs rounded">
                {pairingError}
              </div>
            )}
            {pairingSuccess && (
              <div className="mb-4 p-2 bg-green-900/40 border border-green-700/60 text-green-200 text-xs rounded">
                {pairingSuccess}
              </div>
            )}

            <div className="space-y-3 text-xs mb-6">
              <div>
                <label className="block text-gray-300 mb-1">Target Device ID:</label>
                <input
                  type="text"
                  placeholder="e.g. win-my-workstation-8b3d9"
                  value={pairingDeviceId}
                  onChange={(e) => setPairingDeviceId(e.target.value)}
                  className="w-full px-3 py-2 bg-[#181818] border border-[#3c3c3c] rounded text-white font-mono focus:outline-none focus:border-[#007acc]"
                  required
                />
              </div>

              <div>
                <label className="block text-gray-300 mb-1">6-Digit Pairing Code:</label>
                <input
                  type="text"
                  placeholder="e.g. 7K4PX9"
                  maxLength={6}
                  value={pairingCode}
                  onChange={(e) => setPairingCode(e.target.value.toUpperCase())}
                  className="w-full px-3 py-2 bg-[#181818] border border-[#3c3c3c] rounded text-white font-mono uppercase tracking-widest text-center text-sm font-bold focus:outline-none focus:border-[#007acc]"
                  required
                />
              </div>
            </div>

            <div className="flex justify-end space-x-2 text-xs">
              <button
                type="button"
                onClick={() => setPairingModalOpen(false)}
                className="px-4 py-2 bg-[#333] hover:bg-[#444] text-gray-300 rounded"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-[#007acc] hover:bg-[#0062a3] text-white font-medium rounded"
              >
                Verify & Pair
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
