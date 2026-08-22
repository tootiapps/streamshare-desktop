import { spawn, spawnSync } from 'node:child_process';
import { readdir, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const arguments_ = process.argv.slice(2).filter(argument => argument !== '--');
const [platform, architecture] = arguments_;
if (!['mac', 'win', 'linux'].includes(platform) || !architecture) {
  console.error('Usage: node scripts/smoke-packaged.mjs <mac|win|linux> <x64|arm64>');
  process.exit(1);
}

const releaseDirectory = new URL('../release/', import.meta.url);

async function findAppResources(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const path = join(directory, entry.name);
    if (entry.name.toLowerCase() === 'resources') {
      try {
        if ((await stat(join(path, 'app.asar'))).isFile()) return path;
      } catch {
        // This is a resources directory for a helper, not the packaged app.
      }
    }
    if (path.includes('.app/Contents/Frameworks')) continue;
    const nested = await findAppResources(path);
    if (nested) return nested;
  }
  return undefined;
}

const releasePath = fileURLToPath(releaseDirectory);
const unpackedDirectoryNames = platform === 'mac'
  ? (architecture === 'arm64' ? ['mac-arm64'] : ['mac', 'mac-x64'])
  : platform === 'win'
    ? (architecture === 'arm64' ? ['win-arm64-unpacked'] : ['win-unpacked', 'win-x64-unpacked'])
    : (architecture === 'arm64' ? ['linux-arm64-unpacked'] : ['linux-unpacked', 'linux-x64-unpacked']);

let appResources;
for (const directoryName of unpackedDirectoryNames) {
  try {
    appResources = await findAppResources(join(releasePath, directoryName));
    if (appResources) break;
  } catch {
    // Try the next output directory name used by Electron Builder.
  }
}

if (!appResources) {
  console.error(`No packaged ${platform}/${architecture} application was found.`);
  process.exit(1);
}

let executable;
if (platform === 'mac') {
  executable = join(appResources, '..', 'MacOS', 'Streamshare TV Client');
} else {
  const unpackedRoot = join(appResources, '..');
  const names = await readdir(unpackedRoot);
  const expectedName = platform === 'win'
    ? names.find(name => /^Streamshare TV Client\.exe$/i.test(name))
    : names.find(name => name.toLowerCase().includes('streamshare') && !name.includes('.'));
  if (expectedName) executable = join(unpackedRoot, expectedName);
}

if (!executable) {
  console.error(`No packaged ${platform}/${architecture} executable was found.`);
  process.exit(1);
}
await stat(executable);

const mediaSuffix = platform === 'win' ? '.exe' : '';
const bundledMediaDirectory = join(appResources, 'app.asar.unpacked', 'dist', 'ffmpeg');
const mediaEnvironment = platform === 'win'
  ? cleanWindowsRuntimeEnvironment()
  : platform === 'mac' ? macMediaRuntimeEnvironment(bundledMediaDirectory) : process.env;
for (const name of ['ffmpeg', 'ffprobe']) {
  const mediaExecutable = join(bundledMediaDirectory, `${name}${mediaSuffix}`);
  await stat(mediaExecutable);
  const version = spawnSync(mediaExecutable, ['-version'], {
    encoding: 'utf8',
    timeout: 15_000,
    env: mediaEnvironment
  });
  const output = `${version.stdout || ''}${version.stderr || ''}`;
  if (version.error || version.status !== 0) {
    console.error(`Packaged ${name} could not be executed: ${version.error?.message || output}`);
    process.exit(1);
  }
  if (/(?:^|\s)--enable-nonfree(?:\s|$)/m.test(output)) {
    console.error(`Packaged ${name} unexpectedly contains --enable-nonfree.`);
    process.exit(1);
  }
  if (/(?:^|\s)--enable-gpl(?:\s|$)/m.test(output)) {
    console.error(`Packaged ${name} unexpectedly contains --enable-gpl.`);
    process.exit(1);
  }
}

if (platform === 'win' || platform === 'mac') {
  const ffmpeg = join(bundledMediaDirectory, platform === 'win' ? 'ffmpeg.exe' : 'ffmpeg');
  for (const name of ['RUNTIME_COMPONENTS.txt', 'BUILD_COMPONENTS.txt', 'THIRD_PARTY_LICENSES']) {
    await stat(join(bundledMediaDirectory, name));
  }
  const filters = runMedia(ffmpeg, ['-filters']);
  if (!/^\s*[.A-Z]{2,3}\s+libplacebo\s+/m.test(filters)) {
    console.error(`Packaged ${platform} FFmpeg has no libplacebo filter.`);
    process.exit(1);
  }
  const help = runMedia(ffmpeg, ['-hide_banner', '-h', 'filter=libplacebo']);
  if (!/\bapply_dolbyvision\b/.test(help)) {
    console.error(`Packaged ${platform} FFmpeg cannot apply Dolby Vision metadata.`);
    process.exit(1);
  }
  if (process.env.STREAMSHARE_SKIP_FFMPEG_GPU_SMOKE === '1') {
    console.warn(`Skipped the packaged ${platform} FFmpeg GPU smoke test; filter and option availability were still verified.`);
  } else {
    runMedia(ffmpeg, [
      '-hide_banner', '-loglevel', 'error',
      '-f', 'rawvideo', '-pixel_format', 'yuv420p', '-video_size', '16x16',
      '-framerate', '1', '-i', 'pipe:0',
      '-vf', 'libplacebo=format=nv12:colorspace=bt709:color_primaries=bt709:color_trc=bt709:range=tv:apply_dolbyvision=true',
      '-frames:v', '1', '-f', 'null', '-'
    ], Buffer.alloc(16 * 16 * 3 / 2, 128));
  }
}

function cleanWindowsRuntimeEnvironment() {
  const environment = Object.fromEntries(
    Object.entries(process.env).filter(([name]) => name.toLowerCase() !== 'path')
  );
  const windowsRoot = process.env.SystemRoot || process.env.WINDIR || 'C:\\Windows';
  return {
    ...environment,
    PATH: `${join(windowsRoot, 'System32')};${windowsRoot}`
  };
}

function macMediaRuntimeEnvironment(directory) {
  const manifest = join(directory, 'MoltenVK_icd.json');
  return { ...process.env, VK_DRIVER_FILES: manifest, VK_ICD_FILENAMES: manifest };
}

function runMedia(command, args, input) {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    timeout: 15_000,
    env: mediaEnvironment,
    input
  });
  const output = `${result.stdout || ''}${result.stderr || ''}`;
  if (result.error || result.status !== 0) {
    console.error(`${command} ${args.join(' ')} failed: ${result.error?.message || output}`);
    process.exit(1);
  }
  return output;
}

if (platform === 'mac') {
  const appBundle = join(appResources, '..', '..');
  const verification = spawnSync(
    'codesign',
    ['--verify', '--deep', '--strict', '--verbose=2', appBundle],
    { encoding: 'utf8' }
  );
  if (verification.status !== 0) {
    console.error('The packaged macOS application does not have a valid bundle signature.');
    console.error(`${verification.stdout}${verification.stderr}`.trim());
    process.exit(1);
  }
}

if (arguments_.includes('--resolve-only')) {
  console.log(`Resolved packaged ${platform}/${architecture} executable: ${executable}`);
  process.exit(0);
}

const command = platform === 'linux' ? 'xvfb-run' : executable;
const args = platform === 'linux'
  ? ['-a', executable, '--disable-gpu', '--no-sandbox']
  : ['--disable-gpu'];
const child = spawn(command, args, {
  detached: platform === 'linux',
  env: {
    ...process.env,
    ELECTRON_DISABLE_SECURITY_WARNINGS: 'true'
  },
  stdio: ['ignore', 'pipe', 'pipe']
});

let output = '';
child.stdout.on('data', chunk => { output += chunk; });
child.stderr.on('data', chunk => { output += chunk; });

const earlyExit = new Promise((resolve, reject) => {
  child.once('error', reject);
  child.once('exit', (code, signal) => resolve({ code, signal }));
});
const survived = await Promise.race([
  earlyExit.then(result => ({ survived: false, result })),
  new Promise(resolve => setTimeout(() => resolve({ survived: true }), 5_000))
]);

if (!survived.survived) {
  console.error(`Packaged application exited before the smoke-test window: ${JSON.stringify(survived.result)}`);
  if (output) console.error(output.slice(-4_000));
  process.exit(1);
}

function terminateChild(signal) {
  if (platform === 'linux' && child.pid) {
    try {
      process.kill(-child.pid, signal);
      return;
    } catch {
      // The process group has already exited; fall back to the wrapper process.
    }
  }
  child.kill(signal);
}

terminateChild('SIGTERM');
await Promise.race([
  earlyExit,
  new Promise(resolve => setTimeout(resolve, 2_000))
]);
if (platform === 'linux') {
  // xvfb-run can exit before Electron and Xvfb. Kill any remaining members of
  // the detached process group so inherited stdout/stderr pipes cannot hang CI.
  try {
    process.kill(-child.pid, 'SIGKILL');
  } catch {
    // The complete process group has already exited.
  }
} else if (child.exitCode === null && child.signalCode === null) {
  child.kill('SIGKILL');
}
child.stdout.destroy();
child.stderr.destroy();
child.unref();

console.log(`Packaged ${platform}/${architecture} application stayed alive for five seconds.`);
