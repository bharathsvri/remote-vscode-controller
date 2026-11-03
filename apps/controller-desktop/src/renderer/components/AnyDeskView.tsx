import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  Monitor,
  Maximize2,
  Minimize2,
  RefreshCw,
  Sparkles,
  Command,
  Sliders,
  Keyboard,
  MousePointer,
} from 'lucide-react';

interface AnyDeskViewProps {
  streamUrl: string;
  inputUrl: string;
}

export const AnyDeskView: React.FC<AnyDeskViewProps> = ({ streamUrl, inputUrl }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [streamError, setStreamError] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const lastMoveSent = useRef<number>(0);

  const sendInput = useCallback(async (payload: any) => {
    if (!inputUrl) return;
    try {
      await fetch(inputUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        mode: 'cors',
      });
    } catch (err) {
      // Ignore transient network frame drops
    }
  }, [inputUrl]);

  const handleMouseMove = (e: React.MouseEvent<HTMLImageElement>) => {
    if (!imgRef.current) return;
    const now = Date.now();
    if (now - lastMoveSent.current < 25) return; // 40 Hz mouse move limit
    lastMoveSent.current = now;

    const rect = imgRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));

    sendInput({ type: 'mouse', action: 'move', x, y });
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLImageElement>) => {
    e.preventDefault();
    if (!imgRef.current) return;
    containerRef.current?.focus();

    const rect = imgRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));

    sendInput({ type: 'mouse', action: 'down', button: e.button, x, y });
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLImageElement>) => {
    e.preventDefault();
    if (!imgRef.current) return;

    const rect = imgRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));

    sendInput({ type: 'mouse', action: 'up', button: e.button, x, y });
  };

  const handleWheel = (e: React.WheelEvent<HTMLImageElement>) => {
    e.preventDefault();
    sendInput({
      type: 'mouse',
      action: 'wheel',
      delta: e.deltaY > 0 ? -120 : 120,
    });
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Prevent browser capturing functional keys like Tab, F5, Backspace
    if (['Tab', 'F5', 'Alt', 'Control'].includes(e.key)) {
      e.preventDefault();
    }
    sendInput({
      type: 'keyboard',
      action: 'down',
      keyCode: e.keyCode,
      key: e.key,
    });
  };

  const handleKeyUp = (e: React.KeyboardEvent) => {
    sendInput({
      type: 'keyboard',
      action: 'up',
      keyCode: e.keyCode,
      key: e.key,
    });
  };

  const sendShortcut = (keyCodes: number[]) => {
    containerRef.current?.focus();
    keyCodes.forEach(code => sendInput({ type: 'keyboard', action: 'down', keyCode: code }));
    setTimeout(() => {
      keyCodes.forEach(code => sendInput({ type: 'keyboard', action: 'up', keyCode: code }));
    }, 50);
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onKeyUp={handleKeyUp}
      className="flex-1 flex flex-col bg-[#0f0f10] relative select-none outline-none overflow-hidden"
    >
      {/* Top Remote Control Bar */}
      <div className="h-9 bg-[#1a1a1c] border-b border-[#2d2d30] px-3 flex items-center justify-between text-xs text-gray-300 z-10">
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-1.5 font-medium text-emerald-400">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-semibold text-white">AnyDesk Live Screen</span>
          </div>

          <span className="text-gray-600">|</span>

          {/* Quick Remote Shortcut Triggers */}
          <div className="hidden lg:flex items-center space-x-1.5 text-[11px]">
            <button
              onClick={() => sendShortcut([17, 80])} // Ctrl + P
              title="Quick Open (Ctrl+P)"
              className="px-2 py-0.5 rounded bg-[#252528] hover:bg-[#333] border border-[#3e3e42] text-gray-300"
            >
              Ctrl+P
            </button>
            <button
              onClick={() => sendShortcut([17, 192])} // Ctrl + `
              title="Toggle Terminal (Ctrl+`)"
              className="px-2 py-0.5 rounded bg-[#252528] hover:bg-[#333] border border-[#3e3e42] text-gray-300"
            >
              Terminal
            </button>
            <button
              onClick={() => sendShortcut([17, 16, 73])} // Ctrl + Shift + I (Copilot)
              title="Open Copilot Chat (Ctrl+Shift+I)"
              className="flex items-center space-x-1 px-2 py-0.5 rounded bg-blue-900/40 hover:bg-blue-900/60 border border-blue-500/40 text-blue-300 font-medium"
            >
              <Sparkles className="w-3 h-3 text-blue-400" />
              <span>Copilot Chat</span>
            </button>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => setRefreshKey(k => k + 1)}
            title="Refresh Stream"
            className="p-1 rounded bg-[#252528] hover:bg-[#333] text-gray-300"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={toggleFullscreen}
            title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
            className="p-1 rounded bg-[#252528] hover:bg-[#333] text-gray-300"
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Main Stream Canvas Area */}
      <div className="flex-1 flex items-center justify-center relative overflow-hidden bg-black">
        {streamError ? (
          <div className="flex flex-col items-center justify-center p-8 space-y-3 text-center">
            <Monitor className="w-12 h-12 text-red-400 animate-pulse" />
            <h3 className="text-sm font-semibold text-gray-200">Screen Stream Connecting...</h3>
            <p className="text-xs text-gray-400 max-w-sm">
              Waiting for the remote workstation screen capture stream to start.
            </p>
            <button
              onClick={() => setStreamError(false)}
              className="flex items-center space-x-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry Connection</span>
            </button>
          </div>
        ) : (
          <img
            ref={imgRef}
            src={streamUrl ? `${streamUrl}${streamUrl.includes('?') ? '&' : '?'}t=${refreshKey}` : ''}
            alt="Remote AnyDesk Desktop Screen"
            onLoad={() => {
              setIsConnected(true);
              setStreamError(false);
            }}
            onError={() => {
              setIsConnected(false);
              setStreamError(true);
            }}
            onMouseMove={handleMouseMove}
            onMouseDown={handleMouseDown}
            onMouseUp={handleMouseUp}
            onWheel={handleWheel}
            onContextMenu={handleContextMenu}
            className="w-full h-full object-contain cursor-crosshair select-none"
            style={{ imageRendering: 'high-quality' }}
          />
        )}
      </div>

      {/* Bottom Hint Banner */}
      <div className="h-6 bg-[#121214] border-t border-[#252528] px-3 flex items-center justify-between text-[11px] text-gray-400 font-mono">
        <div className="flex items-center space-x-2">
          <MousePointer className="w-3 h-3 text-emerald-400" />
          <span>Click anywhere to control mouse & keyboard</span>
        </div>
        <div className="flex items-center space-x-2">
          <span>Target: Native Desktop (Host VS Code Active)</span>
        </div>
      </div>
    </div>
  );
};
