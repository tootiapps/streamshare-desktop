import { spawnSync } from 'node:child_process';
import { cp, mkdir, readFile, readdir, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

let [platform, architecture] = process.argv.slice(2).filter(argument => argument !== '--');
if (!platform && !architecture) {
  platform = process.platform === 'darwin' ? 'mac' : process.platform === 'win32' ? 'win' : 'linux';
  architecture = process.arch;
}
if (!['mac', 'win', 'linux'].includes(platform) || !['x64', 'arm64'].includes(architecture)) {
  console.error('Usage: node scripts/stage-ffmpeg.mjs <mac|win|linux> <x64|arm64>');
  process.exit(1);
}

const version = '7.1.1';
const bundleRevision = '4';
const packageDirectory = fileURLToPath(new URL('../', import.meta.url));
const sourceDirectory = resolve(
  process.env.STREAMSHARE_FFMPEG_BUNDLE_DIR
    || join(packageDirectory, '.ffmpeg-cache', `${version}-r${bundleRevision}`, `${platform}-${architecture}`)
);
const destinationDirectory = join(packageDirectory, 'dist', 'ffmpeg');
const suffix = platform === 'win' ? '.exe' : '';
const ffmpeg = join(sourceDirectory, `ffmpeg${suffix}`);
const ffprobe = join(sourceDirectory, `ffprobe${suffix}`);
const runtimeEnvironment = platform === 'win'
  ? cleanWindowsRuntimeEnvironment()
  : platform === 'mac' ? macMediaRuntimeEnvironment(sourceDirectory) : process.env;

const ffmpegVersion = run(ffmpeg, ['-version']);
const ffprobeVersion = run(ffprobe, ['-version']);
for (const [name, output] of [['ffmpeg', ffmpegVersion], ['ffprobe', ffprobeVersion]]) {
  if (!/^ff(?:mpeg|probe) version\s+(?:n-)?(?:[6-9]|\d{2,})/i.test(output)) {
    throw new Error(`${name} 6.0 or later is required.`);
  }
  if (/(?:^|\s)--enable-nonfree(?:\s|$)/m.test(output)) {
    throw new Error(`${name} was built with --enable-nonfree and must never be redistributed.`);
  }
  if (/(?:^|\s)--enable-gpl(?:\s|$)/m.test(output)) {
    throw new Error(`${name} is not the expected LGPL build (--enable-gpl was found).`);
  }
}

const detectedArchitecture = detectArchitecture(await readFile(ffmpeg));
if (detectedArchitecture !== architecture) {
  throw new Error(`Expected ${architecture} FFmpeg, found ${detectedArchitecture || 'an unknown architecture'}.`);
}
const encoders = run(ffmpeg, ['-encoders']);
if (!/^\s*A[.A-Z]{5}\s+aac\s/m.test(encoders)) {
  throw new Error('Bundled FFmpeg has no AAC encoder.');
}
const requiredVideoEncoder = platform === 'win'
  ? 'h264_mf'
  : platform === 'mac' ? 'h264_videotoolbox' : undefined;
if (requiredVideoEncoder && !new RegExp(`^\\s*V[.A-Z]{5}\\s+${requiredVideoEncoder}\\s`, 'm').test(encoders)) {
  throw new Error(`Bundled FFmpeg has no ${requiredVideoEncoder} video compatibility encoder.`);
}
if (!run(ffmpeg, ['-protocols']).split(/\r?\n/).some(line => line.trim() === 'https')) {
  throw new Error('Bundled FFmpeg has no HTTPS protocol support.');
}
if (platform === 'win' || platform === 'mac') {
  const filters = run(ffmpeg, ['-filters']);
  if (!/^\s*[.A-Z]{2,3}\s+libplacebo\s+/m.test(filters)) {
    throw new Error(`The ${platform} FFmpeg bundle has no libplacebo filter.`);
  }
  if (!/\bapply_dolbyvision\b/.test(run(ffmpeg, ['-hide_banner', '-h', 'filter=libplacebo']))) {
    throw new Error(`The ${platform} FFmpeg bundle cannot apply Dolby Vision metadata.`);
  }
  run(ffmpeg, [
    '-hide_banner', '-loglevel', 'error',
    '-f', 'rawvideo', '-pixel_format', 'yuv420p', '-video_size', '16x16',
    '-framerate', '1', '-i', 'pipe:0',
    '-vf', 'libplacebo=format=nv12:colorspace=bt709:color_primaries=bt709:color_trc=bt709:range=tv:apply_dolbyvision=true',
    '-frames:v', '1', '-f', 'null', '-'
  ], Buffer.alloc(16 * 16 * 3 / 2, 128));
}

await rm(destinationDirectory, { recursive: true, force: true });
await mkdir(destinationDirectory, { recursive: true });
for (const name of [`ffmpeg${suffix}`, `ffprobe${suffix}`, 'COPYING.LGPLv2.1', 'COPYING.LGPLv3', 'LICENSE.md', 'BUILD_INFO.txt', 'FFMPEG_VERSION.txt']) {
  await cp(join(sourceDirectory, name), join(destinationDirectory, name));
}
if (platform === 'win' || platform === 'mac') {
  const runtimeFiles = (await readdir(sourceDirectory)).filter(name => platform === 'win'
    ? name.toLowerCase().endsWith('.dll')
    : name.toLowerCase().endsWith('.dylib') || name === 'MoltenVK_icd.json');
  if (!runtimeFiles.length) throw new Error(`The ${platform} FFmpeg bundle has no libplacebo runtime libraries.`);
  for (const name of runtimeFiles) await cp(join(sourceDirectory, name), join(destinationDirectory, name));
  for (const name of ['RUNTIME_COMPONENTS.txt', 'BUILD_COMPONENTS.txt', 'THIRD_PARTY_LICENSES']) {
    await cp(join(sourceDirectory, name), join(destinationDirectory, name), { recursive: true });
  }
}
console.log(`Staged verified LGPL FFmpeg ${platform}/${architecture} from ${sourceDirectory}.`);

function run(command, args, input) {
  const result = spawnSync(command, args, { encoding: 'utf8', timeout: 15_000, env: runtimeEnvironment, input });
  if (result.error || result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed: ${result.error?.message || result.stderr || `exit ${result.status}`}`);
  }
  return `${result.stdout || ''}${result.stderr || ''}`;
}

function macMediaRuntimeEnvironment(directory) {
  const manifest = join(directory, 'MoltenVK_icd.json');
  return { ...process.env, VK_DRIVER_FILES: manifest, VK_ICD_FILENAMES: manifest };
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

function detectArchitecture(binary) {
  if (binary.length < 64) return undefined;
  if (binary[0] === 0x7f && binary.toString('ascii', 1, 4) === 'ELF') {
    const littleEndian = binary[5] === 1;
    const machine = littleEndian ? binary.readUInt16LE(18) : binary.readUInt16BE(18);
    return machine === 62 ? 'x64' : machine === 183 ? 'arm64' : undefined;
  }
  if (binary.toString('ascii', 0, 2) === 'MZ') {
    const peOffset = binary.readUInt32LE(0x3c);
    const machine = binary.readUInt16LE(peOffset + 4);
    return machine === 0x8664 ? 'x64' : machine === 0xaa64 ? 'arm64' : undefined;
  }
  const magic = binary.readUInt32LE(0);
  if (magic === 0xfeedfacf) {
    const cpu = binary.readUInt32LE(4);
    return cpu === 0x01000007 ? 'x64' : cpu === 0x0100000c ? 'arm64' : undefined;
  }
  return undefined;
}
