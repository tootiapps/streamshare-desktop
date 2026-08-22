import { basename, dirname, isAbsolute, join, resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { app, BrowserWindow, dialog, ipcMain, Menu, nativeImage, shell, Tray } from 'electron';
import type { RemotePlaybackState, RemoteRequest } from '@streamshare/remote-protocol';
import { diagnosticLog, initializeDiagnosticLog } from './diagnostic-log.js';
import { ReceiverServer } from './receiver-server.js';
import { MediaFallback, type CompatibilityPlaybackRequest, type CompatibilitySubtitleRequest, type MediaFallbackDiagnostics, type VideoTranscodeResolution } from './media-fallback.js';
import { SettingsStore, type DolbyVisionMode } from './settings-store.js';
import { loadOrCreateTlsIdentity } from './tls-identity.js';
import { resolveLanguage, translate, type LanguagePreference, type SupportedLanguage } from './i18n.js';

declare const __APP_VERSION__: string;

const APPLICATION_NAME = 'Streamshare TV Client';
const APPLICATION_VERSION = __APP_VERSION__;
const DEBUG_MODE = process.env.STREAMSHARE_DEBUG === '1';
app.setName(APPLICATION_NAME);
process.title = APPLICATION_NAME;
if (DEBUG_MODE) {
  app.commandLine.appendSwitch('remote-debugging-address', '127.0.0.1');
  app.commandLine.appendSwitch('remote-debugging-port', process.env.STREAMSHARE_DEBUG_PORT || '9222');
}
if (!app.requestSingleInstanceLock()) app.exit(0);

let window: BrowserWindow | undefined;
let tray: Tray | undefined;
let receiver: ReceiverServer | undefined;
let mediaFallback: MediaFallback | undefined;
let mediaFallbackDiagnostics: MediaFallbackDiagnostics = { available: false, path: 'ffmpeg' };
let settingsStore: SettingsStore;
let quitting = false;
let shutdownPromise: Promise<void> | undefined;
let currentState: RemotePlaybackState = {
  status: 'idle', positionMs: 0, durationMs: 0, volume: 1, muted: false, revision: 0
};
const bundleDirectory = __dirname;
const applicationIconPath = process.platform === 'darwin'
  ? join(bundleDirectory, 'icons', 'macos', 'icon.png')
  : process.platform === 'win32'
    ? join(bundleDirectory, 'icons', 'windows', 'icon.ico')
    : join(bundleDirectory, 'icons', 'linux', '512x512.png');
const pendingCommands = new Map<string, {
  resolve: (state: RemotePlaybackState) => void;
  reject: (error: Error) => void;
  timeout: NodeJS.Timeout;
}>();

async function createWindow(): Promise<void> {
  window = new BrowserWindow({
    width: 1100,
    height: 700,
    minWidth: 720,
    minHeight: 480,
    backgroundColor: '#080a0f',
    title: APPLICATION_NAME,
    icon: applicationIconPath,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(bundleDirectory, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  await window.loadFile(join(bundleDirectory, 'index.html'));
  window.webContents.on('render-process-gone', (_event, details) => {
    diagnosticLog('error', 'renderer.process-gone', details);
    void mediaFallback?.stop().catch(() => undefined);
  });
  window.webContents.on('console-message', (_event, level, message, lineNumber, sourceId) => {
    if (level < 2) return;
    diagnosticLog(level >= 3 ? 'error' : 'warn', 'renderer.console', {
      level,
      message,
      lineNumber,
      sourceId
    });
  });
  if (DEBUG_MODE) window.webContents.openDevTools({ mode: 'detach' });
  window.on('enter-full-screen', publishWindowState);
  window.on('leave-full-screen', publishWindowState);
  window.on('close', event => {
    if (!quitting) {
      event.preventDefault();
      window?.hide();
    }
  });
}

function windowState(): { fullscreen: boolean } {
  return { fullscreen: window?.isFullScreen() ?? false };
}

function publishWindowState(): void {
  window?.webContents.send('window:state-changed', windowState());
}

function setWindowFullscreen(fullscreen: boolean): { fullscreen: boolean } {
  if (!window || window.isDestroyed()) return windowState();
  window.setFullScreen(fullscreen);
  const state = { fullscreen };
  window.webContents.send('window:state-changed', state);
  return state;
}

interface MediaBinaryPaths {
  ffmpeg: string;
  ffprobe: string;
  source: NonNullable<MediaFallbackDiagnostics['source']>;
}

function executableName(name: 'ffmpeg' | 'ffprobe'): string {
  return process.platform === 'win32' ? `${name}.exe` : name;
}

function resolveMediaBinaries(ffmpegDirectory?: string): MediaBinaryPaths {
  if (ffmpegDirectory) {
    return {
      ffmpeg: join(ffmpegDirectory, executableName('ffmpeg')),
      ffprobe: join(ffmpegDirectory, executableName('ffprobe')),
      source: 'custom'
    };
  }

  const environmentFfmpeg = process.env.STREAMSHARE_FFMPEG_PATH;
  const environmentFfprobe = process.env.STREAMSHARE_FFPROBE_PATH;
  if (environmentFfmpeg || environmentFfprobe) {
    const directory = dirname(environmentFfmpeg || environmentFfprobe || '.');
    return {
      ffmpeg: environmentFfmpeg || join(directory, executableName('ffmpeg')),
      ffprobe: environmentFfprobe || join(directory, executableName('ffprobe')),
      source: 'environment'
    };
  }

  const bundledFfmpeg = bundledMediaBinary('ffmpeg');
  const bundledFfprobe = bundledMediaBinary('ffprobe');
  if (existsSync(bundledFfmpeg) && existsSync(bundledFfprobe)) {
    return { ffmpeg: bundledFfmpeg, ffprobe: bundledFfprobe, source: 'bundled' };
  }

  const systemFfmpeg = systemMediaBinary('ffmpeg');
  const systemFfprobe = systemMediaBinary('ffprobe');
  return { ffmpeg: systemFfmpeg, ffprobe: systemFfprobe, source: 'system' };
}

function bundledMediaBinary(name: 'ffmpeg' | 'ffprobe'): string {
  const executable = process.platform === 'win32' ? `${name}.exe` : name;
  const bundled = join(bundleDirectory, 'ffmpeg', executable);
  return app.isPackaged ? bundled.replace('app.asar', 'app.asar.unpacked') : bundled;
}

function systemMediaBinary(name: 'ffmpeg' | 'ffprobe'): string {
  const executable = executableName(name);
  // Finder and desktop launchers often expose a much smaller PATH than the
  // user's shell. Check the usual package-manager locations explicitly before
  // falling back to PATH so development and unbundled distributions remain
  // useful without weakening the release-time licence checks.
  const commonLocations = process.platform === 'darwin'
    ? [`/opt/homebrew/bin/${executable}`, `/usr/local/bin/${executable}`]
    : process.platform === 'linux'
      ? [`/usr/local/bin/${executable}`, `/usr/bin/${executable}`]
      : [];
  return commonLocations.find(candidate => existsSync(candidate)) ?? executable;
}

async function configureMediaFallback(ffmpegDirectory?: string, staleDirectories: string[] = []): Promise<void> {
  await mediaFallback?.stop();
  const paths = resolveMediaBinaries(ffmpegDirectory);
  mediaFallback = new MediaFallback(
    join(app.getPath('temp'), 'streamshare-tv-client', 'media-fallback'),
    paths.ffmpeg,
    paths.ffprobe,
    paths.source
  );
  await mediaFallback.initialize(staleDirectories);
  mediaFallbackDiagnostics = await mediaFallback.diagnostics();
}

async function validateCustomFfmpegDirectory(directory: string): Promise<string> {
  const requested = directory.trim();
  if (!requested || !isAbsolute(requested)) throw new Error('FFmpeg directory must be an absolute path.');
  const normalized = resolve(requested);
  const paths = resolveMediaBinaries(normalized);
  const diagnostics = await new MediaFallback('', paths.ffmpeg, paths.ffprobe, 'custom').diagnostics();
  if (!diagnostics.available) throw new Error(diagnostics.error || 'FFmpeg and FFprobe could not be started.');
  // Deliberately do not reject --enable-nonfree here. A user-selected binary is
  // never redistributed by Streamshare and remains the user's responsibility.
  return normalized;
}

function createTray(language: SupportedLanguage): void {
  const icon = nativeImage.createFromPath(applicationIconPath).resize({ width: 20, height: 20 });
  tray = new Tray(icon);
  tray.setToolTip(APPLICATION_NAME);
  updateNativeMenus(language);
  tray.on('double-click', () => window?.show());
}

function requestOpenNetworkStream(): void {
  if (!window || window.isDestroyed()) return;
  if (window.isMinimized()) window.restore();
  window.show();
  window.focus();
  window.webContents.send('network-stream:open');
}

function requestToggleTechnicalInformation(): void {
  if (!window || window.isDestroyed()) return;
  if (window.isMinimized()) window.restore();
  window.show();
  window.focus();
  window.webContents.send('technical-information:toggle');
}

function updateNativeMenus(language: SupportedLanguage): void {
  tray?.setContextMenu(Menu.buildFromTemplate([
    { label: translate(language, 'showApp'), click: () => window?.show() },
    { label: translate(language, 'openNetworkStream'), click: requestOpenNetworkStream },
    { type: 'separator' },
    { label: translate(language, 'quit'), click: () => { quitting = true; app.quit(); } }
  ]));

  const fileMenu = {
    label: translate(language, 'fileMenu'),
    submenu: [
      {
        label: translate(language, 'openNetworkStream'),
        accelerator: 'CmdOrCtrl+N',
        click: requestOpenNetworkStream
      },
      { type: 'separator' as const },
      ...(process.platform === 'darwin' ? [{ role: 'close' as const }] : [{ role: 'quit' as const }])
    ]
  };
  const viewMenu = {
    label: translate(language, 'viewMenu'),
    submenu: [
      {
        label: translate(language, 'technicalInformation'),
        accelerator: 'CmdOrCtrl+I',
        click: requestToggleTechnicalInformation
      },
      { type: 'separator' as const },
      { role: 'resetZoom' as const },
      { role: 'zoomIn' as const },
      { role: 'zoomOut' as const },
      { type: 'separator' as const },
      { role: 'togglefullscreen' as const }
    ]
  };

  if (process.platform === 'darwin') {
    Menu.setApplicationMenu(Menu.buildFromTemplate([
      {
        label: APPLICATION_NAME,
        submenu: [
          { label: translate(language, 'about'), click: () => void showAboutDialog(language) },
          { type: 'separator' },
          { role: 'services' },
          { type: 'separator' },
          { role: 'hide' },
          { role: 'hideOthers' },
          { role: 'unhide' },
          { type: 'separator' },
          { role: 'quit' }
        ]
      },
      fileMenu,
      { role: 'editMenu' },
      viewMenu,
      { role: 'windowMenu' }
    ]));
  } else {
    Menu.setApplicationMenu(Menu.buildFromTemplate([
      fileMenu,
      { role: 'editMenu' },
      viewMenu,
      { role: 'windowMenu' }
    ]));
  }
}

async function showAboutDialog(language: SupportedLanguage): Promise<void> {
  const options = {
    type: 'info' as const,
    title: translate(language, 'about'),
    message: APPLICATION_NAME,
    detail: `${translate(language, 'aboutDescription')}\n\n${APPLICATION_NAME} ${APPLICATION_VERSION}`,
    icon: nativeImage.createFromPath(applicationIconPath)
  };
  if (window && !window.isDestroyed()) await dialog.showMessageBox(window, options);
  else await dialog.showMessageBox(options);
}

async function startReceiver(): Promise<void> {
  await receiver?.stop();
  receiver = undefined;
  const settings = await settingsStore.load();
  if (!settings.enabled) return;
  const identity = await loadOrCreateTlsIdentity(join(app.getPath('userData'), 'remote-identity.json'));
  receiver = new ReceiverServer(identity, settingsStore, {
    onPairingCode: (code, controllerName, expiresAt) => {
      window?.webContents.send('pairing:code', { code, controllerName, expiresAt });
      window?.show();
    },
    onPlaybackCommand: request => dispatchPlayerCommand(request),
    onControllersChanged: () => {
      window?.webContents.send('pairing:code', null);
      void publishSettings();
    }
  });
  await receiver.start();
}

function dispatchPlayerCommand(request: RemoteRequest): Promise<RemotePlaybackState> {
  if (!window || window.isDestroyed()) return Promise.reject(new Error('Player unavailable'));
  if (request.method === 'playback.load') {
    window.show();
    setWindowFullscreen(true);
  } else if (request.method === 'playback.stop') {
    setWindowFullscreen(false);
  }
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      pendingCommands.delete(request.id);
      reject(new Error('Player command timed out'));
    }, 10_000);
    pendingCommands.set(request.id, { resolve, reject, timeout });
    window?.webContents.send('player:command', request);
  });
}

async function publishSettings(): Promise<void> {
  const settings = await settingsStore.load();
  updateNativeMenus(resolveSettingsLanguage(settings));
  window?.webContents.send('settings:changed', publicSettings(settings));
}

function resolveSettingsLanguage(settings: Awaited<ReturnType<SettingsStore['load']>>): SupportedLanguage {
  return resolveLanguage(settings.language, app.getPreferredSystemLanguages());
}

function publicSettings(settings: Awaited<ReturnType<SettingsStore['load']>>) {
  return {
    receiverId: settings.receiverId,
    enabled: settings.enabled,
    deviceName: settings.deviceName,
    language: settings.language,
    ffmpegEnabled: settings.ffmpegEnabled,
    ffmpegDirectory: settings.ffmpegDirectory || '',
    dolbyVisionMode: settings.dolbyVisionMode,
    videoTranscodeResolution: settings.videoTranscodeResolution,
    ffmpeg: mediaFallbackDiagnostics,
    resolvedLanguage: resolveSettingsLanguage(settings),
    controllers: settings.controllers.map(({ tokenDigest: _tokenDigest, ...controller }) => controller)
  };
}

app.whenReady().then(async () => {
  const logDirectory = join(app.getPath('userData'), 'logs');
  initializeDiagnosticLog(logDirectory);
  app.setAppLogsPath(logDirectory);
  diagnosticLog('info', 'app.start', {
    version: APPLICATION_VERSION,
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node,
    platform: process.platform,
    architecture: process.arch,
    packaged: app.isPackaged,
    debug: DEBUG_MODE
  });
  process.on('uncaughtExceptionMonitor', error => diagnosticLog('error', 'process.uncaught-exception', error));
  process.on('unhandledRejection', error => diagnosticLog('error', 'process.unhandled-rejection', error));
  app.setName(APPLICATION_NAME);
  process.title = APPLICATION_NAME;
  app.setAppUserModelId('io.streamshare.tv');
  app.setAboutPanelOptions({
    applicationName: APPLICATION_NAME,
    applicationVersion: APPLICATION_VERSION,
    version: APPLICATION_VERSION,
    iconPath: applicationIconPath
  });

  settingsStore = new SettingsStore(join(app.getPath('userData'), 'settings.json'), 'Streamshare TV');
  await settingsStore.load();
  const legacyMediaFallbackDirectory = join(app.getPath('sessionData'), 'media-fallback');
  await configureMediaFallback((await settingsStore.load()).ffmpegDirectory, [legacyMediaFallbackDirectory]);

  if (process.platform === 'darwin' && !app.isPackaged) {
    // A packaged application gets its Dock icon from the bundle's ICNS. Only
    // override Electron's development icon while running `pnpm start`.
    app.dock?.setIcon(nativeImage.createFromPath(applicationIconPath));
  }

  ipcMain.handle('settings:get', async () => publicSettings(await settingsStore.load()));
  ipcMain.handle('diagnostics:open-logs', async () => {
    const error = await shell.openPath(logDirectory);
    if (error) throw new Error(error);
  });
  ipcMain.on('diagnostics:log', (_event, entry: { level?: string; event?: string; details?: unknown }) => {
    const level = ['debug', 'info', 'warn', 'error'].includes(entry.level || '')
      ? entry.level as 'debug' | 'info' | 'warn' | 'error'
      : 'info';
    diagnosticLog(level, `renderer.${entry.event || 'event'}`, entry.details);
  });
  ipcMain.handle('settings:update', async (_event, patch: {
    enabled?: boolean;
    deviceName?: string;
    language?: LanguagePreference;
    ffmpegEnabled?: boolean;
    ffmpegDirectory?: string;
    dolbyVisionMode?: DolbyVisionMode;
    videoTranscodeResolution?: VideoTranscodeResolution;
  }) => {
    const before = await settingsStore.load();
    const previousEnabled = before.enabled;
    const previousDeviceName = before.deviceName;
    const previousFfmpegDirectory = before.ffmpegDirectory;
    const ffmpegConfigurationUpdated = patch.ffmpegDirectory !== undefined;
    if (patch.ffmpegDirectory !== undefined) {
      patch.ffmpegDirectory = patch.ffmpegDirectory.trim()
        ? await validateCustomFfmpegDirectory(patch.ffmpegDirectory)
        : '';
    }
    const settings = await settingsStore.update(patch);
    const restart = settings.enabled !== previousEnabled || settings.deviceName !== previousDeviceName;
    if (ffmpegConfigurationUpdated || settings.ffmpegDirectory !== previousFfmpegDirectory) {
      await configureMediaFallback(settings.ffmpegDirectory);
    }
    if (restart) await startReceiver();
    await publishSettings();
    return publicSettings(settings);
  });
  ipcMain.handle('ffmpeg:choose', async () => {
    const settings = await settingsStore.load();
    const options = {
      title: translate(resolveSettingsLanguage(settings), 'chooseFfmpeg'),
      defaultPath: settings.ffmpegDirectory
        || (isAbsolute(mediaFallbackDiagnostics.path) ? dirname(mediaFallbackDiagnostics.path) : app.getPath('home')),
      properties: ['openFile'] as Array<'openFile'>,
      filters: process.platform === 'win32'
        ? [{ name: 'FFmpeg', extensions: ['exe'] }]
        : undefined
    };
    const result = window && !window.isDestroyed()
      ? await dialog.showOpenDialog(window, options)
      : await dialog.showOpenDialog(options);
    if (result.canceled || !result.filePaths[0]) return null;
    const selected = result.filePaths[0];
    if (basename(selected).toLowerCase() !== executableName('ffmpeg').toLowerCase()) {
      throw new Error(`Select ${executableName('ffmpeg')}.`);
    }
    return validateCustomFfmpegDirectory(dirname(selected));
  });
  ipcMain.handle('settings:revoke', async (_event, controllerId: string) => {
    await settingsStore.revoke(controllerId);
    receiver?.closeController(controllerId);
    await publishSettings();
  });
  ipcMain.handle('window:get-state', () => windowState());
  ipcMain.handle('window:toggle-fullscreen', () => {
    if (!window || window.isDestroyed()) return windowState();
    return setWindowFullscreen(!window.isFullScreen());
  });
  ipcMain.handle('window:set-fullscreen', (_event, fullscreen: boolean) => setWindowFullscreen(fullscreen));
  ipcMain.handle('media:probe', (_event, media: CompatibilityPlaybackRequest['media']) => mediaFallback?.probe(media));
  ipcMain.handle('media:start-compatibility', (_event, request: CompatibilityPlaybackRequest) => mediaFallback?.start(request));
  ipcMain.handle('media:start-subtitle', (_event, request: CompatibilitySubtitleRequest) => mediaFallback?.configureSubtitle(request));
  ipcMain.handle('media:compatibility-diagnostics', () => mediaFallback?.currentDiagnostics() ?? { active: false });
  ipcMain.handle('media:stop-compatibility', () => mediaFallback?.stop());
  ipcMain.on('player:state', (_event, state: RemotePlaybackState) => {
    currentState = state;
    receiver?.broadcastState(state);
  });
  ipcMain.on('player:command-result', (_event, result: { requestId: string; state?: RemotePlaybackState; error?: string }) => {
    const pending = pendingCommands.get(result.requestId);
    if (!pending) return;
    clearTimeout(pending.timeout);
    pendingCommands.delete(result.requestId);
    if (result.error || !result.state) pending.reject(new Error(result.error || 'Player command failed'));
    else pending.resolve(result.state);
  });

  await createWindow();
  createTray(resolveSettingsLanguage(await settingsStore.load()));
  await startReceiver();
});

app.on('activate', () => window?.show());
app.on('second-instance', () => {
  if (!window || window.isDestroyed()) return;
  if (window.isMinimized()) window.restore();
  window.show();
  window.focus();
});
app.on('before-quit', event => {
  if (shutdownPromise) return;
  event.preventDefault();
  quitting = true;
  for (const pending of pendingCommands.values()) {
    clearTimeout(pending.timeout);
    pending.reject(new Error('Application is quitting'));
  }
  pendingCommands.clear();
  shutdownPromise = Promise.allSettled([
    receiver?.stop() ?? Promise.resolve(),
    mediaFallback?.stop() ?? Promise.resolve()
  ]).then(() => undefined);
  void shutdownPromise.finally(() => app.quit());
});
