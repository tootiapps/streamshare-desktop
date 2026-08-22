import type { RemoteController, RemotePlaybackState, RemoteRequest } from '@streamshare/remote-protocol';
import type { LanguagePreference, SupportedLanguage } from './i18n.js';
import type { CompatibilityPlaybackRequest, CompatibilityPlaybackResult, CompatibilitySessionDiagnostics, CompatibilitySubtitleRequest, MediaFallbackDiagnostics, MediaProbeResult, VideoTranscodeResolution } from './media-fallback.js';
import type { DolbyVisionMode } from './settings-store.js';

interface PublicSettings {
  receiverId: string;
  enabled: boolean;
  deviceName: string;
  language: LanguagePreference;
  ffmpegEnabled: boolean;
  ffmpegDirectory: string;
  dolbyVisionMode: DolbyVisionMode;
  videoTranscodeResolution: VideoTranscodeResolution;
  ffmpeg: MediaFallbackDiagnostics;
  resolvedLanguage: SupportedLanguage;
  controllers: RemoteController[];
}

declare global {
  interface Window {
    streamshare: {
      getSettings(): Promise<PublicSettings>;
      updateSettings(settings: { enabled?: boolean; deviceName?: string; language?: LanguagePreference; ffmpegEnabled?: boolean; ffmpegDirectory?: string; dolbyVisionMode?: DolbyVisionMode; videoTranscodeResolution?: VideoTranscodeResolution }): Promise<PublicSettings>;
      chooseFfmpeg(): Promise<string | null>;
      openDiagnosticLogs(): Promise<void>;
      logDiagnostic(entry: { level: 'debug' | 'info' | 'warn' | 'error'; event: string; details?: unknown }): void;
      revokeController(controllerId: string): Promise<void>;
      getWindowState(): Promise<{ fullscreen: boolean }>;
      toggleFullscreen(): Promise<{ fullscreen: boolean }>;
      setFullscreen(fullscreen: boolean): Promise<{ fullscreen: boolean }>;
      probeMedia(media: CompatibilityPlaybackRequest['media']): Promise<MediaProbeResult>;
      startCompatibilityPlayback(request: CompatibilityPlaybackRequest): Promise<CompatibilityPlaybackResult>;
      startCompatibilitySubtitle(request: CompatibilitySubtitleRequest): Promise<{ url: string }>;
      getCompatibilityDiagnostics(): Promise<CompatibilitySessionDiagnostics>;
      stopCompatibilityPlayback(): Promise<void>;
      completeCommand(requestId: string, state?: RemotePlaybackState, error?: string): void;
      reportState(state: RemotePlaybackState): void;
      onCommand(listener: (request: RemoteRequest) => void): () => void;
      onPairingCode(listener: (pairing: { code: string; controllerName: string; expiresAt: number } | null) => void): () => void;
      onSettingsChanged(listener: (settings: PublicSettings) => void): () => void;
      onWindowStateChanged(listener: (state: { fullscreen: boolean }) => void): () => void;
      onOpenNetworkStream(listener: () => void): () => void;
      onToggleTechnicalInformation(listener: () => void): () => void;
    };
  }
}

export {};
