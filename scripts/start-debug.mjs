import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import electron from 'electron';

const packageDirectory = fileURLToPath(new URL('../', import.meta.url));
const environment = {
  ...process.env,
  STREAMSHARE_DEBUG: '1',
  STREAMSHARE_DEBUG_PORT: process.env.STREAMSHARE_DEBUG_PORT || '9222'
};

if (process.platform === 'win32' && !environment.STREAMSHARE_FFMPEG_PATH && !environment.STREAMSHARE_FFPROBE_PATH) {
  const installedDirectory = join(
    process.env.LOCALAPPDATA || '',
    'Programs', '@streamsharetv-client', 'resources', 'app.asar.unpacked', 'dist', 'ffmpeg'
  );
  const ffmpeg = join(installedDirectory, 'ffmpeg.exe');
  const ffprobe = join(installedDirectory, 'ffprobe.exe');
  if (existsSync(ffmpeg) && existsSync(ffprobe)) {
    environment.STREAMSHARE_FFMPEG_PATH = ffmpeg;
    environment.STREAMSHARE_FFPROBE_PATH = ffprobe;
  }
}

console.log(`Starting Streamshare TV Client in debug mode on 127.0.0.1:${environment.STREAMSHARE_DEBUG_PORT}.`);
const child = spawn(electron, ['.'], {
  cwd: packageDirectory,
  env: environment,
  stdio: 'inherit',
  windowsHide: false
});

child.once('error', error => {
  console.error(error);
  process.exitCode = 1;
});
child.once('exit', (code, signal) => {
  if (signal) console.log(`Electron stopped by ${signal}.`);
  process.exitCode = code ?? (signal ? 1 : 0);
});
