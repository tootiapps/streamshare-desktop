import { cp, mkdir, readFile, rm } from 'node:fs/promises';
import { build } from 'esbuild';

const output = new URL('../dist/', import.meta.url);
const manifest = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });

await build({
  entryPoints: ['src/main.ts', 'src/preload.ts'],
  outdir: 'dist',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node22',
  outExtension: { '.js': '.cjs' },
  external: ['electron'],
  define: {
    __APP_VERSION__: JSON.stringify(manifest.version)
  },
  sourcemap: true
});

await build({
  entryPoints: ['src/renderer.ts'],
  outfile: 'dist/renderer.js',
  bundle: true,
  platform: 'browser',
  format: 'iife',
  target: 'chrome132',
  sourcemap: true
});

await cp('src/index.html', 'dist/index.html');
await cp('src/styles.css', 'dist/styles.css');
await cp('assets/logo.svg', 'dist/logo.svg');
await mkdir('dist/icons/macos', { recursive: true });
await mkdir('dist/icons/windows', { recursive: true });
await cp('assets/macos/icon.png', 'dist/icons/macos/icon.png');
await cp('assets/windows/icon.ico', 'dist/icons/windows/icon.ico');
await cp('assets/linux/icons', 'dist/icons/linux', { recursive: true });
