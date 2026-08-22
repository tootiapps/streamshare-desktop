import { spawnSync } from 'node:child_process';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const packageDirectory = fileURLToPath(new URL('../', import.meta.url));
const testDirectory = join(packageDirectory, 'test');
const outputDirectory = await mkdtemp(join(tmpdir(), 'streamshare-tv-client-tests-'));

try {
  const entries = (await readdir(testDirectory))
    .filter(name => name.endsWith('.test.ts'))
    .map(name => join(testDirectory, name));
  await build({
    entryPoints: entries,
    outdir: outputDirectory,
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'node22',
    external: ['electron'],
    entryNames: '[name]'
  });
  const outputs = entries.map(entry => join(outputDirectory, `${basename(entry, '.ts')}.js`));
  const result = spawnSync(process.execPath, ['--test', ...outputs], { stdio: 'inherit' });
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
} finally {
  await rm(outputDirectory, { recursive: true, force: true });
}
