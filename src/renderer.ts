import Hls from 'hls.js';
import type {
  LoadMediaParams,
  RemoteMediaTrack,
  RemoteMediaTracks,
  RemotePlaybackState,
  RemoteRequest,
  RemoteTrackType
} from '@streamshare/remote-protocol';
import {
  LANGUAGE_NAMES,
  SUPPORTED_LANGUAGES,
  resolveLanguage,
  translate,
  type LanguagePreference,
  type Messages,
  type SupportedLanguage
} from './i18n.js';
import type { MediaFallbackDiagnostics, MediaProbeResult, VideoTranscodeResolution } from './media-fallback.js';
import type { DolbyVisionMode } from './settings-store.js';
import { compatibilityVideoOptions, resolveDolbyVisionPlayback, type DolbyVisionPlaybackDecision } from './dolby-vision-policy.js';

const video = required<HTMLVideoElement>('player');
const home = required<HTMLElement>('home');
const playerScreen = required<HTMLElement>('player-screen');
const settingsPanel = required<HTMLElement>('settings-panel');
const serviceToggle = required<HTMLInputElement>('service-enabled');
const deviceName = required<HTMLInputElement>('device-name');
const languageSelect = required<HTMLSelectElement>('language');
const saveSettings = required<HTMLButtonElement>('save-settings');
const settingsSaveStatus = required<HTMLElement>('settings-save-status');
const openSettings = required<HTMLButtonElement>('open-settings');
const openNetworkStream = required<HTMLButtonElement>('open-network-stream');
const closeSettings = required<HTMLButtonElement>('close-settings');
const fullscreenToggle = required<HTMLButtonElement>('fullscreen-toggle');
const tracksToggle = required<HTMLButtonElement>('tracks-toggle');
const tracksPanel = required<HTMLElement>('tracks-panel');
const audioTracksTitle = required<HTMLElement>('audio-tracks-title');
const videoTracksTitle = required<HTMLElement>('video-tracks-title');
const subtitleTracksTitle = required<HTMLElement>('subtitle-tracks-title');
const audioTracksContainer = required<HTMLElement>('audio-tracks');
const videoTracksContainer = required<HTMLElement>('video-tracks');
const subtitleTracksContainer = required<HTMLElement>('subtitle-tracks');
const controllers = required<HTMLElement>('controllers');
const pairing = required<HTMLElement>('pairing');
const pairingCode = required<HTMLElement>('pairing-code');
const pairingText = required<HTMLElement>('pairing-text');
const nowPlaying = required<HTMLElement>('now-playing');
const nowPlayingSubtitle = required<HTMLElement>('now-playing-subtitle');
const nowPlayingYear = required<HTMLElement>('now-playing-year');
const nowPlayingOverview = required<HTMLElement>('now-playing-overview');
const nowPlayingArtwork = required<HTMLImageElement>('now-playing-artwork');
const readyTitle = required<HTMLElement>('ready-title');
const readyDescription = required<HTMLElement>('ready-description');
const pairingHelp = required<HTMLElement>('pairing-help');
const configurationTitle = required<HTMLElement>('configuration-title');
const remoteReceptionLabel = required<HTMLElement>('remote-reception-label');
const remoteReceptionHelp = required<HTMLElement>('remote-reception-help');
const deviceNameLabel = required<HTMLElement>('device-name-label');
const languageLabel = required<HTMLElement>('language-label');
const ffmpegLabel = required<HTMLElement>('ffmpeg-label');
const ffmpegHelp = required<HTMLElement>('ffmpeg-help');
const ffmpegEnabledInput = required<HTMLInputElement>('ffmpeg-enabled');
const ffmpegStatus = required<HTMLElement>('ffmpeg-status');
const videoTranscodeResolutionSettings = required<HTMLElement>('video-transcode-resolution-settings');
const videoTranscodeResolutionLabel = required<HTMLElement>('video-transcode-resolution-label');
const videoTranscodeResolutionHelp = required<HTMLElement>('video-transcode-resolution-help');
const videoTranscodeResolutionSelect = required<HTMLSelectElement>('video-transcode-resolution');
const dolbyVisionSettings = required<HTMLElement>('dolby-vision-settings');
const dolbyVisionModeLabel = required<HTMLElement>('dolby-vision-mode-label');
const dolbyVisionModeHelp = required<HTMLElement>('dolby-vision-mode-help');
const dolbyVisionModeSelect = required<HTMLSelectElement>('dolby-vision-mode');
const dolbyVisionStatus = required<HTMLElement>('dolby-vision-status');
const ffmpegPathLabel = required<HTMLElement>('ffmpeg-path-label');
const ffmpegPathHelp = required<HTMLElement>('ffmpeg-path-help');
const ffmpegDirectoryInput = required<HTMLInputElement>('ffmpeg-directory');
const chooseFfmpeg = required<HTMLButtonElement>('choose-ffmpeg');
const resetFfmpeg = required<HTMLButtonElement>('reset-ffmpeg');
const ffmpegLicenseStatus = required<HTMLElement>('ffmpeg-license-status');
const openDiagnosticLogs = required<HTMLButtonElement>('open-diagnostic-logs');
const authorizedDevicesTitle = required<HTMLElement>('authorized-devices-title');
const playPause = required<HTMLButtonElement>('play-pause');
const playIcon = required<SVGSVGElement>('play-icon');
const pauseIcon = required<SVGSVGElement>('pause-icon');
const fullscreenIcon = required<SVGSVGElement>('fullscreen-icon');
const reduceIcon = required<SVGSVGElement>('reduce-icon');
const stopPlayer = required<HTMLButtonElement>('stop-player');
const playerProgress = required<HTMLInputElement>('player-progress');
const currentTimeLabel = required<HTMLElement>('current-time');
const durationLabel = required<HTMLElement>('duration');
const playerControls = required<HTMLElement>('player-controls');
const playerLoading = required<HTMLElement>('player-loading');
const playerLoadingText = required<HTMLElement>('player-loading-text');
const playerError = required<HTMLElement>('player-error');
const playerErrorTitle = required<HTMLElement>('player-error-title');
const playerErrorMessage = required<HTMLElement>('player-error-message');
const closePlayerError = required<HTMLButtonElement>('close-player-error');
const networkStreamDialog = required<HTMLElement>('network-stream-dialog');
const networkStreamForm = required<HTMLFormElement>('network-stream-form');
const networkStreamTitle = required<HTMLElement>('network-stream-title');
const networkStreamUrlLabel = required<HTMLElement>('network-stream-url-label');
const networkStreamUrlHelp = required<HTMLElement>('network-stream-url-help');
const networkStreamUrl = required<HTMLInputElement>('network-stream-url');
const networkStreamError = required<HTMLElement>('network-stream-error');
const cancelNetworkStream = required<HTMLButtonElement>('cancel-network-stream');
const submitNetworkStream = required<HTMLButtonElement>('submit-network-stream');
const technicalPanel = required<HTMLElement>('technical-panel');
const technicalPanelTitle = required<HTMLElement>('technical-panel-title');
const technicalContent = required<HTMLElement>('technical-content');
const closeTechnicalPanel = required<HTMLButtonElement>('close-technical-panel');
const CONTROLS_IDLE_DELAY_MS = 3000;
const COMPATIBILITY_PREFLIGHT_TIMEOUT_MS = 2_000;
const HLS_MANIFEST_TIMEOUT_MS = 10_000;
const COMPATIBILITY_PLAY_TIMEOUT_MS = 6_000;
const HLS_AUDIO_SWITCH_TIMEOUT_MS = 5_000;
const HLS_SWITCH_BUFFER_SECONDS = 0.75;
const COMPATIBILITY_START_BUFFER_SECONDS = 3;
const COMPATIBILITY_MAX_BUFFER_SECONDS = 30;
const COMPATIBILITY_RESUME_BUFFER_SECONDS = 20;
const COMPATIBILITY_BACK_BUFFER_SECONDS = 30;
const COMPATIBILITY_APPEND_BATCH_BYTES = 1024 * 1024;

let hls: Hls | undefined;
let compatibilityMediaAbort: AbortController | undefined;
let compatibilityMediaSource: MediaSource | undefined;
let compatibilityMediaObjectUrl: string | undefined;
let sessionId: string | undefined;
let metadata: LoadMediaParams['metadata'];
let revision = 0;
let status: RemotePlaybackState['status'] = 'idle';
let lastPeriodicReport = 0;
let pairingTimeout: number | undefined;
let pairingControllerName: string | undefined;
let currentLanguage: SupportedLanguage = resolveLanguage('system', navigator.languages);
let isSeeking = false;
let fullscreen = false;
let controlsIdleTimeout: number | undefined;
let controlsVisible = false;
let tracksPanelOpen = false;
let mediaTracks: RemoteMediaTracks = emptyMediaTracks();
let currentLoadParams: LoadMediaParams | undefined;
let compatibilityActive = false;
let compatibilityProbe: MediaProbeResult | undefined;
let compatibilityOffsetMs = 0;
let compatibilityMimeType: string | undefined;
let compatibilityVideoDecision: DolbyVisionPlaybackDecision | undefined;
let playbackLoading = false;
let compatibilityOperationRevision = 0;
let playbackRequested = false;
let selectedAudioTrackId: string | undefined;
let selectedVideoTrackId: string | undefined;
let selectedSubtitleTrackId: string | undefined;
let compatibilitySubtitleRevision = 0;
const compatibilityTextTracks = new Set<TextTrack>();
let ffmpegEnabled = true;
let ffmpegDiagnostics: MediaFallbackDiagnostics = { available: false, path: 'ffmpeg' };
let dolbyVisionMode: DolbyVisionMode = 'automatic';
let videoTranscodeResolution: VideoTranscodeResolution = 'source';
let settingsSaving = false;
let technicalPanelTimer: number | undefined;

void refreshSettings();
void refreshWindowState();
window.streamshare.onSettingsChanged(renderSettings);
window.streamshare.onWindowStateChanged(renderWindowState);
window.streamshare.onPairingCode(value => {
  if (pairingTimeout !== undefined) {
    window.clearTimeout(pairingTimeout);
    pairingTimeout = undefined;
  }
  if (!value) {
    pairingControllerName = undefined;
    pairing.hidden = true;
    return;
  }
  pairingControllerName = value.controllerName;
  pairing.hidden = false;
  pairingCode.textContent = value.code;
  pairingText.textContent = tr('pairingRequested', { name: value.controllerName });
  const delay = Math.max(0, value.expiresAt - Date.now());
  pairingTimeout = window.setTimeout(() => {
    pairing.hidden = true;
    pairingTimeout = undefined;
  }, delay);
});
window.streamshare.onCommand(request => void executeCommand(request));
window.streamshare.onOpenNetworkStream(openNetworkStreamDialog);
window.streamshare.onToggleTechnicalInformation(() => toggleTechnicalPanel());

playerScreen.addEventListener('pointermove', showPlayerControls);
playerScreen.addEventListener('pointerdown', event => {
  showPlayerControls();
  const target = event.target;
  if (tracksPanelOpen
    && target instanceof Node
    && !tracksPanel.contains(target)
    && !tracksToggle.contains(target)) {
    setTracksPanelOpen(false);
  }
});
playerScreen.addEventListener('pointerleave', schedulePlayerControlsHide);
document.addEventListener('keydown', event => void handleKeyboardShortcut(event));
tracksToggle.addEventListener('click', () => setTracksPanelOpen(!tracksPanelOpen));
closeTechnicalPanel.addEventListener('click', () => setTechnicalPanelOpen(false));
chooseFfmpeg.addEventListener('click', async () => {
  chooseFfmpeg.disabled = true;
  try {
    const selected = await window.streamshare.chooseFfmpeg();
    if (selected) ffmpegDirectoryInput.value = selected;
  } catch (error) {
    settingsSaveStatus.className = 'settings-save-status error';
    settingsSaveStatus.textContent = error instanceof Error ? error.message : tr('invalidFfmpeg');
  } finally {
    chooseFfmpeg.disabled = false;
  }
});
resetFfmpeg.addEventListener('click', () => {
  ffmpegDirectoryInput.value = '';
  clearSettingsSaveStatus();
});
ffmpegEnabledInput.addEventListener('change', () => {
  renderDolbyVisionSettings();
  renderVideoTranscodeResolutionSettings();
});

openSettings.addEventListener('click', () => {
  clearSettingsSaveStatus();
  settingsPanel.hidden = false;
});
openNetworkStream.addEventListener('click', openNetworkStreamDialog);
cancelNetworkStream.addEventListener('click', closeNetworkStreamDialog);
networkStreamDialog.addEventListener('click', event => {
  if (event.target === networkStreamDialog) closeNetworkStreamDialog();
});
networkStreamForm.addEventListener('submit', event => {
  event.preventDefault();
  void loadNetworkStreamFromDialog();
});
closePlayerError.addEventListener('click', async () => {
  stop();
  await window.streamshare.setFullscreen(false);
});
openDiagnosticLogs.addEventListener('click', () => void window.streamshare.openDiagnosticLogs().catch(error => {
  logDiagnostic('error', 'logs.open-failed', error);
}));
closeSettings.addEventListener('click', closeSettingsPanel);
settingsPanel.addEventListener('click', event => {
  if (event.target === settingsPanel && !settingsSaving) closeSettingsPanel();
});
languageSelect.addEventListener('change', () => {
  const preference = languageSelect.value as LanguagePreference;
  applyLanguage(resolveLanguage(preference, navigator.languages));
  renderLanguageOptions(preference);
});
fullscreenToggle.addEventListener('click', async () => {
  fullscreenToggle.disabled = true;
  try {
    renderWindowState(await window.streamshare.toggleFullscreen());
  } finally {
    fullscreenToggle.disabled = false;
  }
});
playPause.addEventListener('click', async () => {
  if (video.paused || video.ended) await playPlayback();
  else pausePlayback();
});
stopPlayer.addEventListener('click', async () => {
  stop();
  await window.streamshare.setFullscreen(false);
});
playerProgress.addEventListener('input', () => {
  isSeeking = true;
  currentTimeLabel.textContent = formatTime(Number(playerProgress.value));
});
playerProgress.addEventListener('change', () => {
  void seekToPosition(Number(playerProgress.value) * 1000);
  isSeeking = false;
  renderPlayerControls();
});
saveSettings.addEventListener('click', async () => {
  settingsSaving = true;
  saveSettings.disabled = true;
  closeSettings.disabled = true;
  saveSettings.textContent = tr('saving');
  settingsSaveStatus.className = 'settings-save-status muted';
  settingsSaveStatus.textContent = tr('saving');
  try {
    const requestedVideoTranscodeResolution = videoTranscodeResolutionSelect.value as VideoTranscodeResolution;
    const restartVideoTranscode = compatibilityActive
      && compatibilityVideoDecision?.transcodeVideo === true
      && requestedVideoTranscodeResolution !== videoTranscodeResolution;
    const restartPositionMs = restartVideoTranscode ? snapshot().positionMs : 0;
    const resumePlaying = playbackRequested;
    renderSettings(await window.streamshare.updateSettings({
      enabled: serviceToggle.checked,
      deviceName: deviceName.value,
      language: languageSelect.value as LanguagePreference,
      ffmpegEnabled: ffmpegEnabledInput.checked,
      ffmpegDirectory: ffmpegDirectoryInput.value,
      dolbyVisionMode: dolbyVisionModeSelect.value as DolbyVisionMode,
      videoTranscodeResolution: requestedVideoTranscodeResolution
    }));
    if (restartVideoTranscode) await restartCompatibility(restartPositionMs, resumePlaying);
    settingsSaveStatus.className = 'settings-save-status success';
    settingsSaveStatus.textContent = tr('saved');
    saveSettings.textContent = tr('saved');
    await new Promise<void>(resolve => window.setTimeout(resolve, 450));
    settingsSaving = false;
    closeSettingsPanel();
  } catch (error) {
    console.error('[Settings] Unable to save settings', error);
    settingsSaveStatus.className = 'settings-save-status error';
    settingsSaveStatus.textContent = tr('settingsSaveError');
  } finally {
    settingsSaving = false;
    saveSettings.disabled = false;
    closeSettings.disabled = false;
    saveSettings.textContent = tr('save');
  }
});

for (const event of ['playing', 'pause', 'waiting', 'ended', 'error', 'volumechange', 'durationchange', 'seeked']) {
  video.addEventListener(event, () => {
    status = mediaStatus(event);
    if (['playing', 'waiting', 'ended', 'error'].includes(event)) {
      logDiagnostic(event === 'error' ? 'error' : 'info', 'video.event', {
        event,
        networkState: video.networkState,
        readyState: video.readyState,
        mediaError: video.error ? { code: video.error.code, message: video.error.message } : undefined
      });
    }
    renderPlayerControls();
    reportState();
  });
}
video.addEventListener('timeupdate', () => {
  renderPlayerControls();
  if (Date.now() - lastPeriodicReport >= 1000) reportState();
});

function openNetworkStreamDialog(): void {
  networkStreamError.textContent = '';
  settingsPanel.hidden = true;
  networkStreamDialog.hidden = false;
  window.setTimeout(() => {
    networkStreamUrl.focus();
    networkStreamUrl.select();
  }, 0);
}

function closeNetworkStreamDialog(): void {
  networkStreamDialog.hidden = true;
  networkStreamError.textContent = '';
}

async function loadNetworkStreamFromDialog(): Promise<void> {
  let parsed: URL;
  try {
    parsed = new URL(networkStreamUrl.value.trim());
    if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('unsupported protocol');
  } catch {
    networkStreamError.textContent = tr('invalidNetworkStreamUrl');
    networkStreamUrl.focus();
    return;
  }

  const source: LoadMediaParams = {
    url: parsed.toString(),
    autoplay: true,
    metadata: { title: parsed.hostname }
  };
  networkStreamUrl.value = '';
  closeNetworkStreamDialog();
  try {
    await load(source);
  } catch (error) {
    const message = playbackErrorText(error);
    logDiagnostic('error', 'playback.local-load-failed', error);
    status = 'error';
    showPlaybackError(message);
    reportState(message);
  }
}

function playbackErrorText(error: unknown): string {
  if (!(error instanceof Error)) return tr('loadError');
  const message = error.message.replace(/^Error invoking remote method '[^']+': Error:\s*/i, '');
  if (/Dolby Vision SDR conversion requires an FFmpeg build with working libplacebo support/i.test(message)) {
    return tr('dolbyVisionToneMappingUnavailable');
  }
  if (/Dolby Vision Profile 5 requires (?:GPU|explicit GPU) tone mapping/i.test(message)) {
    return tr('dolbyVisionUnsupported');
  }
  return message || tr('loadError');
}

function showPlaybackError(message: string): void {
  setPlaybackLoading(false);
  playerErrorMessage.textContent = message;
  playerError.hidden = false;
  controlsVisible = true;
  playerScreen.classList.add('controls-visible');
}

function clearPlaybackError(): void {
  playerError.hidden = true;
  playerErrorMessage.textContent = '';
}

async function executeCommand(request: RemoteRequest): Promise<void> {
  try {
    switch (request.method) {
      case 'playback.load':
        // A load command is acknowledged as soon as the receiver has accepted it.
        // Network buffering continues asynchronously and is reported through state events,
        // matching the Android receiver and avoiding a cold HLS start timing out the sender.
        void load(request.params as LoadMediaParams).catch(error => {
          const message = playbackErrorText(error);
          logDiagnostic('error', 'playback.load-failed', error);
          status = 'error';
          showPlaybackError(message);
          reportState(message);
        });
        break;
      case 'playback.play':
        await playPlayback();
        break;
      case 'playback.pause':
        pausePlayback();
        break;
      case 'playback.stop':
        stop();
        break;
      case 'playback.seek':
        if (compatibilityActive) {
          void seekToPosition((request.params as { positionMs: number }).positionMs).catch(handleAsyncPlaybackError);
        } else {
          await seekToPosition((request.params as { positionMs: number }).positionMs);
        }
        break;
      case 'playback.volume':
        setPlaybackVolume(Math.max(0, Math.min(1, (request.params as { volume: number }).volume)));
        break;
      case 'playback.selectTrack': {
        const params = request.params as { type: RemoteTrackType; trackId: string };
        if (compatibilityActive) void selectMediaTrack(params.type, params.trackId).catch(handleAsyncPlaybackError);
        else await selectMediaTrack(params.type, params.trackId);
        break;
      }
      case 'playback.getState':
        break;
      case 'ui.navigate':
        await navigateInterface((request.params as { action: 'up' | 'down' | 'left' | 'right' | 'select' | 'back' }).action);
        break;
      default:
        throw new Error(`Unsupported command: ${request.method}`);
    }
    window.streamshare.completeCommand(request.id, snapshot());
  } catch (error) {
    logDiagnostic('error', 'command.failed', { method: request.method, error });
    status = 'error';
    window.streamshare.completeCommand(request.id, undefined, error instanceof Error ? error.message : tr('loadError'));
    reportState(error instanceof Error ? error.message : tr('loadError'));
  }
}

async function load(params: LoadMediaParams): Promise<void> {
  logDiagnostic('info', 'playback.load', {
    contentType: params.metadata?.contentType,
    protocol: mediaProtocol(params.url),
    autoplay: params.autoplay !== false,
    startPositionMs: params.startPositionMs || 0,
    headerNames: Object.keys(params.headers || {})
  });
  clearPlaybackError();
  compatibilityOperationRevision += 1;
  playbackRequested = params.autoplay !== false;
  setPlaybackLoading(false);
  pausePlayback(false);
  destroyHls();
  destroyCompatibilityMediaStream();
  removeCompatibilitySubtitles();
  // A playback.load starts a new media session. Clear the previous element
  // immediately, before ffprobe runs, so its local currentTime cannot leak
  // into the requested start position of the next item.
  video.removeAttribute('src');
  video.load();
  await window.streamshare.stopCompatibilityPlayback();
  currentLoadParams = params;
  compatibilityActive = false;
  compatibilityProbe = undefined;
  compatibilityOffsetMs = 0;
  compatibilityMimeType = undefined;
  compatibilityVideoDecision = undefined;
  selectedAudioTrackId = undefined;
  selectedVideoTrackId = undefined;
  selectedSubtitleTrackId = undefined;
  sessionId = crypto.randomUUID();
  metadata = params.metadata;
  status = 'buffering';
  renderNowPlayingMetadata();
  home.hidden = true;
  pairing.hidden = true;
  settingsPanel.hidden = true;
  playerScreen.hidden = false;
  tracksPanelOpen = false;
  mediaTracks = emptyMediaTracks();
  renderTracks();
  showPlayerControls();
  reportState();

  const source = params;
  let probePromise: Promise<MediaProbeResult | undefined> | undefined;
  const getProbe = () => probePromise ||= ffmpegEnabled
    ? window.streamshare.probeMedia(source).catch(() => undefined)
    : Promise.resolve(undefined);
  let shouldProbeInBackground = false;
  if (isHls(params.url) && Hls.isSupported()) {
    try {
      await attachHls(params.url, params.headers);
      shouldProbeInBackground = !hlsDeclaresCompatibleAudio();
    } catch (error) {
      const probe = await getProbe();
      if (!ffmpegEnabled || !probe) throw error;
      await activateCompatibility(source, probe, source.startPositionMs || 0, false);
    }
  } else if (ffmpegEnabled && isMatroska(params.url, metadata?.contentType)) {
    // Chromium reports Matroska as "maybe" even when its selected audio codec
    // (AC-3, E-AC-3, DTS…) is unavailable. Probe first and attach the final mux
    // directly instead of briefly starting a silent native playback.
    const probe = await getProbe();
    if (!probe) throw new Error(tr('unsupportedFormat'));
    await activateCompatibility(source, probe, source.startPositionMs || 0, false);
  } else if (video.canPlayType(contentType(params.url, metadata?.contentType))) {
    video.src = params.url;
    await once(video, 'loadedmetadata');
    refreshMediaTracks();
    shouldProbeInBackground = true;
  } else {
    const probe = await getProbe();
    if (!ffmpegEnabled || !probe) throw new Error(tr('unsupportedFormat'));
    await activateCompatibility(source, probe, source.startPositionMs || 0, false);
  }

  // For sources whose audio layout is not declared to Chromium (notably MKV),
  // give the already-running probe a short head start before playback. When it
  // finds an unsupported codec, start directly on the compatibility stream so
  // the viewer never sees a silent native playback followed by a second start.
  if (ffmpegEnabled && !compatibilityActive && shouldProbeInBackground) {
    const probe = await waitForCompatibilityProbe(getProbe());
    if (currentLoadParams !== source) return;
    if (probe) {
      compatibilityProbe = probe;
      selectedAudioTrackId ||= probe.audio.find(track => track.selected)?.id;
      selectedVideoTrackId ||= probe.video.find(track => track.selected)?.id;
      refreshMediaTracks();
      reportState();
      shouldProbeInBackground = false;
      if (requiresCompatibilityFallback(probe)) {
        await activateCompatibility(source, probe, source.startPositionMs || 0, false);
      }
    }
  }

  if (!compatibilityActive && params.startPositionMs && params.startPositionMs > 0) {
    await restoreNativePosition(params.startPositionMs);
  }
  if (playbackRequested) await playPlayback(false);

  // Do not make compatible streams wait for ffprobe. If the manifest did not
  // expose a codec, upgrade in the background only when the probe confirms one
  // of the formats Chromium commonly cannot decode.
  if (ffmpegEnabled && !compatibilityActive && shouldProbeInBackground) {
    void getProbe().then(async probe => {
      if (!probe || compatibilityActive || currentLoadParams !== source) return;
      compatibilityProbe = probe;
      selectedAudioTrackId ||= probe.audio.find(track => track.selected)?.id;
      selectedVideoTrackId ||= probe.video.find(track => track.selected)?.id;
      refreshMediaTracks();
      reportState();
      if (!requiresCompatibilityFallback(probe)) return;
      await activateCompatibility(source, probe, snapshot().positionMs, playbackRequested);
    }).catch(handleAsyncPlaybackError);
  }
}

async function activateCompatibility(
  source: LoadMediaParams,
  probe: MediaProbeResult,
  positionMs: number,
  resumePlaying: boolean
): Promise<void> {
  const operation = ++compatibilityOperationRevision;
  // Every caller supplies either the explicit load position or a snapshot
  // captured while upgrading the current media. Reading snapshot() here would
  // also see a previous video's currentTime during a new load and incorrectly
  // turn it into a seek on the new item.
  const stablePositionMs = Math.max(0, positionMs);
  pausePlayback(false);
  setPlaybackLoading(true);
  status = 'buffering';
  renderPlayerControls();
  reportState();
  const videoDecision = await resolveVideoFallback(probe, selectedVideoTrackId);
  const { transcodeVideo, toneMapDolbyVision } = videoDecision;
  logDiagnostic('info', 'compatibility.activate', {
    positionMs: stablePositionMs,
    resumePlaying,
    transcodeVideo,
    toneMapDolbyVision,
    nativeDolbyVisionSupported: videoDecision.nativeDolbyVisionSupported,
    videoEncoder: transcodeVideo ? ffmpegDiagnostics.videoEncoder : 'copy',
    selectedAudioTrackId,
    selectedVideoTrackId
  });

  try {
    const result = await window.streamshare.startCompatibilityPlayback({
      media: source,
      positionMs: stablePositionMs,
      probe,
      audioTrackId: selectedAudioTrackId,
      videoTrackId: selectedVideoTrackId,
      videoTranscodeResolution,
      ...compatibilityVideoOptions(videoDecision)
    });
    if (operation !== compatibilityOperationRevision || currentLoadParams !== source) return;
    compatibilityActive = true;
    compatibilityProbe = result.tracks;
    compatibilityOffsetMs = result.sourceStartMs;
    compatibilityMimeType = result.mimeType;
    compatibilityVideoDecision = videoDecision;
    selectedAudioTrackId ||= result.tracks.audio.find(track => track.selected)?.id;
    selectedVideoTrackId ||= result.tracks.video.find(track => track.selected)?.id;

    await attachCompatibilityStream(result.url, result.mimeType);

    if (operation !== compatibilityOperationRevision) return;
    await alignCompatibilityTimeline(stablePositionMs, result.sourceStartMs);
    await refreshCompatibilitySubtitle();
    refreshMediaTracks();
    if (resumePlaying) {
      await playPlayback(false);
      status = 'playing';
    } else {
      status = 'paused';
    }
  } finally {
    if (operation === compatibilityOperationRevision) {
      setPlaybackLoading(false);
      renderPlayerControls();
      reportState();
    }
  }
}

function stop(): void {
  compatibilityOperationRevision += 1;
  playbackRequested = false;
  pausePlayback(false);
  setPlaybackLoading(false);
  clearPlaybackError();
  video.removeAttribute('src');
  video.load();
  destroyHls();
  destroyCompatibilityMediaStream();
  void window.streamshare.stopCompatibilityPlayback();
  currentLoadParams = undefined;
  compatibilityActive = false;
  compatibilityProbe = undefined;
  compatibilityOffsetMs = 0;
  compatibilityMimeType = undefined;
  compatibilityVideoDecision = undefined;
  selectedAudioTrackId = undefined;
  selectedVideoTrackId = undefined;
  selectedSubtitleTrackId = undefined;
  removeCompatibilitySubtitles();
  sessionId = undefined;
  metadata = undefined;
  renderNowPlayingMetadata();
  status = 'idle';
  clearControlsIdleTimeout();
  controlsVisible = false;
  tracksPanelOpen = false;
  mediaTracks = emptyMediaTracks();
  tracksPanel.hidden = true;
  playerScreen.classList.remove('controls-visible');
  playerScreen.hidden = true;
  home.hidden = false;
  reportState();
}

function snapshot(error?: string): RemotePlaybackState {
  return {
    sessionId,
    status,
    positionMs: playbackPositionMs(),
    durationMs: compatibilityProbe?.durationMs || (Number.isFinite(video.duration) ? Math.round(video.duration * 1000) : 0),
    volume: video.volume,
    muted: video.muted,
    metadata,
    tracks: mediaTracks,
    ui: {
      controlsVisible,
      panel: tracksPanelOpen ? 'tracks' : undefined,
      focusedControl: remoteFocusedControl()
    },
    error,
    revision: ++revision
  };
}

function reportState(error?: string): void {
  lastPeriodicReport = Date.now();
  window.streamshare.reportState(snapshot(error));
}

function handleAsyncPlaybackError(error: unknown): void {
  status = 'error';
  logDiagnostic('error', 'playback.async-error', error);
  const message = playbackErrorText(error);
  showPlaybackError(message);
  reportState(message);
}

function mediaStatus(event: string): RemotePlaybackState['status'] {
  if (event === 'ended') return 'ended';
  if (event === 'error') return 'error';
  if (event === 'waiting') return 'buffering';
  if (event === 'playing') return 'playing';
  if (event === 'pause' && video.currentTime > 0) return 'paused';
  return status;
}

function destroyHls(): void {
  hls?.destroy();
  hls = undefined;
}

async function attachCompatibilityStream(url: string, mimeType?: string): Promise<void> {
  destroyHls();
  destroyCompatibilityMediaStream();
  video.removeAttribute('src');
  video.load();
  if (isHls(url)) {
    await attachHls(url);
    selectCompatibilityHlsTracks();
  } else if (mimeType && MediaSource.isTypeSupported(mimeType)) {
    await attachFragmentedMp4(url, mimeType);
  } else {
    video.src = url;
  }
  await waitForMediaReady(video);
  if (compatibilityMediaSource) {
    await waitForBufferedAhead(video, COMPATIBILITY_START_BUFFER_SECONDS, 8_000);
  }
}

async function attachFragmentedMp4(url: string, mimeType: string): Promise<void> {
  const controller = new AbortController();
  const mediaSource = new MediaSource();
  const objectUrl = URL.createObjectURL(mediaSource);
  compatibilityMediaAbort = controller;
  compatibilityMediaSource = mediaSource;
  compatibilityMediaObjectUrl = objectUrl;
  video.src = objectUrl;

  await once(mediaSource, 'sourceopen');
  if (controller.signal.aborted || compatibilityMediaSource !== mediaSource) return;
  const sourceBuffer = mediaSource.addSourceBuffer(mimeType);
  const response = await fetch(url, { cache: 'no-store', signal: controller.signal });
  if (!response.ok || !response.body) throw new Error(`FFmpeg stream unavailable (${response.status})`);

  void pumpFragmentedMp4(response.body, mediaSource, sourceBuffer, controller.signal).catch(error => {
    if (controller.signal.aborted || compatibilityMediaSource !== mediaSource) return;
    handleAsyncPlaybackError(error);
  });
}

async function pumpFragmentedMp4(
  stream: ReadableStream<Uint8Array>,
  mediaSource: MediaSource,
  sourceBuffer: SourceBuffer,
  signal: AbortSignal
): Promise<void> {
  const reader = stream.getReader();
  try {
    let endOfStream = false;
    while (!signal.aborted) {
      while (!signal.aborted && bufferedAhead(video) >= COMPATIBILITY_MAX_BUFFER_SECONDS) {
        await wait(100);
        if (bufferedAhead(video) <= COMPATIBILITY_RESUME_BUFFER_SECONDS) break;
      }
      if (signal.aborted) return;

      const chunks: Uint8Array[] = [];
      let byteLength = 0;
      while (byteLength < COMPATIBILITY_APPEND_BATCH_BYTES && !endOfStream && !signal.aborted) {
        const { done, value } = await reader.read();
        endOfStream = done;
        if (value?.byteLength) {
          chunks.push(value);
          byteLength += value.byteLength;
        }
      }
      if (!byteLength) break;
      await appendSourceBuffer(sourceBuffer, concatenateChunks(chunks, byteLength), signal);
      await trimCompatibilityBackBuffer(sourceBuffer, signal);
      if (endOfStream) break;
    }
    if (!signal.aborted && mediaSource.readyState === 'open' && !sourceBuffer.updating) {
      mediaSource.endOfStream();
    }
  } finally {
    if (signal.aborted) await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}

function concatenateChunks(chunks: Uint8Array[], byteLength: number): Uint8Array {
  if (chunks.length === 1) return chunks[0];
  const result = new Uint8Array(byteLength);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return result;
}

async function appendSourceBuffer(sourceBuffer: SourceBuffer, bytes: Uint8Array, signal: AbortSignal): Promise<void> {
  if (signal.aborted) return;
  if (sourceBuffer.updating) await once(sourceBuffer, 'updateend');
  if (signal.aborted) return;
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  sourceBuffer.appendBuffer(buffer);
  await once(sourceBuffer, 'updateend');
}

async function trimCompatibilityBackBuffer(sourceBuffer: SourceBuffer, signal: AbortSignal): Promise<void> {
  const removeUntil = video.currentTime - COMPATIBILITY_BACK_BUFFER_SECONDS;
  if (signal.aborted || removeUntil <= 0 || sourceBuffer.buffered.length === 0) return;
  const start = sourceBuffer.buffered.start(0);
  if (start >= removeUntil - 1) return;
  if (sourceBuffer.updating) await once(sourceBuffer, 'updateend');
  if (signal.aborted) return;
  sourceBuffer.remove(start, removeUntil);
  await once(sourceBuffer, 'updateend');
}

function destroyCompatibilityMediaStream(): void {
  compatibilityMediaAbort?.abort();
  compatibilityMediaAbort = undefined;
  if (compatibilityMediaSource?.readyState === 'open') {
    try { compatibilityMediaSource.endOfStream(); } catch { /* The source may be updating during a hand-off. */ }
  }
  compatibilityMediaSource = undefined;
  if (compatibilityMediaObjectUrl) URL.revokeObjectURL(compatibilityMediaObjectUrl);
  compatibilityMediaObjectUrl = undefined;
}

function bufferedAhead(media: HTMLMediaElement): number {
  const position = media.currentTime;
  for (let index = 0; index < media.buffered.length; index += 1) {
    // AAC encoder priming can make a restarted mux begin around 167 ms rather
    // than exactly zero. Treat that tiny leading gap as playable; requiring a
    // 50 ms match made audio switches wait for the full 8 s safety timeout.
    if (media.buffered.start(index) <= position + 0.5 && media.buffered.end(index) >= position) {
      return Math.max(0, media.buffered.end(index) - position);
    }
  }
  return 0;
}

async function waitForBufferedAhead(media: HTMLMediaElement, seconds: number, timeoutMs: number): Promise<void> {
  const deadline = performance.now() + timeoutMs;
  while (bufferedAhead(media) < seconds && performance.now() < deadline) await wait(50);
}

function wait(delayMs: number): Promise<void> {
  return new Promise(resolve => window.setTimeout(resolve, delayMs));
}

async function playPlayback(updateIntent = true): Promise<void> {
  if (updateIntent) playbackRequested = true;
  try {
    await withTimeout(video.play(), COMPATIBILITY_PLAY_TIMEOUT_MS, 'Playback did not become ready');
  } catch (error) {
    pausePlayback(false);
    throw error;
  }
}

function pausePlayback(updateIntent = true): void {
  if (updateIntent) playbackRequested = false;
  video.pause();
}

function setPlaybackVolume(volume: number): void {
  video.volume = volume;
}

function playbackPositionMs(): number {
  const videoPosition = Number.isFinite(video.currentTime) ? Math.round(video.currentTime * 1000) : 0;
  return compatibilityOffsetMs + videoPosition;
}

async function waitForMediaReady(media: HTMLMediaElement): Promise<void> {
  if (media.seeking) {
    await Promise.race([
      once(media, 'seeked'),
      new Promise<void>(resolve => window.setTimeout(resolve, 3_000))
    ]);
  }
  if (media.readyState < HTMLMediaElement.HAVE_FUTURE_DATA) {
    await Promise.race([
      once(media, 'canplay'),
      new Promise<void>(resolve => window.setTimeout(resolve, 5_000))
    ]);
  }
}

function closeSettingsPanel(): void {
  if (settingsSaving) return;
  settingsPanel.hidden = true;
  clearSettingsSaveStatus();
  void refreshSettings();
}

function clearSettingsSaveStatus(): void {
  settingsSaveStatus.className = 'settings-save-status muted';
  settingsSaveStatus.textContent = '';
}

function setPlaybackLoading(loading: boolean): void {
  playbackLoading = loading;
  playerLoading.hidden = !loading;
  playerScreen.setAttribute('aria-busy', String(loading));
  playPause.disabled = loading;
  playerProgress.disabled = loading;
  tracksToggle.disabled = loading;
  if (loading) {
    clearControlsIdleTimeout();
    tracksPanelOpen = false;
    tracksPanel.hidden = true;
  }
}

async function refreshSettings(): Promise<void> {
  renderSettings(await window.streamshare.getSettings());
}

async function refreshWindowState(): Promise<void> {
  renderWindowState(await window.streamshare.getWindowState());
}

function renderWindowState(state: { fullscreen: boolean }): void {
  fullscreen = state.fullscreen;
  fullscreenIcon.toggleAttribute('hidden', fullscreen);
  reduceIcon.toggleAttribute('hidden', !fullscreen);
  fullscreenToggle.title = `${fullscreen ? tr('reduce') : tr('fullscreen')} (F / Esc)`;
  fullscreenToggle.setAttribute('aria-label', fullscreen ? tr('reduceAria') : tr('fullscreenAria'));
  fullscreenToggle.setAttribute('aria-pressed', String(fullscreen));
}

function showPlayerControls(): void {
  if (playerScreen.hidden) return;
  const changed = !controlsVisible;
  controlsVisible = true;
  playerScreen.classList.add('controls-visible');
  schedulePlayerControlsHide();
  if (changed) reportState();
}

function schedulePlayerControlsHide(): void {
  clearControlsIdleTimeout();
  if (tracksPanelOpen) return;
  controlsIdleTimeout = window.setTimeout(() => {
    const changed = controlsVisible;
    controlsVisible = false;
    playerScreen.classList.remove('controls-visible');
    controlsIdleTimeout = undefined;
    if (changed) reportState();
  }, CONTROLS_IDLE_DELAY_MS);
}

function clearControlsIdleTimeout(): void {
  if (controlsIdleTimeout === undefined) return;
  window.clearTimeout(controlsIdleTimeout);
  controlsIdleTimeout = undefined;
}

function toggleTechnicalPanel(): void {
  setTechnicalPanelOpen(technicalPanel.hidden);
}

function setTechnicalPanelOpen(open: boolean): void {
  technicalPanel.hidden = !open;
  if (technicalPanelTimer !== undefined) {
    window.clearInterval(technicalPanelTimer);
    technicalPanelTimer = undefined;
  }
  if (!open) return;
  void renderTechnicalInformation();
  technicalPanelTimer = window.setInterval(() => void renderTechnicalInformation(), 750);
}

async function renderTechnicalInformation(): Promise<void> {
  if (technicalPanel.hidden) return;
  const compatibilityProcess = await window.streamshare.getCompatibilityDiagnostics().catch(error => ({
    active: false,
    error: error instanceof Error ? error.message : String(error)
  }));
  if (technicalPanel.hidden) return;
  const quality = typeof video.getVideoPlaybackQuality === 'function'
    ? video.getVideoPlaybackQuality()
    : undefined;
  const selectedVideo = selectedTrack(compatibilityProbe?.video, selectedVideoTrackId);
  const selectedAudio = selectedTrack(compatibilityProbe?.audio, selectedAudioTrackId);
  const selectedSubtitle = selectedTrack(compatibilityProbe?.subtitles, selectedSubtitleTrackId);
  const details = {
    updatedAt: new Date().toISOString(),
    playback: {
      status,
      requested: playbackRequested,
      loading: playbackLoading,
      paused: video.paused,
      seeking: video.seeking,
      positionMs: playbackPositionMs(),
      localElementPositionMs: Math.round((Number.isFinite(video.currentTime) ? video.currentTime : 0) * 1000),
      durationMs: compatibilityProbe?.durationMs || (Number.isFinite(video.duration) ? Math.round(video.duration * 1000) : 0),
      readyState: `${video.readyState} (${mediaReadyStateName(video.readyState)})`,
      networkState: `${video.networkState} (${mediaNetworkStateName(video.networkState)})`,
      bufferedSeconds: bufferedRanges(video),
      renderedResolution: video.videoWidth && video.videoHeight ? `${video.videoWidth}x${video.videoHeight}` : undefined,
      totalVideoFrames: quality?.totalVideoFrames,
      droppedVideoFrames: quality?.droppedVideoFrames,
      mediaError: video.error ? { code: video.error.code, message: video.error.message } : undefined
    },
    source: currentLoadParams ? {
      location: safeTechnicalMediaLocation(currentLoadParams.url),
      contentType: currentLoadParams.metadata?.contentType,
      title: currentLoadParams.metadata?.title,
      startPositionMs: currentLoadParams.startPositionMs || 0
    } : undefined,
    pipeline: {
      mode: compatibilityActive ? 'ffmpeg-compatibility' : currentLoadParams ? 'chromium-native' : 'idle',
      outputMimeType: compatibilityMimeType,
      sourceTimelineOffsetMs: compatibilityOffsetMs,
      videoDecision: compatibilityVideoDecision,
      dolbyVisionMode,
      configuredTranscodeResolution: videoTranscodeResolution,
      ffmpeg: ffmpegDiagnostics,
      process: compatibilityProcess
    },
    selectedTracks: {
      video: selectedVideo,
      audio: selectedAudio,
      subtitle: selectedSubtitle
    },
    probe: compatibilityProbe ? {
      durationMs: compatibilityProbe.durationMs,
      videoMimeTypes: compatibilityProbe.videoMimeTypes,
      dolbyVisionProfiles: compatibilityProbe.dolbyVisionProfiles,
      dolbyVisionLevels: compatibilityProbe.dolbyVisionLevels,
      dolbyVisionCompatibilityIds: compatibilityProbe.dolbyVisionCompatibilityIds,
      video: compatibilityProbe.video,
      audio: compatibilityProbe.audio,
      subtitles: compatibilityProbe.subtitles
    } : undefined
  };
  technicalContent.textContent = JSON.stringify(details, null, 2);
}

function selectedTrack(tracks: RemoteMediaTrack[] | undefined, requestedId?: string): RemoteMediaTrack | undefined {
  return tracks?.find(track => track.id === requestedId)
    || tracks?.find(track => track.selected)
    || tracks?.[0];
}

function bufferedRanges(media: HTMLMediaElement): string[] {
  return Array.from({ length: media.buffered.length }, (_, index) =>
    `${media.buffered.start(index).toFixed(3)}–${media.buffered.end(index).toFixed(3)}`);
}

function safeTechnicalMediaLocation(value: string): string {
  try {
    const parsed = new URL(value);
    const filename = parsed.pathname.split('/').filter(Boolean).at(-1);
    return `${parsed.protocol}//${parsed.host}${filename ? `/…/${filename}` : ''}`;
  } catch {
    return '[unavailable]';
  }
}

function mediaReadyStateName(value: number): string {
  return ['nothing', 'metadata', 'current-data', 'future-data', 'enough-data'][value] || 'unknown';
}

function mediaNetworkStateName(value: number): string {
  return ['empty', 'idle', 'loading', 'no-source'][value] || 'unknown';
}

async function handleKeyboardShortcut(event: KeyboardEvent): Promise<void> {
  const key = event.key.toLowerCase();
  if ((event.metaKey || event.ctrlKey) && key === 'n') {
    event.preventDefault();
    openNetworkStreamDialog();
    return;
  }
  if ((event.metaKey || event.ctrlKey) && key === 'i') {
    event.preventDefault();
    toggleTechnicalPanel();
    return;
  }
  if (event.key === 'Escape' && !networkStreamDialog.hidden) {
    event.preventDefault();
    closeNetworkStreamDialog();
    return;
  }
  if (event.key === 'Escape' && !technicalPanel.hidden) {
    event.preventDefault();
    setTechnicalPanelOpen(false);
    return;
  }
  if (playerScreen.hidden) return;

  showPlayerControls();
  if (event.key === 'Escape' && fullscreen) {
    event.preventDefault();
    renderWindowState(await window.streamshare.setFullscreen(false));
    return;
  }

  if (isFormControl(event.target) || event.metaKey || event.ctrlKey || event.altKey) return;
  if (key === ' ' || key === 'k') {
    event.preventDefault();
    if (video.paused || video.ended) await playPlayback();
    else pausePlayback();
    return;
  }
  if (key === 'f') {
    event.preventDefault();
    renderWindowState(await window.streamshare.toggleFullscreen());
    return;
  }
  if (key === 's') {
    event.preventDefault();
    stop();
    await window.streamshare.setFullscreen(false);
    return;
  }
  if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
    event.preventDefault();
    const offset = event.key === 'ArrowLeft' ? -10 : 10;
    const state = snapshot();
    await seekToPosition(Math.max(0, Math.min(state.durationMs || Number.POSITIVE_INFINITY, state.positionMs + offset * 1000)));
  }
}

function isFormControl(target: EventTarget | null): boolean {
  return target instanceof HTMLInputElement
    || target instanceof HTMLSelectElement
    || target instanceof HTMLTextAreaElement
    || target instanceof HTMLButtonElement;
}

function renderSettings(settings: Awaited<ReturnType<typeof window.streamshare.getSettings>>): void {
  ffmpegDiagnostics = settings.ffmpeg;
  applyLanguage(settings.resolvedLanguage);
  serviceToggle.checked = settings.enabled;
  ffmpegEnabled = settings.ffmpegEnabled;
  ffmpegEnabledInput.checked = settings.ffmpegEnabled;
  ffmpegEnabledInput.disabled = !settings.ffmpeg.available;
  dolbyVisionMode = settings.dolbyVisionMode;
  dolbyVisionModeSelect.value = settings.dolbyVisionMode;
  videoTranscodeResolution = settings.videoTranscodeResolution;
  videoTranscodeResolutionSelect.value = settings.videoTranscodeResolution;
  ffmpegDirectoryInput.value = settings.ffmpegDirectory;
  renderFfmpegStatus();
  renderDolbyVisionSettings();
  renderVideoTranscodeResolutionSettings();
  deviceName.value = settings.deviceName;
  renderLanguageOptions(settings.language);
  controllers.replaceChildren();
  if (!settings.controllers.length) {
    const empty = document.createElement('p');
    empty.className = 'muted';
    empty.textContent = tr('noAuthorizedDevices');
    controllers.append(empty);
    return;
  }
  for (const controller of settings.controllers) {
    const row = document.createElement('div');
    row.className = 'controller';
    const label = document.createElement('span');
    label.textContent = controller.name;
    const revoke = document.createElement('button');
    revoke.className = 'danger';
    revoke.textContent = tr('revoke');
    revoke.addEventListener('click', async () => {
      await window.streamshare.revokeController(controller.id);
      await refreshSettings();
    });
    row.append(label, revoke);
    controllers.append(row);
  }
}

function renderLanguageOptions(preference: LanguagePreference): void {
  languageSelect.replaceChildren();
  const system = document.createElement('option');
  system.value = 'system';
  system.textContent = tr('systemLanguage');
  languageSelect.append(system);
  for (const language of SUPPORTED_LANGUAGES) {
    const option = document.createElement('option');
    option.value = language;
    option.textContent = LANGUAGE_NAMES[language];
    languageSelect.append(option);
  }
  languageSelect.value = preference;
}

function applyLanguage(language: SupportedLanguage): void {
  currentLanguage = language;
  document.documentElement.lang = language;
  readyTitle.textContent = tr('readyTitle');
  readyDescription.textContent = tr('readyDescription');
  playerLoadingText.textContent = tr('preparingPlayback');
  playerErrorTitle.textContent = tr('loadError');
  closePlayerError.textContent = tr('stop');
  openNetworkStream.textContent = tr('openNetworkStream');
  networkStreamTitle.textContent = tr('openNetworkStream');
  networkStreamUrlLabel.textContent = tr('networkStreamUrl');
  networkStreamUrlHelp.textContent = tr('networkStreamUrlDescription');
  cancelNetworkStream.textContent = tr('cancel');
  submitNetworkStream.textContent = tr('open');
  technicalPanelTitle.textContent = tr('technicalInformation');
  closeTechnicalPanel.setAttribute('aria-label', tr('cancel'));
  openSettings.textContent = tr('settings');
  configurationTitle.textContent = tr('configuration');
  closeSettings.textContent = tr('cancel');
  remoteReceptionLabel.textContent = tr('remoteReception');
  remoteReceptionHelp.textContent = tr('remoteReceptionDescription');
  deviceNameLabel.textContent = tr('deviceName');
  languageLabel.textContent = tr('language');
  ffmpegLabel.textContent = tr('ffmpegCompatibility');
  ffmpegHelp.textContent = tr('ffmpegCompatibilityDescription');
  dolbyVisionModeLabel.textContent = tr('dolbyVisionMode');
  dolbyVisionModeHelp.textContent = tr('dolbyVisionModeDescription');
  renderDolbyVisionOptions();
  videoTranscodeResolutionLabel.textContent = tr('videoTranscodeResolution');
  videoTranscodeResolutionHelp.textContent = tr('videoTranscodeResolutionDescription');
  renderVideoTranscodeResolutionOptions();
  ffmpegPathLabel.textContent = tr('ffmpegPath');
  ffmpegPathHelp.textContent = tr('ffmpegPathDescription');
  ffmpegDirectoryInput.placeholder = tr('automaticFfmpeg');
  chooseFfmpeg.textContent = tr('chooseFfmpeg');
  resetFfmpeg.textContent = tr('automatic');
  openDiagnosticLogs.textContent = tr('openDiagnosticLogs');
  renderFfmpegStatus();
  renderDolbyVisionSettings();
  authorizedDevicesTitle.textContent = tr('authorizedDevices');
  tracksToggle.title = tr('tracks');
  tracksToggle.setAttribute('aria-label', tr('tracks'));
  tracksPanel.setAttribute('aria-label', tr('tracks'));
  audioTracksTitle.textContent = tr('audioTracks');
  videoTracksTitle.textContent = tr('videoTracks');
  subtitleTracksTitle.textContent = tr('subtitleTracks');
  saveSettings.textContent = tr('save');
  pairingHelp.textContent = tr('pairingHelp');
  pairingText.textContent = pairingControllerName
    ? tr('pairingRequested', { name: pairingControllerName })
    : tr('pairingTitle');
  renderNowPlayingMetadata();
  renderWindowState({ fullscreen });
  renderPlayerControls();
  renderTracks();
}

function renderNowPlayingMetadata(): void {
  const title = metadata?.title?.trim() || tr('nowPlaying');
  nowPlaying.textContent = title;

  const subtitle = safeMediaSubtitle(metadata?.subtitle, title);
  nowPlayingSubtitle.textContent = subtitle || '';
  nowPlayingSubtitle.toggleAttribute('hidden', !subtitle);

  const releaseYear = safeReleaseYear(metadata?.releaseYear);
  nowPlayingYear.textContent = releaseYear ? String(releaseYear) : '';
  nowPlayingYear.toggleAttribute('hidden', !releaseYear);

  const overview = safeMediaOverview(metadata?.overview);
  nowPlayingOverview.textContent = overview || '';
  nowPlayingOverview.toggleAttribute('hidden', !overview);

  const artworkUrl = safeArtworkUrl(metadata?.artworkUrl);
  if (artworkUrl) nowPlayingArtwork.src = artworkUrl;
  else nowPlayingArtwork.removeAttribute('src');
  nowPlayingArtwork.toggleAttribute('hidden', !artworkUrl);
}

function safeReleaseYear(value?: number): number | undefined {
  if (value == null || !Number.isInteger(value) || value < 1800 || value > 2200) return undefined;
  return value;
}

function safeMediaOverview(value?: string): string | undefined {
  const overview = value?.trim();
  return overview ? overview.slice(0, 1_500) : undefined;
}

function safeMediaSubtitle(value?: string, title?: string): string | undefined {
  const subtitle = value?.trim();
  if (!subtitle) return undefined;

  const compactSubtitle = subtitle.replace(/[\s·_-]+/g, '');
  if (/^S(?:null|undefined|\d+)E(?:null|undefined)$/i.test(compactSubtitle)
    || /^S(?:null|undefined)E(?:null|undefined|\d+)$/i.test(compactSubtitle)
  ) return undefined;

  const normalizedTitle = title?.trim().toLocaleLowerCase();
  return subtitle
    .split('·')
    .map(part => part.trim())
    .filter(part => part && part.toLocaleLowerCase() !== normalizedTitle)
    .join(' · ') || undefined;
}

function safeArtworkUrl(value?: string): string | undefined {
  const url = value?.trim();
  return url && /^(https?:|data:image\/)/i.test(url) ? url : undefined;
}

function renderFfmpegStatus(): void {
  ffmpegStatus.textContent = ffmpegDiagnostics.available
    ? tr('ffmpegAvailable', { version: ffmpegDiagnostics.version || 'FFmpeg', path: ffmpegDiagnostics.path })
    : [tr('ffmpegUnavailable', { path: ffmpegDiagnostics.path }), ffmpegDiagnostics.error]
      .filter(Boolean)
      .join(' — ');
  ffmpegLicenseStatus.textContent = ffmpegDiagnostics.nonfree
    ? tr('externalNonfreeFfmpeg')
    : '';
  ffmpegLicenseStatus.className = ffmpegDiagnostics.nonfree
    ? 'compatibility-status warning'
    : 'compatibility-status muted';
}

function renderDolbyVisionOptions(): void {
  const selected = dolbyVisionModeSelect.value || dolbyVisionMode;
  const options: Array<{ value: DolbyVisionMode; label: keyof Pick<Messages,
    'dolbyVisionAutomatic' | 'dolbyVisionNative' | 'dolbyVisionSdr'> }> = [
    { value: 'automatic', label: 'dolbyVisionAutomatic' },
    { value: 'native', label: 'dolbyVisionNative' },
    { value: 'sdr', label: 'dolbyVisionSdr' }
  ];
  dolbyVisionModeSelect.replaceChildren(...options.map(({ value, label }) => {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = tr(label);
    return option;
  }));
  dolbyVisionModeSelect.value = selected;
}

function renderDolbyVisionSettings(): void {
  const enabled = ffmpegEnabledInput.checked && ffmpegDiagnostics.available;
  dolbyVisionSettings.hidden = !enabled;
  dolbyVisionModeSelect.disabled = !enabled;
  dolbyVisionStatus.textContent = ffmpegDiagnostics.dolbyVisionToneMapping
    ? tr('dolbyVisionSdrAvailable')
    : tr('dolbyVisionSdrUnavailable');
  dolbyVisionStatus.className = ffmpegDiagnostics.dolbyVisionToneMapping
    ? 'compatibility-status success'
    : 'compatibility-status warning';
}

function renderVideoTranscodeResolutionOptions(): void {
  const selected = videoTranscodeResolutionSelect.value || videoTranscodeResolution;
  const options: Array<{ value: VideoTranscodeResolution; label: keyof Pick<Messages,
    'videoTranscodeSource' | 'videoTranscode2160p' | 'videoTranscode1080p' | 'videoTranscode720p'> }> = [
    { value: 'source', label: 'videoTranscodeSource' },
    { value: '2160p', label: 'videoTranscode2160p' },
    { value: '1080p', label: 'videoTranscode1080p' },
    { value: '720p', label: 'videoTranscode720p' }
  ];
  videoTranscodeResolutionSelect.replaceChildren(...options.map(({ value, label }) => {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = tr(label);
    return option;
  }));
  videoTranscodeResolutionSelect.value = selected;
}

function renderVideoTranscodeResolutionSettings(): void {
  const enabled = ffmpegEnabledInput.checked && ffmpegDiagnostics.available;
  videoTranscodeResolutionSettings.hidden = !enabled;
  videoTranscodeResolutionSelect.disabled = !enabled;
}

function renderPlayerControls(): void {
  const playing = !video.paused && !video.ended;
  const action = playing ? tr('pause') : tr('play');
  playIcon.toggleAttribute('hidden', playing);
  pauseIcon.toggleAttribute('hidden', !playing);
  playPause.title = `${action} (Space / K)`;
  playPause.setAttribute('aria-label', action);
  stopPlayer.title = `${tr('stop')} (S)`;
  stopPlayer.setAttribute('aria-label', tr('stop'));
  playerControls.setAttribute('aria-label', tr('playbackControls'));
  playerProgress.setAttribute('aria-label', tr('seek'));
  const duration = compatibilityProbe?.durationMs
    ? compatibilityProbe.durationMs / 1000
    : Number.isFinite(video.duration) ? Math.max(0, video.duration) : 0;
  const position = playbackPositionMs() / 1000;
  playerProgress.max = String(Math.max(1, duration));
  if (!isSeeking) playerProgress.value = String(Math.min(position, Math.max(1, duration)));
  if (!isSeeking) currentTimeLabel.textContent = formatTime(position);
  durationLabel.textContent = formatTime(duration);
}

function formatTime(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const remainingSeconds = total % 60;
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`
    : `${minutes}:${String(remainingSeconds).padStart(2, '0')}`;
}

function emptyMediaTracks(): RemoteMediaTracks {
  return { audio: [], video: [], subtitles: [] };
}

function registerHlsTrackListeners(): void {
  const instance = hls;
  if (!instance) return;
  const refresh = () => {
    if (hls !== instance) return;
    refreshMediaTracks();
    reportState();
  };
  for (const event of [
    Hls.Events.AUDIO_TRACKS_UPDATED,
    Hls.Events.AUDIO_TRACK_SWITCHED,
    Hls.Events.SUBTITLE_TRACKS_UPDATED,
    Hls.Events.SUBTITLE_TRACK_SWITCH,
    Hls.Events.LEVELS_UPDATED,
    Hls.Events.LEVEL_SWITCHED
  ]) instance.on(event, refresh);
}

async function attachHls(url: string, headers: Record<string, string> = {}): Promise<void> {
  const localCompatibilityStream = compatibilityActive;
  const instance = new Hls({
    enableWorker: true,
    ...(localCompatibilityStream
      ? {
          lowLatencyMode: false,
          initialLiveManifestSize: 1,
          liveSyncDurationCount: 2,
          // FFmpeg primes up to 15 seconds before settling to real-time input.
          // Keep that headroom instead of jumping the playhead to the live edge;
          // it makes ordinary ±10 second seeks local and immediate.
          liveMaxLatencyDurationCount: 30,
          maxBufferLength: 30,
          maxMaxBufferLength: 45,
          backBufferLength: 30
        }
      : { lowLatencyMode: true }),
    xhrSetup: xhr => {
      for (const [key, value] of Object.entries(headers)) xhr.setRequestHeader(key, value);
    }
  });
  hls = instance;
  try {
    await attachAndLoadHls(instance, video, url, HLS_MANIFEST_TIMEOUT_MS);
  } catch (error) {
    if (hls === instance) hls = undefined;
    instance.destroy();
    throw error;
  }
  registerHlsTrackListeners();
  registerHlsErrorRecovery(instance);
  refreshMediaTracks();
}

function registerHlsErrorRecovery(instance: Hls): void {
  let recoveryAttempted = false;
  instance.on(Hls.Events.ERROR, (_event, data) => {
    if (!data.fatal || hls !== instance) return;
    logDiagnostic('warn', 'hls.fatal-error', {
      type: data.type,
      details: data.details,
      message: data.error?.message,
      recoveryAttempted
    });
    if (!recoveryAttempted && data.type === Hls.ErrorTypes.NETWORK_ERROR) {
      recoveryAttempted = true;
      instance.startLoad();
      return;
    }
    if (!recoveryAttempted && data.type === Hls.ErrorTypes.MEDIA_ERROR) {
      recoveryAttempted = true;
      instance.recoverMediaError();
      return;
    }
    handleAsyncPlaybackError(new Error(data.error?.message || data.details));
  });
}

async function attachAndLoadHls(
  instance: Hls,
  media: HTMLMediaElement,
  url: string,
  timeoutMs: number
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    let settled = false;
    const timeout = window.setTimeout(() => finish(new Error('HLS manifest loading timed out')), timeoutMs);
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      instance.off(Hls.Events.MEDIA_ATTACHED, onMediaAttached);
      instance.off(Hls.Events.MANIFEST_PARSED, onManifestParsed);
      instance.off(Hls.Events.ERROR, onError);
      if (error) reject(error);
      else resolve();
    };
    const onMediaAttached = () => instance.loadSource(url);
    const onManifestParsed = () => finish();
    const onError = (_event: string, data: { fatal: boolean; error?: Error; details: string }) => {
      if (data.fatal) finish(new Error(data.error?.message || data.details));
    };
    instance.once(Hls.Events.MEDIA_ATTACHED, onMediaAttached);
    instance.once(Hls.Events.MANIFEST_PARSED, onManifestParsed);
    instance.on(Hls.Events.ERROR, onError);
    instance.attachMedia(media);
  });
}

function requiresCompatibilityFallback(probe: MediaProbeResult): boolean {
  return requiresAudioFallback(probe) || requiresVideoFallback(probe);
}

function requiresAudioFallback(probe: MediaProbeResult): boolean {
  const selected = probe.audio.find(track => track.selected) || probe.audio[0];
  return codecRequiresFallback(selected?.codec);
}

function requiresVideoFallback(probe: MediaProbeResult, trackId?: string): boolean {
  const selectedIndex = selectedVideoIndex(probe, trackId);
  const videoCodec = probe.videoMimeTypes?.[selectedIndex];
  if (!videoCodec) return true;
  const mimeType = `video/mp4; codecs="${videoCodec}${probe.audio.length ? ',mp4a.40.2' : ''}"`;
  return !MediaSource.isTypeSupported(mimeType);
}

async function resolveVideoFallback(probe: MediaProbeResult, trackId?: string): Promise<DolbyVisionPlaybackDecision> {
  const selectedIndex = selectedVideoIndex(probe, trackId);
  const dolbyVisionProfile = probe.dolbyVisionProfiles?.[selectedIndex];
  const nativeDolbyVisionSupported = dolbyVisionProfile === 5 && dolbyVisionMode === 'automatic'
    ? await supportsNativeDolbyVision(probe, selectedIndex)
    : undefined;
  return resolveDolbyVisionPlayback(
    dolbyVisionMode,
    dolbyVisionProfile,
    requiresVideoFallback(probe, trackId),
    nativeDolbyVisionSupported
  );
}

function selectedVideoIndex(probe: MediaProbeResult, trackId?: string): number {
  const requestedIndex = trackId ? probe.video.findIndex(track => track.id === trackId) : -1;
  return requestedIndex >= 0
    ? requestedIndex
    : Math.max(0, probe.video.findIndex(track => track.selected));
}

async function supportsNativeDolbyVision(probe: MediaProbeResult, selectedIndex: number): Promise<boolean> {
  const codec = probe.videoMimeTypes?.[selectedIndex];
  const track = probe.video[selectedIndex];
  if (!codec?.startsWith('dvh1.')) return false;
  const contentType = `video/mp4; codecs="${codec}"`;
  const mediaSourceSupported = MediaSource.isTypeSupported(contentType);
  const elementSupported = video.canPlayType(contentType) !== '';
  let mediaCapabilitiesSupported: boolean | undefined;
  try {
    if (navigator.mediaCapabilities?.decodingInfo) {
      const result = await navigator.mediaCapabilities.decodingInfo({
        type: 'media-source',
        video: {
          contentType,
          width: Math.max(1, track?.width || 1920),
          height: Math.max(1, track?.height || 1080),
          bitrate: Math.max(1, track?.bitrate || 20_000_000),
          framerate: 30
        }
      });
      mediaCapabilitiesSupported = result.supported;
    }
  } catch (error) {
    logDiagnostic('warn', 'dolby-vision.capability-query-failed', error);
  }
  const supported = mediaSourceSupported
    && elementSupported
    && mediaCapabilitiesSupported !== false;
  logDiagnostic('info', 'dolby-vision.capability', {
    codec,
    profile: probe.dolbyVisionProfiles?.[selectedIndex],
    level: probe.dolbyVisionLevels?.[selectedIndex],
    mediaSourceSupported,
    elementSupported,
    mediaCapabilitiesSupported,
    supported
  });
  return supported;
}

function hlsDeclaresCompatibleAudio(): boolean {
  if (!hls) return false;
  const codecs = [
    ...hls.levels.map(level => (level as unknown as { audioCodec?: string }).audioCodec),
    ...hls.audioTracks.map(track => (track as unknown as { audioCodec?: string }).audioCodec)
  ].filter((codec): codec is string => !!codec);
  return codecs.length > 0 && codecs.every(codec => !codecRequiresFallback(codec));
}

function codecRequiresFallback(value?: string): boolean {
  const codec = value?.toLowerCase().replaceAll('-', '').replaceAll('_', '') || '';
  return ['ac3', 'eac3', 'dts', 'dca', 'truehd', 'mlp'].some(unsupported => codec.includes(unsupported));
}

async function waitForCompatibilityProbe(
  probe: Promise<MediaProbeResult | undefined>
): Promise<MediaProbeResult | undefined> {
  return Promise.race([
    probe,
    new Promise<undefined>(resolve => window.setTimeout(resolve, COMPATIBILITY_PREFLIGHT_TIMEOUT_MS))
  ]);
}

async function seekToPosition(positionMs: number): Promise<void> {
  const durationMs = snapshot().durationMs;
  const bounded = Math.max(0, Math.min(durationMs || Number.POSITIVE_INFINITY, positionMs));
  if (compatibilityActive) {
    const localTarget = (bounded - compatibilityOffsetMs) / 1000;
    if (localTarget >= 0 && isTimeBuffered(video, localTarget, 0.05)) {
      const seeked = once(video, 'seeked');
      video.currentTime = localTarget;
      await Promise.race([
        seeked,
        new Promise<void>(resolve => window.setTimeout(resolve, 1_000))
      ]);
      renderPlayerControls();
      reportState();
      return;
    }
    await restartCompatibility(bounded);
    return;
  }
  video.currentTime = bounded / 1000;
  renderPlayerControls();
  reportState();
}

async function restoreNativePosition(positionMs: number): Promise<void> {
  if (video.readyState === HTMLMediaElement.HAVE_NOTHING) {
    await Promise.race([
      once(video, 'loadedmetadata'),
      wait(5_000)
    ]);
  }

  const requestedSeconds = Math.max(0, positionMs / 1000);
  const targetSeconds = Number.isFinite(video.duration) && video.duration > 0
    ? Math.min(requestedSeconds, Math.max(0, video.duration - 0.25))
    : requestedSeconds;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const seeked = once(video, 'seeked').catch(() => undefined);
    video.currentTime = targetSeconds;
    await Promise.race([seeked, wait(750)]);
    if (Math.abs(video.currentTime - targetSeconds) <= 1) return;
    await wait(150);
  }

  console.warn(`[Streamshare TV] Unable to restore native playback at ${positionMs} ms.`);
}

async function restartCompatibility(positionMs: number, resumePlayingOverride?: boolean): Promise<void> {
  const media = currentLoadParams;
  const probe = compatibilityProbe;
  if (!media || !probe) return;
  const operation = ++compatibilityOperationRevision;
  const resumePlaying = resumePlayingOverride ?? playbackRequested;
  pausePlayback(false);
  setPlaybackLoading(true);
  status = 'buffering';
  renderPlayerControls();
  reportState();

  // Release the old HTTP response before asking the main process to replace
  // its mux. Otherwise server.close() waits on the renderer that is itself
  // waiting for startCompatibilityPlayback(), adding ~2.5 s to every hand-off.
  destroyCompatibilityMediaStream();
  video.removeAttribute('src');
  video.load();

  try {
    // A seek creates a brand-new FFmpeg process. Preserve the same video
    // policy as the initial hand-off (and recompute it for a changed video
    // track), otherwise Profile 5 is remuxed natively and becomes purple.
    const videoDecision = await resolveVideoFallback(probe, selectedVideoTrackId);
    const result = await window.streamshare.startCompatibilityPlayback({
      media,
      positionMs,
      probe,
      audioTrackId: selectedAudioTrackId,
      videoTrackId: selectedVideoTrackId,
      videoTranscodeResolution,
      ...compatibilityVideoOptions(videoDecision)
    });
    if (operation !== compatibilityOperationRevision || currentLoadParams !== media) return;
    compatibilityProbe = result.tracks;
    compatibilityOffsetMs = result.sourceStartMs;
    compatibilityMimeType = result.mimeType;
    compatibilityVideoDecision = videoDecision;
    await attachCompatibilityStream(result.url, result.mimeType);

    if (operation !== compatibilityOperationRevision) return;
    await alignCompatibilityTimeline(positionMs, result.sourceStartMs);
    // Subtitle extraction is independent from the muxed A/V clock. Let the
    // restarted video resume as soon as its buffer is ready instead of adding
    // up to 2.5 s while the complete WebVTT resource is still loading.
    void refreshCompatibilitySubtitle().catch(handleAsyncPlaybackError);
    if (resumePlaying) {
      await playPlayback(false);
      status = 'playing';
    } else {
      status = 'paused';
    }
  } finally {
    if (operation === compatibilityOperationRevision) {
      setPlaybackLoading(false);
      renderPlayerControls();
      reportState();
    }
  }
}

function selectCompatibilityHlsTracks(): void {
  if (!hls) return;
  const audioIndex = selectedAudioTrackId ? parseTrackIndex(selectedAudioTrackId) : -1;
  if (audioIndex >= 0 && audioIndex < hls.audioTracks.length) hls.audioTrack = audioIndex;
}

async function switchCompatibilityAudioTrack(trackId: string): Promise<void> {
  const instance = hls;
  const track = parseTrackIndex(trackId);
  if (!instance || track < 0 || track >= instance.audioTracks.length) {
    throw new Error('The requested audio track is unavailable');
  }
  if (instance.audioTrack === track) return;

  const operation = compatibilityOperationRevision;
  const resumePlaying = playbackRequested;
  pausePlayback(false);
  setPlaybackLoading(true);
  status = 'buffering';
  renderPlayerControls();
  reportState();

  try {
    const switched = waitForHlsAudioTrack(instance, track, HLS_AUDIO_SWITCH_TIMEOUT_MS);
    // FFmpeg publishes alternate audio renditions in the master playlist.
    // hls.js flushes and replaces only its audio SourceBuffer while preserving
    // the already-decoded video timeline.
    instance.audioTrack = track;
    await switched;
    await waitForForwardBuffer(video, HLS_SWITCH_BUFFER_SECONDS, HLS_AUDIO_SWITCH_TIMEOUT_MS);
    if (operation !== compatibilityOperationRevision || hls !== instance) return;
    if (resumePlaying) {
      await playPlayback(false);
      status = 'playing';
    } else {
      status = 'paused';
    }
  } finally {
    if (operation === compatibilityOperationRevision && hls === instance) {
      setPlaybackLoading(false);
      refreshMediaTracks();
      renderPlayerControls();
      reportState();
    }
  }
}

async function waitForHlsAudioTrack(instance: Hls, track: number, timeoutMs: number): Promise<void> {
  if (instance.audioTrack === track) return;
  await new Promise<void>((resolve, reject) => {
    const timeout = window.setTimeout(() => finish(new Error('HLS track switching timed out')), timeoutMs);
    const finish = (error?: Error) => {
      window.clearTimeout(timeout);
      instance.off(Hls.Events.AUDIO_TRACK_SWITCHED, onAudioTrackSwitched);
      instance.off(Hls.Events.ERROR, onError);
      if (error) reject(error);
      else resolve();
    };
    const onAudioTrackSwitched = (_event: string, data: { id: number }) => {
      if (data.id === track) finish();
    };
    const onError = (_event: string, data: { fatal: boolean; error?: Error; details: string }) => {
      if (data.fatal) finish(new Error(data.error?.message || data.details));
    };
    instance.on(Hls.Events.AUDIO_TRACK_SWITCHED, onAudioTrackSwitched);
    instance.on(Hls.Events.ERROR, onError);
  });
}

async function waitForForwardBuffer(media: HTMLMediaElement, seconds: number, timeoutMs: number): Promise<void> {
  const deadline = performance.now() + timeoutMs;
  while (performance.now() < deadline) {
    const currentTime = media.currentTime;
    if (isTimeBuffered(media, currentTime, seconds)) return;
    await new Promise(resolve => window.setTimeout(resolve, 50));
  }
  throw new Error('HLS track buffer did not become ready');
}

function isTimeBuffered(media: HTMLMediaElement, time: number, endSafetySeconds = 0): boolean {
  for (let index = 0; index < media.buffered.length; index += 1) {
    if (time >= media.buffered.start(index) - 0.05
      && time <= media.buffered.end(index) - endSafetySeconds) return true;
  }
  return false;
}

async function alignCompatibilityTimeline(requestedPositionMs: number, sourceStartMs: number): Promise<void> {
  const firstBufferedMs = video.buffered.length > 0 ? Math.round(video.buffered.start(0) * 1000) : 0;
  // The MP4 muxer normalizes DTS to zero. The first displayed HEVC PTS can be
  // slightly positive because of frame reordering, so include the actual MSE
  // range start when mapping local media time back to the source timeline.
  compatibilityOffsetMs = sourceStartMs - firstBufferedMs;
  const localTarget = Math.max(0, (requestedPositionMs - compatibilityOffsetMs) / 1000);
  const deadline = performance.now() + 8_000;
  while (!isTimeBuffered(video, localTarget, 0.05) && performance.now() < deadline) await wait(50);
  if (!isTimeBuffered(video, localTarget, 0.05)) {
    throw new Error('The synchronized seek point did not become buffered');
  }
  if (Math.abs(video.currentTime - localTarget) < 0.01) return;
  const seeked = once(video, 'seeked');
  video.currentTime = localTarget;
  await Promise.race([
    seeked,
    new Promise<void>(resolve => window.setTimeout(resolve, 1_000))
  ]);
}

function refreshMediaTracks(): void {
  if (compatibilityActive && compatibilityProbe) {
    mediaTracks = {
      audio: compatibilityProbe.audio.map(track => ({
        ...track,
        selected: track.id === (selectedAudioTrackId || compatibilityProbe?.audio[0]?.id)
      })),
      video: compatibilityProbe.video.map(track => ({
        ...track,
        selected: track.id === (selectedVideoTrackId || compatibilityProbe?.video[0]?.id)
      })),
      subtitles: [
        { id: 'subtitle:off', type: 'subtitle', label: tr('off'), selected: !selectedSubtitleTrackId, supported: true },
        ...compatibilityProbe.subtitles.map(track => ({
          ...track,
          selected: track.id === selectedSubtitleTrackId
        }))
      ]
    };
    renderTracks();
    return;
  }
  if (compatibilityProbe && !hls) {
    mediaTracks = {
      audio: compatibilityProbe.audio.map(track => ({
        ...track,
        selected: track.id === (selectedAudioTrackId || compatibilityProbe?.audio[0]?.id)
      })),
      video: compatibilityProbe.video.map(track => ({
        ...track,
        selected: track.id === (selectedVideoTrackId || compatibilityProbe?.video[0]?.id)
      })),
      subtitles: [
        { id: 'subtitle:off', type: 'subtitle', label: tr('off'), selected: true, supported: true },
        ...compatibilityProbe.subtitles
      ]
    };
    renderTracks();
    return;
  }
  if (hls) {
    mediaTracks = {
      audio: hls.audioTracks.map((track, index) => {
        const values = track as unknown as Record<string, unknown>;
        return {
          id: `audio:${index}`,
          type: 'audio',
          label: String(values.name || values.lang || `${tr('audioTracks')} ${index + 1}`),
          language: optionalString(values.lang),
          codec: optionalString(values.audioCodec),
          selected: hls?.audioTrack === index,
          supported: true
        } satisfies RemoteMediaTrack;
      }),
      video: [
        {
          id: 'video:auto', type: 'video', label: tr('automatic'),
          selected: hls.autoLevelEnabled, supported: true
        },
        ...hls.levels.map((level, index) => {
          const values = level as unknown as Record<string, unknown>;
          const height = optionalNumber(values.height);
          return {
            id: `video:${index}`,
            type: 'video',
            label: String(values.name || (height ? `${height}p` : `${tr('videoTracks')} ${index + 1}`)),
            codec: optionalString(values.videoCodec),
            bitrate: optionalNumber(values.bitrate),
            width: optionalNumber(values.width),
            height,
            selected: !hls?.autoLevelEnabled && hls?.currentLevel === index,
            supported: true
          } satisfies RemoteMediaTrack;
        })
      ],
      subtitles: [
        { id: 'subtitle:off', type: 'subtitle', label: tr('off'), selected: hls.subtitleTrack === -1, supported: true },
        ...hls.subtitleTracks.map((track, index) => {
          const values = track as unknown as Record<string, unknown>;
          return {
            id: `subtitle:${index}`,
            type: 'subtitle',
            label: String(values.name || values.lang || `${tr('subtitleTracks')} ${index + 1}`),
            language: optionalString(values.lang),
            selected: hls?.subtitleTrack === index,
            supported: true
          } satisfies RemoteMediaTrack;
        })
      ]
    };
  } else {
    const subtitles = Array.from(video.textTracks).map((track, index) => ({
      id: `subtitle:${index}`,
      type: 'subtitle' as const,
      label: track.label || track.language || `${tr('subtitleTracks')} ${index + 1}`,
      language: track.language || undefined,
      selected: track.mode === 'showing',
      supported: true
    }));
    mediaTracks = {
      audio: [],
      video: [{ id: 'video:auto', type: 'video', label: tr('automatic'), selected: true, supported: true }],
      subtitles: [
        { id: 'subtitle:off', type: 'subtitle', label: tr('off'), selected: !subtitles.some(track => track.selected), supported: true },
        ...subtitles
      ]
    };
  }
  renderTracks();
}

function renderTracks(): void {
  renderTrackGroup(audioTracksContainer, mediaTracks.audio);
  renderTrackGroup(videoTracksContainer, mediaTracks.video);
  renderTrackGroup(subtitleTracksContainer, mediaTracks.subtitles);
}

function renderTrackGroup(container: HTMLElement, tracks: RemoteMediaTrack[]): void {
  container.parentElement!.hidden = tracks.length === 0;
  container.replaceChildren(...tracks.map(track => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'track-option';
    button.dataset.remoteControl = `track:${track.type}:${track.id}`;
    button.textContent = track.label;
    button.title = [track.label, track.language, track.codec].filter(Boolean).join(' · ');
    button.disabled = !track.supported;
    button.setAttribute('aria-pressed', String(track.selected));
    button.addEventListener('click', () => void selectMediaTrack(track.type, track.id).catch(handleAsyncPlaybackError));
    return button;
  }));
}

async function selectMediaTrack(type: RemoteTrackType, trackId: string): Promise<void> {
  if (compatibilityActive) {
    if (type === 'audio') {
      const previousTrackId = selectedAudioTrackId;
      selectedAudioTrackId = trackId;
      try {
        if (hls) await switchCompatibilityAudioTrack(trackId);
        else await restartCompatibility(snapshot().positionMs);
      } catch (error) {
        selectedAudioTrackId = previousTrackId;
        refreshMediaTracks();
        throw error;
      }
    } else if (type === 'video') {
      selectedVideoTrackId = trackId;
      await restartCompatibility(snapshot().positionMs);
    } else {
      selectedSubtitleTrackId = trackId === 'subtitle:off' ? undefined : trackId;
      await refreshCompatibilitySubtitle();
    }
  } else if (compatibilityProbe && currentLoadParams && !hls) {
    if (type === 'audio') selectedAudioTrackId = trackId;
    else if (type === 'video') selectedVideoTrackId = trackId;
    else if (trackId === 'subtitle:off') return;
    else selectedSubtitleTrackId = trackId;
    await activateCompatibility(currentLoadParams, compatibilityProbe, snapshot().positionMs, playbackRequested);
  } else if (type === 'audio' && hls) {
    hls.audioTrack = parseTrackIndex(trackId);
  } else if (type === 'video' && hls) {
    hls.currentLevel = trackId === 'video:auto' ? -1 : parseTrackIndex(trackId);
  } else if (type === 'subtitle') {
    const index = trackId === 'subtitle:off' ? -1 : parseTrackIndex(trackId);
    if (hls) hls.subtitleTrack = index;
    else Array.from(video.textTracks).forEach((track, candidate) => {
      track.mode = candidate === index ? 'showing' : 'disabled';
    });
  }
  refreshMediaTracks();
  reportState();
}

function removeCompatibilitySubtitles(): void {
  compatibilitySubtitleRevision += 1;
  clearCompatibilitySubtitles();
}

function clearCompatibilitySubtitles(): void {
  const elements = Array.from(video.querySelectorAll<HTMLTrackElement>('track[data-compatibility-subtitle]'));
  const tracks = new Set<TextTrack>([
    ...compatibilityTextTracks,
    ...elements.map(element => element.track)
  ]);
  for (const track of tracks) disableCompatibilityTextTrack(track);
  for (const element of elements) element.remove();
  compatibilityTextTracks.clear();
}

function disableCompatibilityTextTrack(track: TextTrack): void {
  track.mode = 'disabled';
  if (!track.cues) return;
  for (const cue of Array.from(track.cues)) {
    try { track.removeCue(cue); } catch { /* Chromium may already have detached this cue. */ }
  }
}

async function attachCompatibilitySubtitle(url: string, operation: number, trackId: string): Promise<void> {
  clearCompatibilitySubtitles();
  if (operation !== compatibilitySubtitleRevision || selectedSubtitleTrackId !== trackId) return;
  const track = document.createElement('track');
  track.kind = 'subtitles';
  track.src = url;
  track.default = true;
  track.dataset.compatibilitySubtitle = 'true';
  video.append(track);
  compatibilityTextTracks.add(track.track);
  track.track.mode = 'showing';
  await Promise.race([
    once(track, 'load').catch(() => undefined),
    new Promise<void>(resolve => window.setTimeout(resolve, 2_500))
  ]);
  if (operation !== compatibilitySubtitleRevision || selectedSubtitleTrackId !== trackId) {
    disableCompatibilityTextTrack(track.track);
    compatibilityTextTracks.delete(track.track);
    track.remove();
  }
}

async function refreshCompatibilitySubtitle(): Promise<void> {
  const operation = ++compatibilitySubtitleRevision;
  clearCompatibilitySubtitles();
  const media = currentLoadParams;
  const trackId = selectedSubtitleTrackId;
  if (!compatibilityActive || !media || !trackId) return;
  const result = await window.streamshare.startCompatibilitySubtitle({
    media,
    positionMs: compatibilityOffsetMs,
    trackId,
    preserveTimeline: false
  });
  if (operation !== compatibilitySubtitleRevision || selectedSubtitleTrackId !== trackId) return;
  await attachCompatibilitySubtitle(result.url, operation, trackId);
}

function setTracksPanelOpen(open: boolean): void {
  tracksPanelOpen = open;
  tracksPanel.hidden = !open;
  tracksToggle.setAttribute('aria-expanded', String(open));
  tracksToggle.setAttribute('aria-pressed', String(open));
  showPlayerControls();
  if (open) {
    clearControlsIdleTimeout();
    refreshMediaTracks();
    const selected = tracksPanel.querySelector<HTMLElement>('[aria-pressed="true"]');
    if (selected) setRemoteFocus(selected);
  } else {
    if (tracksPanel.contains(remoteFocusedElement() || null)) setRemoteFocus(tracksToggle);
    schedulePlayerControlsHide();
  }
  reportState();
}

async function navigateInterface(action: 'up' | 'down' | 'left' | 'right' | 'select' | 'back'): Promise<void> {
  const controlsWereVisible = controlsVisible;
  if (action === 'back') {
    if (tracksPanelOpen) setTracksPanelOpen(false);
    else if (controlsWereVisible) hidePlayerControls();
    else if (fullscreen) renderWindowState(await window.streamshare.setFullscreen(false));
    return;
  }

  showPlayerControls();

  const current = remoteFocusedElement();
  if (action === 'select') {
    if (!controlsWereVisible) {
      setRemoteFocus(playPause);
      return;
    }
    (current || playPause).click();
    return;
  }
  if (current === playerProgress && (action === 'up' || action === 'down')) {
    const offset = action === 'down' ? -10 : 10;
    const state = snapshot();
    await seekToPosition(Math.max(0, Math.min(state.durationMs || Number.POSITIVE_INFINITY, state.positionMs + offset * 1000)));
    return;
  }

  const candidates = remoteControlElements();
  if (!candidates.length) return;
  if (!current) {
    setRemoteFocus(playPause);
    return;
  }
  const next = closestControl(current, candidates, action);
  if (next) setRemoteFocus(next);
}

function closestControl(
  current: HTMLElement,
  candidates: HTMLElement[],
  direction: 'up' | 'down' | 'left' | 'right'
): HTMLElement | undefined {
  const origin = center(current.getBoundingClientRect());
  let best: { element: HTMLElement; score: number } | undefined;
  for (const candidate of candidates) {
    if (candidate === current) continue;
    const target = center(candidate.getBoundingClientRect());
    const dx = target.x - origin.x;
    const dy = target.y - origin.y;
    const primary = direction === 'left' ? -dx : direction === 'right' ? dx : direction === 'up' ? -dy : dy;
    if (primary <= 1) continue;
    const secondary = direction === 'left' || direction === 'right' ? Math.abs(dy) : Math.abs(dx);
    const score = primary + secondary * 2.5;
    if (!best || score < best.score) best = { element: candidate, score };
  }
  return best?.element;
}

function remoteControlElements(): HTMLElement[] {
  return Array.from(playerScreen.querySelectorAll<HTMLElement>('[data-remote-control]'))
    .filter(element => !element.closest('[hidden]') && !('disabled' in element && (element as HTMLButtonElement).disabled));
}

function remoteFocusedElement(): HTMLElement | undefined {
  return playerScreen.querySelector<HTMLElement>('[data-remote-control].remote-focused') || undefined;
}

function remoteFocusedControl(): string | undefined {
  return controlsVisible ? remoteFocusedElement()?.dataset.remoteControl : undefined;
}

function hidePlayerControls(): void {
  clearControlsIdleTimeout();
  controlsVisible = false;
  playerScreen.classList.remove('controls-visible');
  const focused = remoteFocusedElement();
  focused?.classList.remove('remote-focused');
  focused?.blur();
  reportState();
}

function setRemoteFocus(element: HTMLElement): void {
  remoteFocusedElement()?.classList.remove('remote-focused');
  element.classList.add('remote-focused');
  element.focus({ preventScroll: false });
  reportState();
}

function center(rect: DOMRect): { x: number; y: number } {
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

function parseTrackIndex(trackId: string): number {
  const value = Number(trackId.slice(trackId.lastIndexOf(':') + 1));
  if (!Number.isInteger(value) || value < 0) throw new Error(`Invalid track id: ${trackId}`);
  return value;
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value ? value : undefined;
}

function optionalNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function tr(key: keyof Messages, values?: Record<string, string | number>): string {
  return translate(currentLanguage, key, values);
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeout = window.setTimeout(() => reject(new Error(message)), timeoutMs);
    promise.then(
      value => {
        window.clearTimeout(timeout);
        resolve(value);
      },
      error => {
        window.clearTimeout(timeout);
        reject(error);
      }
    );
  });
}

function isHls(url: string): boolean {
  return /\.m3u8(?:$|[?#])/i.test(url);
}

function isMatroska(url: string, declared?: string): boolean {
  return declared?.toLowerCase().includes('matroska') === true || /\.mkv(?:$|[?#])/i.test(url);
}

function contentType(url: string, declared?: string): string {
  if (declared) return declared;
  if (/\.mp4(?:$|[?#])/i.test(url)) return 'video/mp4';
  if (/\.webm(?:$|[?#])/i.test(url)) return 'video/webm';
  if (/\.mkv(?:$|[?#])/i.test(url)) return 'video/x-matroska';
  if (/\.m3u8(?:$|[?#])/i.test(url)) return 'application/vnd.apple.mpegurl';
  return 'video/mp4';
}

function mediaProtocol(url: string): string {
  try { return new URL(url).protocol.replace(':', ''); } catch { return 'unknown'; }
}

function logDiagnostic(
  level: 'debug' | 'info' | 'warn' | 'error',
  event: string,
  details?: unknown
): void {
  window.streamshare.logDiagnostic({ level, event, details });
}

function required<T extends Element>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing #${id}`);
  return element as unknown as T;
}

function once(target: EventTarget, event: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const onSuccess = () => { cleanup(); resolve(); };
    const onError = () => { cleanup(); reject(new Error(tr('loadError'))); };
    const cleanup = () => {
      target.removeEventListener(event, onSuccess);
      target.removeEventListener('error', onError);
    };
    target.addEventListener(event, onSuccess, { once: true });
    target.addEventListener('error', onError, { once: true });
  });
}
