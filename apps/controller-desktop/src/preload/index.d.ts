export interface IElectronAPI {
  getAppVersion: () => Promise<string>;
  getPlatform: () => string;
  openExternal: (url: string) => Promise<void>;
  getSignalingUrl: () => Promise<string>;
  onWindowMaximizeChange: (callback: (isMaximized: boolean) => void) => () => void;
  minimizeWindow: () => void;
  maximizeWindow: () => void;
  closeWindow: () => void;
}

declare global {
  interface Window {
    electronAPI: IElectronAPI;
  }
}
