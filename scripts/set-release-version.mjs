import { readFile, writeFile } from 'node:fs/promises';

const [version] = process.argv.slice(2).filter(argument => argument !== '--');
if (!/^\d+\.\d+\.\d+-beta\.\d+$/.test(version || '')) {
  console.error('Usage: node scripts/set-release-version.mjs <major.minor.patch-beta.number>');
  process.exit(1);
}

const manifestUrl = new URL('../package.json', import.meta.url);
const manifest = JSON.parse(await readFile(manifestUrl, 'utf8'));
if (manifest.private !== true || manifest.name !== '@streamshare/tv-client') {
  throw new Error('Refusing to version an unexpected package.');
}

manifest.version = version;
await writeFile(manifestUrl, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
console.log(`Prepared StreamShare Desktop ${version} in the workflow workspace.`);
