import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { RemoteController } from '@streamshare/remote-protocol';
import { SUPPORTED_LANGUAGES, type LanguagePreference, type SupportedLanguage } from './i18n.js';
import type { VideoTranscodeResolution } from './media-fallback.js';

export interface StoredController extends RemoteController {
  tokenDigest: string;
}

export type DolbyVisionMode = 'automatic' | 'native' | 'sdr';

export interface ReceiverSettings {
  receiverId: string;
  enabled: boolean;
  deviceName: string;
  language: LanguagePreference;
  ffmpegEnabled: boolean;
  ffmpegDirectory?: string;
  dolbyVisionMode: DolbyVisionMode;
  videoTranscodeResolution: VideoTranscodeResolution;
  announcementUpdatedAt: number;
  controllers: StoredController[];
}

export class SettingsStore {
  private settings?: ReceiverSettings;

  constructor(private readonly path: string, private readonly defaultName: string) {}

  async load(): Promise<ReceiverSettings> {
    if (this.settings) return this.settings;
    try {
      const parsed = JSON.parse(await readFile(this.path, 'utf8')) as Partial<ReceiverSettings>;
      this.settings = {
        receiverId: parsed.receiverId || randomUUID(),
        enabled: parsed.enabled ?? true,
        deviceName: parsed.deviceName?.trim() || this.defaultName,
        language: validLanguage(parsed.language),
        ffmpegEnabled: parsed.ffmpegEnabled ?? true,
        ffmpegDirectory: normalizedOptionalPath(parsed.ffmpegDirectory),
        dolbyVisionMode: validDolbyVisionMode(parsed.dolbyVisionMode),
        videoTranscodeResolution: validVideoTranscodeResolution(parsed.videoTranscodeResolution),
        announcementUpdatedAt: parsed.announcementUpdatedAt || Date.now(),
        controllers: Array.isArray(parsed.controllers) ? parsed.controllers : []
      };
    } catch {
      this.settings = {
        receiverId: randomUUID(),
        enabled: true,
        deviceName: this.defaultName,
        language: 'system',
        ffmpegEnabled: true,
        dolbyVisionMode: 'automatic',
        videoTranscodeResolution: 'source',
        announcementUpdatedAt: Date.now(),
        controllers: []
      };
      await this.save();
    }
    return this.settings;
  }

  async update(patch: Partial<Pick<ReceiverSettings, 'enabled' | 'deviceName' | 'language' | 'ffmpegEnabled' | 'ffmpegDirectory' | 'dolbyVisionMode' | 'videoTranscodeResolution'>>): Promise<ReceiverSettings> {
    const settings = await this.load();
    if (patch.enabled !== undefined) settings.enabled = patch.enabled;
    if (patch.deviceName !== undefined) {
      const deviceName = patch.deviceName.trim() || this.defaultName;
      if (deviceName !== settings.deviceName) settings.announcementUpdatedAt = Date.now();
      settings.deviceName = deviceName;
    }
    if (patch.language !== undefined) settings.language = validLanguage(patch.language);
    if (patch.ffmpegEnabled !== undefined) settings.ffmpegEnabled = patch.ffmpegEnabled;
    if (patch.dolbyVisionMode !== undefined) settings.dolbyVisionMode = validDolbyVisionMode(patch.dolbyVisionMode);
    if (patch.videoTranscodeResolution !== undefined) {
      settings.videoTranscodeResolution = validVideoTranscodeResolution(patch.videoTranscodeResolution);
    }
    if (patch.ffmpegDirectory !== undefined) {
      settings.ffmpegDirectory = normalizedOptionalPath(patch.ffmpegDirectory);
    }
    await this.save();
    return settings;
  }

  async authorize(controller: StoredController): Promise<void> {
    const settings = await this.load();
    settings.controllers = settings.controllers.filter(item => item.id !== controller.id);
    settings.controllers.push(controller);
    await this.save();
  }

  async touchController(id: string): Promise<void> {
    const controller = (await this.load()).controllers.find(item => item.id === id);
    if (!controller) return;
    controller.lastSeenAt = Date.now();
    await this.save();
  }

  async revoke(id: string): Promise<void> {
    const settings = await this.load();
    settings.controllers = settings.controllers.filter(item => item.id !== id);
    await this.save();
  }

  private async save(): Promise<void> {
    if (!this.settings) return;
    await mkdir(dirname(this.path), { recursive: true });
    const temporaryPath = `${this.path}.tmp`;
    await writeFile(temporaryPath, JSON.stringify(this.settings, null, 2), { mode: 0o600 });
    await rename(temporaryPath, this.path);
  }
}

function normalizedOptionalPath(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  return value.trim() || undefined;
}

function validLanguage(value: unknown): LanguagePreference {
  return value === 'system' || SUPPORTED_LANGUAGES.includes(value as SupportedLanguage)
    ? value as LanguagePreference
    : 'system';
}

function validDolbyVisionMode(value: unknown): DolbyVisionMode {
  return value === 'native' || value === 'sdr' ? value : 'automatic';
}

function validVideoTranscodeResolution(value: unknown): VideoTranscodeResolution {
  return value === '2160p' || value === '1080p' || value === '720p' ? value : 'source';
}
