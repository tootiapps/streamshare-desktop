import { contextBridge, ipcRenderer } from 'electron';
import type { RemotePlaybackState, RemoteRequest } from '@streamshare/remote-protocol';
import type { LanguagePreference } from './i18n.js';
import type { CompatibilityPlaybackRequest, CompatibilitySubtitleRequest, VideoTranscodeResolution } from './media-fallback.js';
import type { DolbyVisionMode } from './settings-store.js';

contextBridge.exposeInMainWorld('streamshare', {
  getSettings: () => ipcRenderer.invoke('settings:get'),
  updateSettings: (settings: { enabled?: boolean; deviceName?: string; language?: LanguagePreference; ffmpegEnabled?: boolean; ffmpegDirectory?: string; dolbyVisionMode?: DolbyVisionMode; videoTranscodeResolution?: VideoTranscodeResolution }) => ipcRenderer.invoke('settings:update', settings),
  chooseFfmpeg: () => ipcRenderer.invoke('ffmpeg:choose'),
  openDiagnosticLogs: () => ipcRenderer.invoke('diagnostics:open-logs'),
  logDiagnostic: (entry: { level: 'debug' | 'info' | 'warn' | 'error'; event: string; details?: unknown }) =>
    ipcRenderer.send('diagnostics:log', entry),
  revokeController: (controllerId: string) => ipcRenderer.invoke('settings:revoke', controllerId),
  getWindowState: () => ipcRenderer.invoke('window:get-state'),
  toggleFullscreen: () => ipcRenderer.invoke('window:toggle-fullscreen'),
  setFullscreen: (fullscreen: boolean) => ipcRenderer.invoke('window:set-fullscreen', fullscreen),
  probeMedia: (media: CompatibilityPlaybackRequest['media']) => ipcRenderer.invoke('media:probe', media),
  startCompatibilityPlayback: (request: CompatibilityPlaybackRequest) => ipcRenderer.invoke('media:start-compatibility', request),
  startCompatibilitySubtitle: (request: CompatibilitySubtitleRequest) => ipcRenderer.invoke('media:start-subtitle', request),
  getCompatibilityDiagnostics: () => ipcRenderer.invoke('media:compatibility-diagnostics'),
  stopCompatibilityPlayback: () => ipcRenderer.invoke('media:stop-compatibility'),
  completeCommand: (requestId: string, state?: RemotePlaybackState, error?: string) =>
    ipcRenderer.send('player:command-result', { requestId, state, error }),
  reportState: (state: RemotePlaybackState) => ipcRenderer.send('player:state', state),
  onCommand: (listener: (request: RemoteRequest) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, request: RemoteRequest) => listener(request);
    ipcRenderer.on('player:command', handler);
    return () => ipcRenderer.off('player:command', handler);
  },
  onPairingCode: (listener: (pairing: { code: string; controllerName: string; expiresAt: number } | null) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, pairing: { code: string; controllerName: string; expiresAt: number } | null) => listener(pairing);
    ipcRenderer.on('pairing:code', handler);
    return () => ipcRenderer.off('pairing:code', handler);
  },
  onSettingsChanged: (listener: (settings: unknown) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, settings: unknown) => listener(settings);
    ipcRenderer.on('settings:changed', handler);
    return () => ipcRenderer.off('settings:changed', handler);
  },
  onWindowStateChanged: (listener: (state: { fullscreen: boolean }) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, state: { fullscreen: boolean }) => listener(state);
    ipcRenderer.on('window:state-changed', handler);
    return () => ipcRenderer.off('window:state-changed', handler);
  },
  onOpenNetworkStream: (listener: () => void) => {
    const handler = () => listener();
    ipcRenderer.on('network-stream:open', handler);
    return () => ipcRenderer.off('network-stream:open', handler);
  },
  onToggleTechnicalInformation: (listener: () => void) => {
    const handler = () => listener();
    ipcRenderer.on('technical-information:toggle', handler);
    return () => ipcRenderer.off('technical-information:toggle', handler);
  }
});
