import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { basename } from 'node:path';

const [platform, architecture] = process.argv.slice(2).filter(argument => argument !== '--');
const expectedExtensions = {
  mac: ['.dmg'],
  win: ['.exe', '.zip'],
  linux: ['.AppImage', '.deb', '.tar.gz']
};
const architectureAliases = {
  x64: ['x64', 'x86_64', 'amd64'],
  arm64: ['arm64', 'aarch64']
};

if (!expectedExtensions[platform] || !architectureAliases[architecture]) {
  console.error('Usage: node scripts/artifact-manifest.mjs <mac|win|linux> <x64|arm64>');
  process.exit(1);
}

const releaseDirectory = new URL('../release/', import.meta.url);
const entries = await readdir(releaseDirectory, { withFileTypes: true });
const deliverables = entries
  .filter(entry => entry.isFile())
  .map(entry => entry.name)
  .filter(name => !name.startsWith('.'))
  .filter(name => expectedExtensions[platform].some(extension => name.endsWith(extension)))
  .filter(name => architectureAliases[architecture]
    .some(alias => name.includes(`-${platform}-${alias}.`)))
  .sort();

const missingExtensions = expectedExtensions[platform]
  .filter(extension => !deliverables.some(name => name.endsWith(extension)));
if (missingExtensions.length) {
  console.error(`Missing ${platform}/${architecture} artifacts: ${missingExtensions.join(', ')}`);
  process.exit(1);
}

const checksums = [];
for (const name of deliverables) {
  const content = await readFile(new URL(name, releaseDirectory));
  const digest = createHash('sha256').update(content).digest('hex');
  checksums.push(`${digest}  ${name}`);
}

const suffix = `${platform}-${architecture}`;
await writeFile(
  new URL(`SHA256SUMS-${suffix}.txt`, releaseDirectory),
  `${checksums.join('\n')}\n`,
  'utf8'
);

const packageManifest = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
const lockfile = await readNearestLockfile();
const installedElectron = JSON.parse(await readFile(new URL('../node_modules/electron/package.json', import.meta.url), 'utf8'));
const installedElectronBuilder = JSON.parse(await readFile(new URL('../node_modules/electron-builder/package.json', import.meta.url), 'utf8'));
let bundledFfmpeg = false;
let bundledFfmpegVersion;
let bundledFfmpegSource;
let bundledFfmpegSourceSha256;
let ffmpegRuntimeManifestSha256;
let bundledFfmpegLibplacebo = false;
try {
  const ffmpegEntries = await readdir(new URL('../dist/ffmpeg/', import.meta.url));
  bundledFfmpeg = ffmpegEntries.some(name => name === 'ffmpeg' || name === 'ffmpeg.exe')
    && ffmpegEntries.some(name => name === 'ffprobe' || name === 'ffprobe.exe');
  const versionOutput = await readFile(new URL('../dist/ffmpeg/FFMPEG_VERSION.txt', import.meta.url), 'utf8');
  bundledFfmpegVersion = versionOutput.match(/^ffmpeg version\s+(\S+)/i)?.[1];
  const buildInfo = await readFile(new URL('../dist/ffmpeg/BUILD_INFO.txt', import.meta.url), 'utf8');
  bundledFfmpegSource = buildInfo.match(/^Source:\s*(\S+)\s*$/im)?.[1];
  bundledFfmpegSourceSha256 = buildInfo.match(/^Source SHA-256:\s*([a-f0-9]{64})\s*$/im)?.[1];
  if (platform === 'win' || platform === 'mac') {
    const runtimeManifest = await readFile(new URL('../dist/ffmpeg/RUNTIME_COMPONENTS.txt', import.meta.url));
    ffmpegRuntimeManifestSha256 = createHash('sha256').update(runtimeManifest).digest('hex');
    bundledFfmpegLibplacebo = /(?:^|\s)libplacebo(?:\s|$)/im.test(runtimeManifest.toString('utf8'));
  }
} catch {
  // Report the required bundle below with a clear release-time error.
}
if (!bundledFfmpeg) {
  console.error(`The ${platform}/${architecture} package does not contain the required FFmpeg and FFprobe bundle.`);
  process.exit(1);
}
if (!bundledFfmpegSource || !bundledFfmpegSourceSha256) {
  console.error(`The ${platform}/${architecture} package does not identify its bundled FFmpeg source.`);
  process.exit(1);
}
if ((platform === 'win' || platform === 'mac') && !bundledFfmpegLibplacebo) {
  console.error(`The ${platform}/${architecture} package does not identify libplacebo in its FFmpeg runtime manifest.`);
  process.exit(1);
}
const metadata = {
  application: packageManifest.build.productName,
  package: packageManifest.name,
  version: packageManifest.version,
  platform,
  architecture,
  electron: installedElectron.version,
  electronBuilder: installedElectronBuilder.version,
  commit: process.env.GITHUB_SHA || null,
  bundledFfmpeg,
  bundledFfmpegVersion,
  bundledFfmpegSource,
  bundledFfmpegSourceSha256,
  bundledFfmpegLibplacebo,
  ffmpegRuntimeManifestSha256,
  lockfileSha256: createHash('sha256').update(lockfile).digest('hex'),
  artifacts: deliverables.map(name => basename(name))
};
await writeFile(
  new URL(`build-metadata-${suffix}.json`, releaseDirectory),
  `${JSON.stringify(metadata, null, 2)}\n`,
  'utf8'
);

console.log(`Validated ${deliverables.length} ${platform}/${architecture} artifacts.`);

async function readNearestLockfile() {
  let directory = new URL('../', import.meta.url);
  while (true) {
    try {
      return await readFile(new URL('pnpm-lock.yaml', directory), 'utf8');
    } catch (error) {
      if (!(error instanceof Error) || !('code' in error) || error.code !== 'ENOENT') throw error;
    }

    const parent = new URL('../', directory);
    if (parent.href === directory.href) break;
    directory = parent;
  }
  throw new Error('Unable to locate pnpm-lock.yaml for the packaged build.');
}
