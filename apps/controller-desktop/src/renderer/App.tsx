import React, { useState, useEffect } from 'react';
import { ActiveSessionInfo, DeviceInfo, SessionApprovalDecision } from '@remote-vscode/shared';
import { signalingClient } from './services/signalingClient';
import { Dashboard } from './pages/Dashboard';
import { RemoteWorkspace } from './pages/RemoteWorkspace';
import { Loader2, AlertCircle } from 'lucide-react';

export const App: React.FC = () => {
  const [online, setOnline] = useState<boolean>(false);
  const [devices, setDevices] = useState<DeviceInfo[]>([]);
  const [activeSession, setActiveSession] = useState<ActiveSessionInfo | null>(null);
  const [activeDevice, setActiveDevice] = useState<DeviceInfo | null>(null);

  // Pending approval modal
  const [isPendingApproval, setIsPendingApproval] = useState<boolean>(false);
  const [approvalMessage, setApprovalMessage] = useState<string>('');
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  useEffect(() => {
    // Get custom signaling URL from Electron main process if available
    window.electronAPI?.getSignalingUrl?.().then((url) => {
      // Connect signaling client
      signalingClient.connect();
    }).catch(() => {
      signalingClient.connect();
    });

    signalingClient.setStatusCallback((status) => {
      setOnline(status);
    });

    const unsubscribe = signalingClient.subscribe((env) => {
      switch (env.type) {
        case 'device:list': {
          setDevices(env.payload.devices || []);
          break;
        }

        case 'session:approval:pending': {
          setIsPendingApproval(true);
          setApprovalMessage(env.payload.status || 'Waiting for Provider approval on target workstation...');
          break;
        }

        case 'session:approval:decision': {
          setIsPendingApproval(false);
          const { decision, sessionInfo } = env.payload as {
            decision: SessionApprovalDecision;
            sessionInfo: ActiveSessionInfo;
          };

          if (decision.approved && sessionInfo) {
            setActiveSession(sessionInfo);
          } else {
            setErrorBanner(`Connection rejected by Provider: ${decision.reason || 'Permission denied'}`);
          }
          break;
        }

        case 'session:terminated': {
          setActiveSession(null);
          setActiveDevice(null);
          setIsPendingApproval(false);
          break;
        }

        case 'session:error': {
          setIsPendingApproval(false);
          setErrorBanner(env.payload.error || 'Session failed');
          break;
        }
      }
    });

    return () => unsubscribe();
  }, []);

  const handleConnect = (device: DeviceInfo, workspace: string) => {
    setErrorBanner(null);
    setActiveDevice(device);
    signalingClient.requestSession(device.id, 'controller-local', 'Controller App', workspace);
  };

  const handleDisconnect = () => {
    if (activeSession && activeDevice) {
      signalingClient.terminateSession(activeSession.sessionId, activeDevice.id);
    }
    setActiveSession(null);
    setActiveDevice(null);
  };

  const handleReconnect = () => {
    if (activeDevice && activeSession) {
      const workspace = activeSession.workspacePath;
      handleDisconnect();
      setTimeout(() => {
        handleConnect(activeDevice, workspace);
      }, 500);
    }
  };

  return (
    <div className="h-screen w-screen bg-[#1e1e1e] text-gray-200 flex flex-col font-sans">
      {/* Top Error Alert Banner */}
      {errorBanner && (
        <div className="bg-red-900/80 border-b border-red-700 px-4 py-2 text-xs text-red-200 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-red-400" />
            <span>{errorBanner}</span>
          </div>
          <button onClick={() => setErrorBanner(null)} className="font-bold text-sm">×</button>
        </div>
      )}

      {/* Main View Router */}
      {activeSession && activeDevice ? (
        <RemoteWorkspace
          session={activeSession}
          device={activeDevice}
          onDisconnect={handleDisconnect}
          onReconnect={handleReconnect}
        />
      ) : (
        <Dashboard
          devices={devices}
          online={online}
          onConnect={handleConnect}
          onRefresh={() => signalingClient.requestDeviceList()}
        />
      )}

      {/* Waiting for Provider Approval Overlay */}
      {isPendingApproval && (
        <div className="fixed inset-0 bg-black/75 flex items-center justify-center p-4 z-50">
          <div className="bg-[#252526] border border-[#007acc] rounded-xl p-8 max-w-md w-full text-center space-y-4 shadow-2xl">
            <Loader2 className="w-12 h-12 text-[#007acc] animate-spin mx-auto" />
            <h3 className="text-base font-bold text-white">Authorization Pending</h3>
            <p className="text-xs text-gray-300 leading-relaxed">
              {approvalMessage}
            </p>
            <p className="text-[11px] text-gray-500">
              The Provider workstation must explicitly authorize this session before access is granted.
            </p>
            <button
              onClick={() => setIsPendingApproval(false)}
              className="mt-4 px-4 py-1.5 bg-[#333] hover:bg-[#444] text-xs text-gray-300 rounded"
            >
              Cancel Request
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
