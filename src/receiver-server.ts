import {
  constants,
  createHash,
  privateDecrypt,
  randomUUID
} from 'node:crypto';
import { createServer } from 'node:https';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { Duplex } from 'node:stream';
import { Bonjour } from 'bonjour-service';
import {
  STREAMSHARE_REMOTE_PROTOCOL_VERSION,
  derivePairingCode,
  type RemoteController,
  type RemotePlaybackState,
  type RemoteRequest
} from '@streamshare/remote-protocol';
import { WebSocket, WebSocketServer } from 'ws';
import type { SettingsStore } from './settings-store.js';
import type { TlsIdentity } from './tls-identity.js';

interface PairingSession {
  pairingId: string;
  controllerId: string;
  controllerName: string;
  expiresAt: number;
}

interface AuthorizedSocket extends WebSocket {
  controllerId?: string;
}

export interface ReceiverServerEvents {
  onPairingCode(code: string, controllerName: string, expiresAt: number): void;
  onPlaybackCommand(request: RemoteRequest): Promise<RemotePlaybackState>;
  onControllersChanged(): void;
}

export class ReceiverServer {
  private readonly server;
  private readonly sockets = new Set<AuthorizedSocket>();
  private readonly webSockets = new WebSocketServer({ noServer: true, maxPayload: 64 * 1024 });
  private readonly bonjour = new Bonjour();
  private service?: { stop: CallableFunction };
  private pairing?: PairingSession;
  private pairingFailures = 0;
  private pairingCooldownUntil = 0;

  constructor(
    private readonly identity: TlsIdentity,
    private readonly store: SettingsStore,
    private readonly events: ReceiverServerEvents
  ) {
    this.server = createServer({ key: identity.privateKey, cert: identity.certificate }, (request, response) => {
      void this.handleHttp(request, response);
    });
    this.server.on('upgrade', (request, socket, head) => {
      void this.handleUpgrade(request, socket, head);
    });
    this.webSockets.on('connection', (socket: AuthorizedSocket) => this.onConnection(socket));
  }

  async start(): Promise<number> {
    const settings = await this.store.load();
    if (!settings.enabled) return 0;
    await new Promise<void>((resolve, reject) => {
      this.server.once('error', reject);
      this.server.listen(0, '0.0.0.0', () => {
        this.server.off('error', reject);
        resolve();
      });
    });
    const port = (this.server.address() as AddressInfo).port;
    this.service = this.bonjour.publish({
      name: settings.deviceName,
      type: 'streamshare-tv',
      protocol: 'tcp',
      port,
      txt: {
        id: this.identity.fingerprint,
        name: settings.deviceName,
        updated: String(settings.announcementUpdatedAt),
        v: String(STREAMSHARE_REMOTE_PROTOCOL_VERSION),
        platform: process.platform === 'darwin' ? 'macos' : process.platform,
        caps: 'play,pause,stop,seek,volume,audio,subtitles,video,navigation',
        tls: '1'
      }
    });
    return port;
  }

  async stop(): Promise<void> {
    if (this.service) {
      await new Promise<void>(resolve => this.service?.stop(resolve));
    }
    this.service = undefined;
    for (const socket of this.sockets) socket.close(1001, 'Receiver stopped');
    this.sockets.clear();
    if (this.server.listening) {
      await new Promise<void>(resolve => this.server.close(() => resolve()));
    }
    await new Promise<void>(resolve => this.bonjour.destroy(resolve));
  }

  broadcastState(state: RemotePlaybackState): void {
    const message = JSON.stringify({
      v: STREAMSHARE_REMOTE_PROTOCOL_VERSION,
      type: 'event',
      event: 'playback.state',
      data: state
    });
    for (const socket of this.sockets) {
      if (socket.readyState === WebSocket.OPEN) socket.send(message);
    }
  }

  closeController(controllerId: string): void {
    for (const socket of this.sockets) {
      if (socket.controllerId === controllerId) socket.close(1008, 'Access revoked');
    }
  }

  private async handleHttp(request: IncomingMessage, response: ServerResponse): Promise<void> {
    try {
      if (request.method === 'GET' && request.url === '/v1/health') {
        const settings = await this.store.load();
        this.json(response, 200, {
          v: 1,
          id: this.identity.fingerprint,
          name: settings.deviceName,
          announcementUpdatedAt: settings.announcementUpdatedAt
        });
        return;
      }
      if (request.method === 'POST' && request.url === '/v1/pair/begin') {
        await this.pairBegin(request, response);
        return;
      }
      if (request.method === 'POST' && request.url === '/v1/pair/complete') {
        await this.pairComplete(request, response);
        return;
      }
      this.json(response, 404, this.error('INVALID_REQUEST', 'Unknown endpoint'));
    } catch (error) {
      this.json(response, 500, this.error('INTERNAL_ERROR', error instanceof Error ? error.message : 'Internal error'));
    }
  }

  private async pairBegin(request: IncomingMessage, response: ServerResponse): Promise<void> {
    if (this.pairingCooldownUntil > Date.now()) {
      this.json(response, 429, this.error('PAIRING_EXPIRED', 'Pairing temporarily unavailable'));
      return;
    }
    const body = await this.readJson(request);
    const controllerId = this.requiredString(body, 'controllerId');
    const controllerName = this.requiredString(body, 'controllerName');
    const pairingId = randomUUID();
    const expiresAt = Date.now() + 60_000;
    this.pairing = { pairingId, controllerId, controllerName, expiresAt };
    const code = await derivePairingCode(this.identity.fingerprint, pairingId, controllerId);
    this.events.onPairingCode(code, controllerName, expiresAt);
    this.json(response, 200, { pairingId, receiverFingerprint: this.identity.fingerprint, expiresAt });
  }

  private async pairComplete(request: IncomingMessage, response: ServerResponse): Promise<void> {
    const body = await this.readJson(request);
    const pairing = this.pairing;
    const valid = pairing
      && pairing.expiresAt >= Date.now()
      && pairing.pairingId === this.requiredString(body, 'pairingId')
      && pairing.controllerId === this.requiredString(body, 'controllerId')
      && pairing.controllerName === this.requiredString(body, 'controllerName');
    if (!valid || !pairing) {
      this.recordPairingFailure();
      this.json(response, 401, this.error('PAIRING_EXPIRED', 'Pairing session mismatch or expired'));
      return;
    }
    try {
      const token = privateDecrypt({
        key: this.identity.privateKey,
        padding: constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: 'sha256'
      }, Buffer.from(this.requiredString(body, 'encryptedToken'), 'base64'));
      if (token.length < 32 || token.length > 128) throw new Error('Invalid token length');
      const now = Date.now();
      const controller: RemoteController = {
        id: pairing.controllerId,
        name: pairing.controllerName,
        createdAt: now,
        lastSeenAt: now
      };
      await this.store.authorize({
        ...controller,
        tokenDigest: createHash('sha256').update(token).digest('hex')
      });
      this.pairing = undefined;
      this.pairingFailures = 0;
      this.events.onControllersChanged();
      this.json(response, 200, { controller });
    } catch {
      this.recordPairingFailure();
      this.json(response, 400, this.error('INVALID_REQUEST', 'Invalid pairing token'));
    }
  }

  private async handleUpgrade(request: IncomingMessage, socket: Duplex, head: Buffer): Promise<void> {
    const controllerId = String(request.headers['x-streamshare-controller-id'] || '');
    const authorization = String(request.headers.authorization || '');
    const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
    const controller = (await this.store.load()).controllers.find(item => item.id === controllerId);
    const digest = createHash('sha256').update(token).digest('hex');
    if (request.url !== '/v1/ws' || !controller || !token || !this.safeEqual(controller.tokenDigest, digest)) {
      socket.end('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n');
      return;
    }
    await this.store.touchController(controllerId);
    this.webSockets.handleUpgrade(request, socket, head, upgraded => {
      const authorized = upgraded as AuthorizedSocket;
      authorized.controllerId = controllerId;
      this.webSockets.emit('connection', authorized, request);
    });
  }

  private onConnection(socket: AuthorizedSocket): void {
    this.sockets.add(socket);
    socket.on('close', () => this.sockets.delete(socket));
    socket.on('message', raw => {
      void this.handleMessage(socket, raw.toString());
    });
  }

  private async handleMessage(socket: AuthorizedSocket, raw: string): Promise<void> {
    let request: RemoteRequest;
    try {
      request = JSON.parse(raw) as RemoteRequest;
      if (request.v !== 1 || request.type !== 'request' || !request.id || !request.method) {
        throw new Error('Invalid request');
      }
      const state = await this.events.onPlaybackCommand(request);
      socket.send(JSON.stringify({ v: 1, type: 'response', id: request.id, ok: true, result: state }));
    } catch (error) {
      let id = '';
      try { id = String((JSON.parse(raw) as { id?: string }).id || ''); } catch { /* empty */ }
      socket.send(JSON.stringify({
        v: 1,
        type: 'response',
        id,
        ok: false,
        error: this.error('INVALID_REQUEST', error instanceof Error ? error.message : 'Invalid request')
      }));
    }
  }

  private recordPairingFailure(): void {
    this.pairingFailures += 1;
    this.pairing = undefined;
    if (this.pairingFailures >= 3) {
      this.pairingCooldownUntil = Date.now() + 60_000;
      this.pairingFailures = 0;
    }
  }

  private async readJson(request: IncomingMessage): Promise<Record<string, unknown>> {
    const chunks: Buffer[] = [];
    let size = 0;
    for await (const chunk of request) {
      const buffer = Buffer.from(chunk);
      size += buffer.length;
      if (size > 64 * 1024) throw new Error('Request body too large');
      chunks.push(buffer);
    }
    return JSON.parse(Buffer.concat(chunks).toString('utf8')) as Record<string, unknown>;
  }

  private requiredString(object: Record<string, unknown>, key: string): string {
    const value = object[key];
    if (typeof value !== 'string' || !value.trim()) throw new Error(`${key} is required`);
    return value.trim();
  }

  private safeEqual(left: string, right: string): boolean {
    if (left.length !== right.length) return false;
    let difference = 0;
    for (let index = 0; index < left.length; index += 1) {
      difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
    }
    return difference === 0;
  }

  private error(code: string, message: string): { code: string; message: string } {
    return { code, message };
  }

  private json(response: ServerResponse, status: number, value: unknown): void {
    const body = JSON.stringify(value);
    response.writeHead(status, {
      'content-type': 'application/json',
      'content-length': Buffer.byteLength(body),
      'cache-control': 'no-store'
    });
    response.end(body);
  }
}
