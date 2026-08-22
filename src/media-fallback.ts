import { spawn, type ChildProcess } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { createReadStream, existsSync } from 'node:fs';
import { mkdir, rm, stat } from 'node:fs/promises';
import { createServer, type Server } from 'node:http';
import { basename, dirname, extname, join } from 'node:path';
import type { AddressInfo } from 'node:net';
import { Transform } from 'node:stream';
import type { LoadMediaParams, RemoteMediaTrack } from '@streamshare/remote-protocol';
import { diagnosticLog } from './diagnostic-log.js';

export interface MediaProbeResult {
  audio: RemoteMediaTrack[];
  video: RemoteMediaTrack[];
  subtitles: RemoteMediaTrack[];
  durationMs: number;
  videoMimeTypes?: Array<string | undefined>;
  dolbyVisionProfiles?: Array<number | undefined>;
  dolbyVisionLevels?: Array<number | undefined>;
  dolbyVisionCompatibilityIds?: Array<number | undefined>;
}

export interface CompatibilityPlaybackRequest {
  media: LoadMediaParams;
  positionMs: number;
  probe?: MediaProbeResult;
  audioTrackId?: string;
  videoTrackId?: string;
  transcodeVideo?: boolean;
  toneMapDolbyVision?: boolean;
  videoTranscodeResolution?: VideoTranscodeResolution;
}

export type VideoTranscodeResolution = 'source' | '2160p' | '1080p' | '720p';

export interface CompatibilityPlaybackResult {
  url: string;
  tracks: MediaProbeResult;
  mimeType?: string;
  sourceStartMs: number;
}

export interface CompatibilitySessionDiagnostics {
  active: boolean;
  pid?: number;
  port?: number;
  startedAt?: string;
  requestedPositionMs?: number;
  sourceStartMs?: number;
  videoCodec?: string;
  audioCodec?: string;
  videoTrackId?: string;
  audioTrackId?: string;
  transcodeVideo?: boolean;
  toneMapDolbyVision?: boolean;
  videoEncoder?: string;
  videoTranscodeResolution?: VideoTranscodeResolution;
  targetResolution?: string;
  streamClaimed?: boolean;
  stderr?: string;
}

export interface CompatibilitySubtitleRequest {
  media: LoadMediaParams;
  positionMs: number;
  trackId: string;
  preserveTimeline?: boolean;
}

export interface MediaFallbackDiagnostics {
  available: boolean;
  version?: string;
  path: string;
  source?: 'custom' | 'environment' | 'bundled' | 'system';
  nonfree?: boolean;
  videoEncoder?: string;
  dolbyVisionToneMapping?: boolean;
  dolbyVisionToneMappingError?: string;
  error?: string;
}

export interface ProbeStream {
  index: number;
  codec_type?: string;
  codec_name?: string;
  profile?: string;
  level?: number;
  width?: number;
  height?: number;
  bit_rate?: string;
  tags?: { language?: string; title?: string };
  disposition?: { default?: number };
  side_data_list?: Array<{
    side_data_type?: string;
    dv_profile?: number;
    dv_level?: number;
    dv_bl_signal_compatibility_id?: number;
  }>;
}

interface FallbackSession {
  process: ChildProcess;
  server?: Server;
  directory: string;
  stderr: string;
  port?: number;
  streamClaimed?: boolean;
  subtitle?: CompatibilitySubtitleRequest;
  subtitleIndexes?: Set<number>;
  diagnostics: Omit<CompatibilitySessionDiagnostics, 'active' | 'pid' | 'port' | 'streamClaimed' | 'stderr'>;
}

export class MediaFallback {
  private active?: FallbackSession;
  private readonly sessions = new Set<FallbackSession>();
  private videoEncoder?: string;
  private dolbyVisionToneMapping = false;

  constructor(
    private readonly cacheDirectory: string,
    private readonly ffmpegPath: string,
    private readonly ffprobePath: string,
    private readonly source: MediaFallbackDiagnostics['source'] = 'system'
  ) {}

  async initialize(staleDirectories: string[] = []): Promise<void> {
    await this.stop();
    const directories = new Set([this.cacheDirectory, ...staleDirectories]);
    // A stale file briefly locked by the OS must not prevent the receiver from
    // starting. The rolling HLS window still bounds any directory that could
    // not be removed during this best-effort migration cleanup.
    await Promise.allSettled([...directories].map(directory => rm(directory, {
      recursive: true, force: true, maxRetries: 5, retryDelay: 100
    })));
    await mkdir(this.cacheDirectory, { recursive: true });
  }

  async diagnostics(): Promise<MediaFallbackDiagnostics> {
    diagnosticLog('info', 'ffmpeg.diagnostics-start', { path: this.ffmpegPath, source: this.source });
    try {
      // A freshly installed unsigned executable may be scanned on first launch,
      // especially on a virtualized Windows machine. Keep the startup probe
      // bounded, but allow enough time for that one-time inspection.
      const timeoutMs = process.platform === 'win32' ? 15_000 : 6_000;
      const [ffmpegVersion, , encoders, filters] = await Promise.all([
        runAndCollect(this.ffmpegPath, ['-version'], timeoutMs),
        runAndCollect(this.ffprobePath, ['-version'], timeoutMs),
        runAndCollect(this.ffmpegPath, ['-encoders'], timeoutMs),
        runAndCollect(this.ffmpegPath, ['-filters'], timeoutMs)
      ]);
      this.videoEncoder = preferredH264Encoder(encoders);
      const toneMapping = await probeDolbyVisionToneMapping(this.ffmpegPath, filters, timeoutMs);
      this.dolbyVisionToneMapping = toneMapping.available;
      diagnosticLog('info', 'ffmpeg.diagnostics-ready', {
        source: this.source,
        videoEncoder: this.videoEncoder,
        dolbyVisionToneMapping: toneMapping.available,
        dolbyVisionToneMappingError: toneMapping.error,
        version: ffmpegVersion.split(/\r?\n/, 1)[0]
      });
      return {
        available: true,
        version: ffmpegVersion.split(/\r?\n/, 1)[0]?.replace(/^ffmpeg version\s+/i, ''),
        path: this.ffmpegPath,
        source: this.source,
        nonfree: /(?:^|\s)--enable-nonfree(?:\s|$)/m.test(ffmpegVersion),
        videoEncoder: this.videoEncoder,
        dolbyVisionToneMapping: toneMapping.available,
        dolbyVisionToneMappingError: toneMapping.error
      };
    } catch (error) {
      this.dolbyVisionToneMapping = false;
      diagnosticLog('error', 'ffmpeg.diagnostics-failed', error);
      return {
        available: false,
        path: this.ffmpegPath,
        source: this.source,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  async probe(media: LoadMediaParams): Promise<MediaProbeResult> {
    const startedAt = Date.now();
    diagnosticLog('info', 'ffprobe.started', {
      protocol: mediaProtocol(media.url),
      headerNames: Object.keys(media.headers || {})
    });
    const args = [
      '-v', 'error', '-probesize', '8M', '-analyzeduration', '8000000',
      ...inputNetworkArgs(media),
      '-show_streams', '-show_format', '-of', 'json', media.url
    ];
    try {
      const output = await runAndCollect(this.ffprobePath, args, 12_000);
      const parsed = JSON.parse(output) as { streams?: ProbeStream[]; format?: { duration?: string } };
      const streams = parsed.streams || [];
      const videoStreams = streams.filter(stream => stream.codec_type === 'video');
      const result = {
        audio: normalizeProbeTracks(streams.filter(stream => stream.codec_type === 'audio'), 'audio'),
        video: normalizeProbeTracks(videoStreams, 'video'),
        subtitles: normalizeSubtitleTracks(streams.filter(stream => stream.codec_type === 'subtitle')),
        durationMs: Math.max(0, Math.round(Number(parsed.format?.duration || 0) * 1000)),
        videoMimeTypes: videoStreams.map(fragmentedMp4VideoCodec),
        dolbyVisionProfiles: videoStreams.map(stream => dolbyVisionConfiguration(stream)?.profile),
        dolbyVisionLevels: videoStreams.map(stream => dolbyVisionConfiguration(stream)?.level),
        dolbyVisionCompatibilityIds: videoStreams.map(stream => dolbyVisionConfiguration(stream)?.compatibilityId)
      };
      diagnosticLog('info', 'ffprobe.completed', {
        elapsedMs: Date.now() - startedAt,
        durationMs: result.durationMs,
        video: result.video.map((track, index) => ({
          codec: track.codec,
          width: track.width,
          height: track.height,
          dolbyVisionProfile: result.dolbyVisionProfiles[index],
          dolbyVisionLevel: result.dolbyVisionLevels[index],
          dolbyVisionCompatibilityId: result.dolbyVisionCompatibilityIds[index]
        })),
        audio: result.audio.map(track => ({ codec: track.codec, language: track.language })),
        subtitles: result.subtitles.map(track => ({ codec: track.codec, language: track.language }))
      });
      return result;
    } catch (error) {
      diagnosticLog('error', 'ffprobe.failed', { elapsedMs: Date.now() - startedAt, error });
      throw error;
    }
  }

  async start(request: CompatibilityPlaybackRequest): Promise<CompatibilityPlaybackResult> {
    const tracks = request.probe || await this.probe(request.media);
    if (!tracks.video.length) throw new Error('No video stream is available');
    const selectedVideoIndex = selectedTypeIndex(tracks.video, request.videoTrackId);
    const selectedAudioIndex = selectedTypeIndex(tracks.audio, request.audioTrackId);
    const sourceStartMs = request.positionMs > 0
      ? await this.probeSeekStart(request.media, request.positionMs, selectedVideoIndex)
      : 0;

    // A restart is an explicit hand-off. Stop the current mux before spawning
    // its replacement so seeks and track changes never leave two FFmpeg jobs
    // reading and transcoding the same remote 4K source in parallel.
    const activeSessions = [...this.sessions];
    this.active = undefined;
    await Promise.all(activeSessions.map(session => this.dispose(session)));

    const id = randomUUID();
    const directory = join(this.cacheDirectory, id);
    await mkdir(directory, { recursive: true });
    const mapArgs = [
      '-map', `0:v:${selectedVideoIndex}?`,
      ...(tracks.audio.length ? ['-map', `0:a:${selectedAudioIndex}?`] : [])
    ];
    const selectedVideoCodec = tracks.video[selectedVideoIndex]?.codec?.toLowerCase();
    const selectedDolbyVisionProfile = tracks.dolbyVisionProfiles?.[selectedVideoIndex];
    if (request.toneMapDolbyVision && !request.transcodeVideo) {
      throw new Error('Dolby Vision tone mapping requires video transcoding');
    }
    if (request.transcodeVideo && selectedDolbyVisionProfile === 5 && !request.toneMapDolbyVision) {
      diagnosticLog('error', 'ffmpeg.dolby-vision-unsupported', {
        profile: selectedDolbyVisionProfile,
        reason: 'explicit-tone-mapping-required'
      });
      throw new Error(
        'Dolby Vision Profile 5 requires explicit GPU tone mapping before video transcoding'
      );
    }
    if (request.toneMapDolbyVision && !this.dolbyVisionToneMapping) {
      diagnosticLog('error', 'ffmpeg.dolby-vision-tone-mapping-unavailable', {
        profile: selectedDolbyVisionProfile
      });
      throw new Error('Dolby Vision SDR conversion requires an FFmpeg build with working libplacebo support');
    }
    const videoTagArgs = !request.transcodeVideo && ['hevc', 'h265'].includes(selectedVideoCodec || '')
      ? ['-tag:v:0', selectedDolbyVisionProfile ? 'dvh1' : 'hvc1']
      : [];
    const selectedVideoTrack = tracks.video[selectedVideoIndex];
    const transcodePlan = request.transcodeVideo
      ? h264TranscodePlan(
          this.videoEncoder,
          request.toneMapDolbyVision === true,
          request.videoTranscodeResolution,
          selectedVideoTrack?.width,
          selectedVideoTrack?.height
        )
      : undefined;
    const videoOutputArgs = transcodePlan
      ? transcodePlan.args
      : ['-c:v', 'copy'];
    diagnosticLog('info', 'ffmpeg.playback-start', {
      protocol: mediaProtocol(request.media.url),
      positionMs: request.positionMs,
      videoCodec: selectedVideoCodec,
      audioCodec: tracks.audio[selectedAudioIndex]?.codec,
      transcodeVideo: request.transcodeVideo === true,
      toneMapDolbyVision: request.toneMapDolbyVision === true,
      videoEncoder: request.transcodeVideo ? this.videoEncoder : 'copy',
      videoTranscodeResolution: request.videoTranscodeResolution || 'source',
      targetResolution: transcodePlan ? `${transcodePlan.width}x${transcodePlan.height}` : undefined,
      dolbyVisionProfile: selectedDolbyVisionProfile,
      videoTrackId: tracks.video[selectedVideoIndex]?.id,
      audioTrackId: tracks.audio[selectedAudioIndex]?.id
    });
    const subtitleIndexes = new Set(tracks.subtitles
      .map((track, index) => track.supported ? index : -1)
      .filter(index => index >= 0));
    const subtitleOutputArgs = [...subtitleIndexes].flatMap(index => [
      '-map', `0:s:${index}`,
      '-c:s', 'webvtt',
      '-f', 'webvtt', '-flush_packets', '1', join(directory, `subtitle-${index}.vtt`)
    ]);
    const args = [
      '-hide_banner', '-loglevel', 'warning', '-y', '-copyts',
      ...(request.positionMs > 0
        ? ['-ss', (request.positionMs / 1000).toFixed(3), '-noaccurate_seek']
        : []),
      // ffprobe already discovered the streams. Repeating FFmpeg's default,
      // comparatively long analysis made every remote seek and track switch
      // pay several avoidable seconds on large MKV files.
      '-probesize', '1M', '-analyzeduration', '1000000',
      // The renderer consumes this response through MSE and provides bounded
      // backpressure itself. Artificially limiting FFmpeg to exactly 1x left
      // no margin for ordinary network jitter and caused recurrent stalls.
      ...inputNetworkArgs(request.media),
      '-i', request.media.url,
      ...mapArgs,
      ...videoOutputArgs,
      ...videoTagArgs,
      '-c:a', 'aac', '-ac', '2', '-b:a', '192k', '-sn',
      // A single continuous fragmented MP4 keeps A/V in one timestamp domain.
      // Half-second moofs are valid inside the continuous byte stream even when
      // they do not begin on a HEVC keyframe, unlike independently fetched HLS
      // fragments. This removes the GOP-sized startup penalty without creating
      // MSE holes or a second media clock.
      '-movflags', 'empty_moov+default_base_moof',
      ...(selectedDolbyVisionProfile && !request.transcodeVideo ? ['-strict', 'unofficial'] : []),
      '-frag_duration', '500000',
      '-f', 'mp4', 'pipe:1',
      ...subtitleOutputArgs
    ];
    const spawnedAt = Date.now();
    const session: FallbackSession = {
      process: spawn(this.ffmpegPath, args, {
        stdio: ['ignore', 'pipe', 'pipe'],
        env: mediaProcessEnvironment(this.ffmpegPath)
      }),
      directory,
      stderr: '',
      subtitleIndexes,
      diagnostics: {
        startedAt: new Date(spawnedAt).toISOString(),
        requestedPositionMs: request.positionMs,
        sourceStartMs,
        videoCodec: selectedVideoCodec,
        audioCodec: tracks.audio[selectedAudioIndex]?.codec,
        videoTrackId: tracks.video[selectedVideoIndex]?.id,
        audioTrackId: tracks.audio[selectedAudioIndex]?.id,
        transcodeVideo: request.transcodeVideo === true,
        toneMapDolbyVision: request.toneMapDolbyVision === true,
        videoEncoder: request.transcodeVideo ? this.videoEncoder : 'copy',
        videoTranscodeResolution: request.videoTranscodeResolution || 'source',
        targetResolution: transcodePlan ? `${transcodePlan.width}x${transcodePlan.height}` : undefined
      }
    };
    this.sessions.add(session);
    session.process.stderr?.on('data', chunk => { session.stderr = `${session.stderr}${chunk}`.slice(-12_000); });
    session.process.once('error', error => diagnosticLog('error', 'ffmpeg.spawn-failed', error));
    session.process.once('close', (code, signal) => diagnosticLog(
      code === 0 || signal === 'SIGTERM' || signal === 'SIGKILL' ? 'info' : 'error',
      'ffmpeg.closed',
      { code, signal, stderr: session.stderr, streamClaimed: session.streamClaimed === true }
    ));
    session.process.stdout?.once('data', chunk => diagnosticLog('info', 'ffmpeg.first-output', {
      bytes: chunk.length,
      elapsedFromSpawnMs: Date.now() - spawnedAt
    }));
    try {
      const port = await this.startServer(session);
      session.port = port;
      this.active = session;
      return {
        url: `http://127.0.0.1:${port}/stream.mp4`,
        tracks,
        mimeType: fragmentedMp4MimeType(
          transcodePlan?.mimeType || tracks.videoMimeTypes?.[selectedVideoIndex],
          tracks.audio.length > 0
        ),
        sourceStartMs
      };
    } catch (error) {
      await this.dispose(session);
      throw error;
    }
  }

  private async probeSeekStart(media: LoadMediaParams, positionMs: number, videoIndex: number): Promise<number> {
    try {
      const start = (positionMs / 1000).toFixed(3);
      const output = await runAndCollect(this.ffprobePath, [
        '-v', 'error', '-probesize', '256K', '-analyzeduration', '200000',
        ...inputNetworkArgs(media),
        '-read_intervals', `${start}%+0.05`,
        '-select_streams', `v:${videoIndex}`,
        '-show_packets', '-show_entries', 'packet=pts_time,flags',
        '-of', 'json', media.url
      ], 6_000);
      const parsed = JSON.parse(output) as { packets?: Array<{ pts_time?: string; flags?: string }> };
      const keyframe = parsed.packets?.find(packet => packet.flags?.includes('K'));
      const timestampMs = Math.round(Number(keyframe?.pts_time) * 1000);
      if (Number.isFinite(timestampMs) && timestampMs >= 0 && timestampMs <= positionMs) return timestampMs;
    } catch { /* Falling back still preserves A/V sync, only seek precision is reduced. */ }
    return positionMs;
  }

  async stop(): Promise<void> {
    const sessions = [...this.sessions];
    this.active = undefined;
    await Promise.all(sessions.map(session => this.dispose(session)));
  }

  currentDiagnostics(): CompatibilitySessionDiagnostics {
    const session = this.active;
    if (!session) return { active: false };
    return {
      active: true,
      ...session.diagnostics,
      pid: session.process.pid,
      port: session.port,
      streamClaimed: session.streamClaimed === true,
      stderr: session.stderr.slice(-4_000) || undefined
    };
  }

  configureSubtitle(request: CompatibilitySubtitleRequest): { url: string } {
    const session = this.active;
    if (!session?.port) throw new Error('FFmpeg session is unavailable');
    const index = Number(request.trackId.slice(request.trackId.lastIndexOf(':') + 1));
    if (!Number.isInteger(index) || index < 0) throw new Error('Invalid subtitle track');
    if (!session.subtitleIndexes?.has(index)) throw new Error('Unsupported subtitle track');
    session.subtitle = request;
    return { url: `http://127.0.0.1:${session.port}/subtitle.vtt?v=${randomUUID()}` };
  }

  private async dispose(session: FallbackSession): Promise<void> {
    if (!this.sessions.delete(session)) return;
    await stopChildProcess(session.process);
    if (session.server) await closeServer(session.server);
    await rm(session.directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }

  private async startServer(session: FallbackSession): Promise<number> {
    session.server = createServer(async (request, response) => {
      const requestUrl = new URL(request.url || '/', 'http://localhost');
      if (requestUrl.pathname === '/subtitle.vtt') {
        this.streamSubtitleFile(session, response);
        return;
      }
      if (requestUrl.pathname === '/stream.mp4') {
        if (session.streamClaimed || !session.process.stdout) {
          response.writeHead(409, { 'Cache-Control': 'no-store' }).end();
          return;
        }
        session.streamClaimed = true;
        response.writeHead(200, {
          'Content-Type': 'video/mp4',
          'Cache-Control': 'no-store',
          'Access-Control-Allow-Origin': '*',
          'Accept-Ranges': 'none'
        });
        session.process.stdout.pipe(response);
        return;
      }
      const fileName = basename(requestUrl.pathname);
      if (!fileName || fileName === '.' || fileName === '..') {
        response.writeHead(404).end();
        return;
      }
      const path = join(session.directory, fileName);
      try {
        const info = await stat(path);
        response.writeHead(200, {
          'Content-Type': mediaType(path),
          'Content-Length': info.size,
          'Cache-Control': 'no-store',
          'Access-Control-Allow-Origin': '*'
        });
        createReadStream(path).pipe(response);
      } catch {
        response.writeHead(404, { 'Cache-Control': 'no-store' }).end();
      }
    });
    await new Promise<void>((resolve, reject) => {
      session.server?.once('error', reject);
      session.server?.listen(0, '127.0.0.1', resolve);
    });
    return (session.server.address() as AddressInfo).port;
  }

  private streamSubtitleFile(session: FallbackSession, response: import('node:http').ServerResponse): void {
    const subtitle = session.subtitle;
    if (!subtitle) {
      response.writeHead(404).end();
      return;
    }
    const index = Number(subtitle.trackId.slice(subtitle.trackId.lastIndexOf(':') + 1));
    response.writeHead(200, {
      'Content-Type': 'text/vtt; charset=utf-8',
      'Cache-Control': 'no-store',
      'Access-Control-Allow-Origin': '*'
    });
    const path = join(session.directory, `subtitle-${index}.vtt`);
    const timeline = new WebVttTimelineTransform(subtitle.positionMs);
    timeline.pipe(response);
    let closed = false;
    response.once('close', () => {
      closed = true;
      timeline.destroy();
    });
    void tailFile(path, timeline, response, () => closed, session.process).catch(() => {
      if (!closed) response.end();
    });
  }
}

async function tailFile(
  path: string,
  output: Transform,
  response: import('node:http').ServerResponse,
  isClosed: () => boolean,
  process: ChildProcess
): Promise<void> {
  let offset = 0;
  while (!isClosed()) {
    let size = 0;
    try { size = (await stat(path)).size; } catch { /* FFmpeg has not opened this output yet. */ }
    if (size > offset) {
      await pipeFileRange(path, offset, size - 1, output, response, isClosed);
      offset = size;
    }
    const ended = process.exitCode !== null || process.signalCode !== null;
    if (ended) {
      if (!isClosed()) output.end();
      return;
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
}

function pipeFileRange(
  path: string,
  start: number,
  end: number,
  output: Transform,
  response: import('node:http').ServerResponse,
  isClosed: () => boolean
): Promise<void> {
  if (isClosed()) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const input = createReadStream(path, { start, end });
    const finish = () => {
      response.off('close', onResponseClose);
      resolve();
    };
    const onResponseClose = () => {
      input.destroy();
      finish();
    };
    input.once('error', error => {
      response.off('close', onResponseClose);
      reject(error);
    });
    input.once('end', finish);
    response.once('close', onResponseClose);
    input.pipe(output, { end: false });
  });
}

class WebVttTimelineTransform extends Transform {
  private pending = '';

  constructor(private readonly timelineOffsetMs: number) {
    super();
  }

  override _transform(chunk: Buffer, _encoding: BufferEncoding, callback: (error?: Error | null) => void): void {
    this.pending += chunk.toString('utf8');
    const lines = this.pending.split(/\r?\n/);
    this.pending = lines.pop() || '';
    if (lines.length) this.push(`${lines.map(line => offsetWebVttLine(line, this.timelineOffsetMs)).join('\n')}\n`);
    callback();
  }

  override _flush(callback: (error?: Error | null) => void): void {
    if (this.pending) this.push(offsetWebVttLine(this.pending, this.timelineOffsetMs));
    callback();
  }
}

function offsetWebVttLine(line: string, offsetMs: number): string {
  return line.replace(
    /((?:\d{2}:)?\d{2}:\d{2}\.\d{3})\s+-->\s+((?:\d{2}:)?\d{2}:\d{2}\.\d{3})/,
    (_match, start: string, end: string) => `${formatWebVttTime(parseWebVttTime(start) - offsetMs)} --> ${formatWebVttTime(parseWebVttTime(end) - offsetMs)}`
  );
}

function parseWebVttTime(value: string): number {
  const parts = value.split(':');
  const seconds = Number(parts.pop() || 0);
  const minutes = Number(parts.pop() || 0);
  const hours = Number(parts.pop() || 0);
  return Math.round((hours * 3600 + minutes * 60 + seconds) * 1000);
}

function formatWebVttTime(valueMs: number): string {
  const totalMs = Math.max(0, Math.round(valueMs));
  const hours = Math.floor(totalMs / 3_600_000);
  const minutes = Math.floor((totalMs % 3_600_000) / 60_000);
  const seconds = Math.floor((totalMs % 60_000) / 1000);
  const milliseconds = totalMs % 1000;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(milliseconds).padStart(3, '0')}`;
}

function normalizeProbeTracks(streams: ProbeStream[], type: 'audio' | 'video'): RemoteMediaTrack[] {
  const defaultIndex = streams.findIndex(stream => stream.disposition?.default === 1);
  return streams.map((stream, typeIndex) => ({
    id: `${type}:${typeIndex}`,
    type,
    label: stream.tags?.title || stream.tags?.language || `${type === 'audio' ? 'Audio' : 'Video'} ${typeIndex + 1}`,
    language: stream.tags?.language,
    codec: stream.codec_name,
    bitrate: stream.bit_rate ? Number(stream.bit_rate) : undefined,
    width: stream.width,
    height: stream.height,
    selected: typeIndex === (defaultIndex >= 0 ? defaultIndex : 0),
    supported: true
  }));
}

function normalizeSubtitleTracks(streams: ProbeStream[]): RemoteMediaTrack[] {
  const textCodecs = new Set(['ass', 'ssa', 'subrip', 'srt', 'text', 'webvtt', 'mov_text']);
  return streams.map((stream, typeIndex) => ({
    id: `subtitle:${typeIndex}`,
    type: 'subtitle',
    label: stream.tags?.title || stream.tags?.language || `Subtitle ${typeIndex + 1}`,
    language: stream.tags?.language,
    codec: stream.codec_name,
    selected: false,
    supported: textCodecs.has(stream.codec_name?.toLowerCase() || '')
  }));
}

export function fragmentedMp4VideoCodec(stream: ProbeStream): string | undefined {
  const codec = stream.codec_name?.toLowerCase();
  if (codec === 'h264' || codec === 'avc') {
    const profile = stream.profile?.toLowerCase() || '';
    const profileAndConstraints = profile.includes('high 4:4:4')
      ? 'F400'
      : profile.includes('high 4:2:2')
        ? '7A00'
        : profile.includes('high 10')
          ? '6E00'
          : profile.includes('high')
            ? '6400'
            : profile.includes('baseline') ? '42E0' : '4D40';
    const level = Math.max(1, Math.min(255, stream.level || 41));
    return `avc1.${profileAndConstraints}${level.toString(16).padStart(2, '0').toUpperCase()}`;
  }
  if (codec !== 'hevc' && codec !== 'h265') return undefined;
  const dolbyVision = dolbyVisionConfiguration(stream);
  if (dolbyVision) {
    return `dvh1.${String(dolbyVision.profile).padStart(2, '0')}.${String(dolbyVision.level || 6).padStart(2, '0')}`;
  }
  const main10 = stream.profile?.toLowerCase().includes('main 10') === true;
  const profileIdc = main10 ? 2 : 1;
  const compatibilityFlags = main10 ? 4 : 6;
  const level = Number.isInteger(stream.level) && (stream.level || 0) > 0 ? stream.level : 153;
  return `hvc1.${profileIdc}.${compatibilityFlags}.L${level}.B0`;
}

function dolbyVisionConfiguration(stream: ProbeStream): {
  profile: number;
  level?: number;
  compatibilityId?: number;
} | undefined {
  const configuration = stream.side_data_list?.find(sideData =>
    sideData.side_data_type?.toLowerCase() === 'dovi configuration record'
  );
  if (!configuration || !Number.isInteger(configuration.dv_profile) || (configuration.dv_profile || 0) <= 0) {
    return undefined;
  }
  return {
    profile: configuration.dv_profile as number,
    level: configuration.dv_level,
    compatibilityId: configuration.dv_bl_signal_compatibility_id
  };
}

function preferredH264Encoder(output: string): string | undefined {
  const available = new Set([...output.matchAll(/^\s*V[.A-Z]{5}\s+(\S+)\s/gm)].map(match => match[1]));
  const preferred = process.platform === 'win32'
    ? ['h264_mf', 'libopenh264', 'libx264']
    : process.platform === 'darwin'
      ? ['h264_videotoolbox', 'libopenh264', 'libx264']
      : ['libopenh264', 'libx264'];
  return preferred.find(encoder => available.has(encoder));
}

export interface H264TranscodePlan {
  args: string[];
  mimeType: string;
  width: number;
  height: number;
}

export function h264TranscodePlan(
  encoder?: string,
  toneMapDolbyVision = false,
  resolution: VideoTranscodeResolution = 'source',
  sourceWidth = 1920,
  sourceHeight = 1080
): H264TranscodePlan {
  if (!encoder) throw new Error('FFmpeg has no supported H.264 encoder for video compatibility mode');
  const { width, height } = targetTranscodeDimensions(resolution, sourceWidth, sourceHeight);
  const quality = width > 1920 || height > 1080
    ? { bitrate: '24M', maxrate: '32M', bufsize: '48M', level: '5.1', numericLevel: '51', codecLevel: '33' }
    : width > 1280 || height > 720
      ? { bitrate: '8M', maxrate: '12M', bufsize: '16M', level: '4.2', numericLevel: '42', codecLevel: '2A' }
      : { bitrate: '4M', maxrate: '6M', bufsize: '8M', level: '4.0', numericLevel: '40', codecLevel: '28' };
  const profileArgs = encoder === 'h264_mf'
    // Media Foundation exposes numeric H.264 profile/level identifiers and
    // rejects the libx264-style values "main" and "4.2".
    ? ['-profile:v', '77', '-level:v', quality.numericLevel]
    : ['-profile:v', 'main', '-level:v', quality.level];
  const common = [
    '-vf', toneMapDolbyVision
      ? `libplacebo=w=${width}:h=${height}:force_original_aspect_ratio=decrease:force_divisible_by=2:normalize_sar=true:format=nv12:colorspace=bt709:color_primaries=bt709:color_trc=bt709:range=tv:apply_dolbyvision=true`
      : `scale=w=${width}:h=${height}:force_original_aspect_ratio=decrease:force_divisible_by=2:flags=fast_bilinear,format=nv12`,
    '-c:v', encoder,
    ...profileArgs,
    '-b:v', quality.bitrate, '-maxrate', quality.maxrate, '-bufsize', quality.bufsize, '-g', '60',
    '-tag:v:0', 'avc1'
  ];
  const args = encoder === 'h264_videotoolbox'
    ? [...common, '-allow_sw', '1', '-realtime', '1']
    : encoder === 'libx264'
      ? [...common, '-preset', 'veryfast', '-tune', 'zerolatency']
      : common;
  return { args, mimeType: `avc1.4D40${quality.codecLevel}`, width, height };
}

export function h264TranscodeArgs(
  encoder?: string,
  toneMapDolbyVision = false,
  resolution: VideoTranscodeResolution = 'source',
  sourceWidth = 1920,
  sourceHeight = 1080
): string[] {
  return h264TranscodePlan(encoder, toneMapDolbyVision, resolution, sourceWidth, sourceHeight).args;
}

function targetTranscodeDimensions(
  resolution: VideoTranscodeResolution,
  sourceWidth: number,
  sourceHeight: number
): { width: number; height: number } {
  const width = Math.max(2, Math.round(sourceWidth) || 1920);
  const height = Math.max(2, Math.round(sourceHeight) || 1080);
  const limit = resolution === '2160p'
    ? { width: 3840, height: 2160 }
    : resolution === '1080p'
      ? { width: 1920, height: 1080 }
      : resolution === '720p' ? { width: 1280, height: 720 } : undefined;
  const scale = limit ? Math.min(1, limit.width / width, limit.height / height) : 1;
  return {
    width: Math.max(2, Math.floor(width * scale / 2) * 2),
    height: Math.max(2, Math.floor(height * scale / 2) * 2)
  };
}

export function dolbyVisionToneMappingProbeArgs(): string[] {
  return [
    '-hide_banner', '-loglevel', 'error',
    '-f', 'rawvideo', '-pixel_format', 'yuv420p', '-video_size', '16x16',
    '-framerate', '1', '-i', 'pipe:0',
    '-vf', 'libplacebo=format=nv12:colorspace=bt709:color_primaries=bt709:color_trc=bt709:range=tv:apply_dolbyvision=true',
    '-frames:v', '1', '-f', 'null', '-'
  ];
}

async function probeDolbyVisionToneMapping(
  ffmpegPath: string,
  filters: string,
  timeoutMs: number
): Promise<{ available: boolean; error?: string }> {
  if (!/^\s*[.A-Z]{2,3}\s+libplacebo\s+/m.test(filters)) {
    return { available: false, error: 'The libplacebo filter is not included in this FFmpeg build.' };
  }
  try {
    const help = await runAndCollect(ffmpegPath, ['-hide_banner', '-h', 'filter=libplacebo'], timeoutMs);
    if (!/\bapply_dolbyvision\b/.test(help)) {
      return { available: false, error: 'This libplacebo filter cannot apply Dolby Vision metadata.' };
    }
    const testFrame = Buffer.alloc(16 * 16 * 3 / 2, 128);
    testFrame.fill(16, 0, 16 * 16);
    await runAndCollect(ffmpegPath, dolbyVisionToneMappingProbeArgs(), timeoutMs, testFrame);
    return { available: true };
  } catch (error) {
    return { available: false, error: error instanceof Error ? error.message : String(error) };
  }
}

function fragmentedMp4MimeType(videoCodec: string | undefined, hasAudio: boolean): string | undefined {
  if (!videoCodec) return undefined;
  return `video/mp4; codecs="${videoCodec}${hasAudio ? ',mp4a.40.2' : ''}"`;
}

function selectedTypeIndex(tracks: RemoteMediaTrack[], trackId?: string): number {
  if (!trackId) return Math.max(0, tracks.findIndex(track => track.selected));
  const index = tracks.findIndex(track => track.id === trackId);
  return index >= 0 ? index : 0;
}

function inputNetworkArgs(media: Pick<LoadMediaParams, 'url' | 'headers'>): string[] {
  const headers = media.headers;
  if (!/^https?:\/\//i.test(media.url)) return inputHeaderArgs(headers);
  const userAgentEntry = Object.entries(headers || {}).find(([name]) => name.toLowerCase() === 'user-agent');
  const forwardedHeaders = headers
    ? Object.fromEntries(Object.entries(headers).filter(([name]) => name.toLowerCase() !== 'user-agent'))
    : undefined;
  return [
    '-user_agent', userAgentEntry?.[1] || 'Mozilla/5.0 (compatible; Streamshare-TV-Client/0.1)',
    ...inputHeaderArgs(forwardedHeaders)
  ];
}

function mediaProtocol(url: string): string {
  try { return new URL(url).protocol.replace(':', ''); } catch { return 'unknown'; }
}

function inputHeaderArgs(headers?: Record<string, string>): string[] {
  if (!headers || !Object.keys(headers).length) return [];
  const serialized = Object.entries(headers).map(([name, value]) => `${name}: ${value}`).join('\r\n') + '\r\n';
  return ['-headers', serialized];
}

function runAndCollect(command: string, args: string[], timeoutMs: number, input?: Buffer): Promise<string> {
  return new Promise((resolve, reject) => {
    const process = spawn(command, args, {
      stdio: [input ? 'pipe' : 'ignore', 'pipe', 'pipe'],
      env: mediaProcessEnvironment(command)
    });
    let stdout = '';
    let stderr = '';
    const timeout = setTimeout(() => {
      process.kill('SIGTERM');
      reject(new Error('Media analysis timed out'));
    }, timeoutMs);
    process.stdout?.on('data', chunk => { stdout += chunk; });
    process.stderr?.on('data', chunk => { stderr += chunk; });
    process.stdin?.on('error', () => {
      // The child can close stdin early when the Vulkan probe fails.
    });
    process.once('error', error => { clearTimeout(timeout); reject(error); });
    process.once('close', code => {
      clearTimeout(timeout);
      if (code === 0) resolve(stdout);
      else reject(new Error(stderr.trim() || `Media analysis failed (${code})`));
    });
    if (input) process.stdin?.end(input);
  });
}

export function mediaProcessEnvironment(command: string): NodeJS.ProcessEnv {
  if (process.platform !== 'darwin') return process.env;
  const manifest = join(dirname(command), 'MoltenVK_icd.json');
  if (!existsSync(manifest)) return process.env;
  return {
    ...process.env,
    // VK_DRIVER_FILES is the current loader variable. VK_ICD_FILENAMES keeps
    // the bundle compatible with older Vulkan loaders used on supported Macs.
    VK_DRIVER_FILES: manifest,
    VK_ICD_FILENAMES: manifest
  };
}

function mediaType(path: string): string {
  const extension = extname(path);
  if (extension === '.m3u8') return 'application/vnd.apple.mpegurl';
  if (extension === '.vtt') return 'text/vtt; charset=utf-8';
  if (extension === '.mp4') return 'video/mp4';
  if (extension === '.m4s') return 'video/iso.segment';
  return 'video/mp2t';
}

function stopChildProcess(process?: ChildProcess): Promise<void> {
  if (!process || process.exitCode !== null || process.signalCode !== null) return Promise.resolve();
  return new Promise(resolve => {
    let escalation: NodeJS.Timeout | undefined;
    let deadline: NodeJS.Timeout | undefined;
    const finish = () => {
      if (escalation) clearTimeout(escalation);
      if (deadline) clearTimeout(deadline);
      resolve();
    };
    process.once('close', finish);
    process.kill('SIGTERM');
    escalation = setTimeout(() => {
      if (process.exitCode === null && process.signalCode === null) process.kill('SIGKILL');
    }, 250);
    deadline = setTimeout(finish, 500);
  });
}

function closeServer(server: Server): Promise<void> {
  return new Promise(resolve => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(deadline);
      resolve();
    };
    const deadline = setTimeout(finish, 250);
    server.close(finish);
    server.closeIdleConnections();
    server.closeAllConnections();
  });
}
