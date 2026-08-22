import { createHash } from 'node:crypto';
import {
  copyFile,
  mkdir,
  readFile,
  readdir,
  stat,
  writeFile,
} from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const options = parseArguments(process.argv.slice(2));
const assetsDirectory = resolve(options.assets);
const notesPath = resolve(options.notes);
const packageDirectory = fileURLToPath(new URL('../', import.meta.url));
const targets = [
  { platform: 'mac', architecture: 'arm64', extensions: ['.dmg'] },
  { platform: 'mac', architecture: 'x64', extensions: ['.dmg'] },
  { platform: 'win', architecture: 'x64', extensions: ['.exe', '.zip'] },
  { platform: 'linux', architecture: 'x64', extensions: ['.AppImage', '.deb', '.tar.gz'] },
  { platform: 'linux', architecture: 'arm64', extensions: ['.AppImage', '.deb', '.tar.gz'] },
];

await mkdir(assetsDirectory, { recursive: true });

let ffmpegSource;
let ffmpegSourceSha256;
const builds = [];
for (const target of targets) {
  const suffix = `${target.platform}-${target.architecture}`;
  const metadata = JSON.parse(await readFile(join(assetsDirectory, `build-metadata-${suffix}.json`), 'utf8'));
  assertEqual(metadata.version, options.version, `${suffix} version`);
  assertEqual(metadata.commit, options.commit, `${suffix} commit`);
  assertEqual(metadata.platform, target.platform, `${suffix} platform`);
  assertEqual(metadata.architecture, target.architecture, `${suffix} architecture`);
  if (metadata.bundledFfmpeg !== true) throw new Error(`${suffix} does not contain bundled FFmpeg.`);

  if (ffmpegSource === undefined) {
    ffmpegSource = metadata.bundledFfmpegSource;
    ffmpegSourceSha256 = metadata.bundledFfmpegSourceSha256;
  } else {
    assertEqual(metadata.bundledFfmpegSource, ffmpegSource, `${suffix} FFmpeg source`);
    assertEqual(metadata.bundledFfmpegSourceSha256, ffmpegSourceSha256, `${suffix} FFmpeg source digest`);
  }

  const checksums = parseChecksums(
    await readFile(join(assetsDirectory, `SHA256SUMS-${suffix}.txt`), 'utf8'),
    suffix,
  );
  for (const artifact of metadata.artifacts) {
    if (basename(artifact) !== artifact) throw new Error(`Unsafe artifact name in ${suffix}: ${artifact}`);
    const expectedDigest = checksums.get(artifact);
    if (!expectedDigest) throw new Error(`${artifact} is missing from the ${suffix} checksum file.`);
    const actualDigest = await sha256(join(assetsDirectory, artifact));
    assertEqual(actualDigest, expectedDigest, `${artifact} digest`);
  }
  for (const extension of target.extensions) {
    if (!metadata.artifacts.some(name => name.endsWith(extension))) {
      throw new Error(`${suffix} is missing its ${extension} deliverable.`);
    }
  }

  const sbomName = `sbom-${suffix}.spdx.json`;
  const sbom = JSON.parse(await readFile(join(assetsDirectory, sbomName), 'utf8'));
  if (sbom.spdxVersion !== 'SPDX-2.3') throw new Error(`${sbomName} is not an SPDX 2.3 document.`);

  builds.push({
    platform: target.platform,
    architecture: target.architecture,
    artifacts: [...metadata.artifacts].sort(),
    sbom: sbomName,
    bundledFfmpegVersion: metadata.bundledFfmpegVersion,
    bundledFfmpegLibplacebo: metadata.bundledFfmpegLibplacebo,
  });
}

if (!ffmpegSource || !/^[a-f0-9]{64}$/.test(ffmpegSourceSha256 || '')) {
  throw new Error('Release metadata does not identify a valid FFmpeg source archive.');
}
const sourceUrl = new URL(ffmpegSource);
if (sourceUrl.protocol !== 'https:' || sourceUrl.hostname !== 'ffmpeg.org') {
  throw new Error(`Refusing unexpected FFmpeg source URL: ${sourceUrl.href}`);
}
const sourceName = basename(sourceUrl.pathname);
if (!/^ffmpeg-[0-9.]+\.tar\.xz$/.test(sourceName)) throw new Error(`Unsafe FFmpeg source name: ${sourceName}`);
const sourceResponse = await fetch(sourceUrl, { redirect: 'follow' });
if (!sourceResponse.ok) throw new Error(`Unable to download ${sourceUrl}: HTTP ${sourceResponse.status}`);
const sourceContents = Buffer.from(await sourceResponse.arrayBuffer());
assertEqual(createHash('sha256').update(sourceContents).digest('hex'), ffmpegSourceSha256, 'FFmpeg source digest');
await writeFile(join(assetsDirectory, sourceName), sourceContents);

for (const name of ['LICENSE', 'NOTICE', 'THIRD_PARTY_NOTICES.md', 'FFMPEG_DISTRIBUTION.md']) {
  await copyFile(join(packageDirectory, name), join(assetsDirectory, name));
}

const releaseManifest = {
  schemaVersion: 1,
  application: 'StreamShare TV Client',
  version: options.version,
  tag: `v${options.version}`,
  commit: options.commit,
  releaseChannel: 'beta',
  signing: {
    mac: 'ad-hoc',
    win: 'unsigned',
    linux: 'unsigned',
  },
  ffmpeg: {
    source: ffmpegSource,
    sourceSha256: ffmpegSourceSha256,
    sourceAsset: sourceName,
  },
  builds,
};
await writeFile(
  join(assetsDirectory, 'release-manifest.json'),
  `${JSON.stringify(releaseManifest, null, 2)}\n`,
  'utf8',
);

const files = (await readdir(assetsDirectory, { withFileTypes: true }))
  .filter(entry => entry.isFile() && entry.name !== 'SHA256SUMS.txt')
  .map(entry => entry.name)
  .sort();
const globalChecksums = [];
for (const name of files) globalChecksums.push(`${await sha256(join(assetsDirectory, name))}  ${name}`);
await writeFile(join(assetsDirectory, 'SHA256SUMS.txt'), `${globalChecksums.join('\n')}\n`, 'utf8');

await mkdir(dirname(notesPath), { recursive: true });
await writeFile(notesPath, releaseNotes(options.version), 'utf8');
console.log(`Assembled and verified StreamShare Desktop ${options.version} with ${files.length + 1} release assets.`);

function parseArguments(arguments_) {
  const values = {};
  for (let index = 0; index < arguments_.length; index += 2) {
    const name = arguments_[index];
    const value = arguments_[index + 1];
    if (!['--assets', '--version', '--commit', '--notes'].includes(name) || !value) {
      throw new Error('Usage: assemble-release.mjs --assets <path> --version <beta> --commit <sha> --notes <path>');
    }
    values[name.slice(2)] = value;
  }
  if (!/^\d+\.\d+\.\d+-beta\.\d+$/.test(values.version || '')) throw new Error('A beta semantic version is required.');
  if (!/^[a-f0-9]{40}$/.test(values.commit || '')) throw new Error('A full commit SHA is required.');
  if (!values.assets || !values.notes) throw new Error('Assets and release notes paths are required.');
  return values;
}

function parseChecksums(contents, label) {
  const checksums = new Map();
  for (const line of contents.trim().split(/\r?\n/)) {
    const match = line.match(/^([a-f0-9]{64})  ([^/\\]+)$/);
    if (!match) throw new Error(`Invalid checksum entry in ${label}: ${line}`);
    if (checksums.has(match[2])) throw new Error(`Duplicate checksum entry in ${label}: ${match[2]}`);
    checksums.set(match[2], match[1]);
  }
  return checksums;
}

async function sha256(path) {
  const contents = await readFile(path);
  return createHash('sha256').update(contents).digest('hex');
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) throw new Error(`${label} mismatch: expected ${expected}, found ${actual}`);
}

function releaseNotes(version) {
  return `# StreamShare Desktop ${version}\n\n`
    + 'This is the first public beta of the StreamShare remote playback client for Windows, macOS and Linux.\n\n'
    + '## Installation notice\n\n'
    + '- **Windows:** these beta binaries are not yet Authenticode-signed. Microsoft Defender SmartScreen may display an unrecognized-app warning.\n'
    + '- **macOS:** the application bundle uses ad-hoc signing and is not notarized. Open it only after verifying the checksum and downloading it from this release. macOS may require **Open Anyway** under **System Settings > Privacy & Security**.\n'
    + '- **Linux:** choose DEB for Ubuntu or Debian, AppImage where FUSE 2 is available, or the portable tar.gz archive.\n\n'
    + 'Do not disable operating-system security protections globally and do not install a self-signed root certificate.\n\n'
    + '## Verification\n\n'
    + 'Every asset is listed in `SHA256SUMS.txt`. Build provenance can also be verified with:\n\n'
    + '```bash\n'
    + 'gh attestation verify <downloaded-file> -R tootiapps/streamshare-desktop\n'
    + '```\n\n'
    + 'The release includes SPDX SBOMs, per-platform build metadata, licence notices and the exact FFmpeg source archive used by the bundled builds.\n';
}
