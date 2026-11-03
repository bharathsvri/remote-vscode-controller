import { contextBridge, ipcRenderer, shell } from 'electron';
import { IElectronAPI } from './index.d';

const electronAPI: IElectronAPI = {
  getAppVersion: () => ipcRenderer.invoke('app:version'),
  getPlatform: () => process.platform,
  openExternal: (url: string) => shell.openExternal(url),
  getSignalingUrl: () => ipcRenderer.invoke('config:signaling-url'),
  onWindowMaximizeChange: (callback: (isMaximized: boolean) => void) => {
    const handler = (_event: any, isMaximized: boolean) => callback(isMaximized);
    ipcRenderer.on('window:maximize-change', handler);
    return () => ipcRenderer.removeListener('window:maximize-change', handler);
  },
  minimizeWindow: () => ipcRenderer.send('window:minimize'),
  maximizeWindow: () => ipcRenderer.send('window:maximize'),
  closeWindow: () => ipcRenderer.send('window:close'),
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);
