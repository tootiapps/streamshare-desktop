import {
  appendFileSync,
  existsSync,
  mkdirSync,
  renameSync,
  statSync,
  unlinkSync
} from 'node:fs';
import { join } from 'node:path';

const MAX_LOG_BYTES = 5 * 1024 * 1024;
const MAX_ARCHIVES = 4;
const MAX_TEXT_LENGTH = 12_000;
const SENSITIVE_KEY = /authorization|cookie|credential|header|password|secret|token|url/i;

let logFile: string | undefined;

export function initializeDiagnosticLog(directory: string): string {
  mkdirSync(directory, { recursive: true });
  logFile = join(directory, 'streamshare-tv-client.jsonl');
  rotateIfNeeded(logFile);
  return logFile;
}

export function diagnosticLog(
  level: 'debug' | 'info' | 'warn' | 'error',
  event: string,
  details: unknown = undefined
): void {
  if (!logFile) return;
  try {
    const entry = {
      timestamp: new Date().toISOString(),
      level,
      event: redactText(event),
      ...(details === undefined ? {} : { details: sanitize(details) })
    };
    appendFileSync(logFile, `${JSON.stringify(entry)}\n`, 'utf8');
  } catch {
    // Diagnostics must never affect playback or application shutdown.
  }
}

function rotateIfNeeded(path: string): void {
  if (!existsSync(path) || statSync(path).size < MAX_LOG_BYTES) return;
  const oldest = `${path}.${MAX_ARCHIVES}`;
  if (existsSync(oldest)) unlinkSync(oldest);
  for (let index = MAX_ARCHIVES - 1; index >= 1; index -= 1) {
    const source = `${path}.${index}`;
    if (existsSync(source)) renameSync(source, `${path}.${index + 1}`);
  }
  renameSync(path, `${path}.1`);
}

function sanitize(value: unknown, key = ''): unknown {
  if (SENSITIVE_KEY.test(key)) return '<redacted>';
  if (value instanceof Error) {
    return {
      name: value.name,
      message: redactText(value.message),
      stack: redactText(value.stack || '')
    };
  }
  if (typeof value === 'string') return redactText(value);
  if (typeof value === 'number' || typeof value === 'boolean' || value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.slice(0, 100).map(item => sanitize(item));
  if (typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>)
      .slice(0, 100)
      .map(([name, item]) => [name, sanitize(item, name)]));
  }
  return redactText(String(value));
}

function redactText(value: string): string {
  const home = process.env.USERPROFILE || process.env.HOME;
  return value
    .slice(0, MAX_TEXT_LENGTH)
    .replace(/https?:\/\/[^\s"'<>]+/gi, '<redacted-url>')
    .replace(/\b(authorization|cookie|password|secret|token)\s*[:=]\s*[^\s,;]+/gi, '$1=<redacted>')
    .replace(home ? new RegExp(escapeRegExp(home), 'gi') : /$^/, '<user-home>');
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
