import { spawnSync } from 'node:child_process';
import { access } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const platform = process.platform === 'darwin' ? 'mac' : process.platform === 'win32' ? 'win' : 'linux';
const architecture = process.arch;
const packageDirectory = fileURLToPath(new URL('../', import.meta.url));
const suffix = platform === 'win' ? '.exe' : '';
const bundleDirectory = join(packageDirectory, '.ffmpeg-cache', '7.1.1-r4', `${platform}-${architecture}`);

try {
  await Promise.all([
    access(join(bundleDirectory, `ffmpeg${suffix}`)),
    access(join(bundleDirectory, `ffprobe${suffix}`)),
    access(join(bundleDirectory, '.complete'))
  ]);
} catch {
  console.log(`No verified FFmpeg bundle exists for ${platform}/${architecture}; building it now.`);
  run(process.execPath, ['scripts/build-host-ffmpeg.mjs']);
}

run(process.execPath, ['scripts/stage-ffmpeg.mjs', platform, architecture]);

function run(command, args) {
  const result = spawnSync(command, args, { cwd: packageDirectory, stdio: 'inherit' });
  if (result.error || result.status !== 0) {
    throw new Error(result.error?.message || `${command} failed with exit code ${result.status}`);
  }
}
