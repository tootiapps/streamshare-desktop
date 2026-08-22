import { lstat, readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ignoredDirectories = new Set(['.ffmpeg-cache', '.git', 'coverage', 'dist', 'node_modules', 'release']);
const ignoredFiles = new Set(['scripts/check-public-boundary.mjs']);
const textExtensions = new Set([
  '', '.cjs', '.css', '.html', '.js', '.json', '.md', '.mjs', '.sh', '.svg',
  '.ts', '.txt', '.yaml', '.yml',
]);
const forbiddenExtensions = new Set([
  '.appimage', '.cer', '.crt', '.db', '.deb', '.dmg', '.dll', '.dylib', '.exe',
  '.jks', '.keystore', '.key', '.log', '.mobileprovision', '.p12', '.p8', '.pem',
  '.pfx', '.sqlite', '.sqlite3', '.tgz', '.zip',
]);
const forbiddenContent = [
  ['macOS user path', /\/Users\/[A-Za-z0-9._-]+\//],
  ['Windows user path', /[A-Za-z]:\\Users\\[^\\]+\\/],
  ['private key', /-----BEGIN (?:OPENSSH |RSA |EC )?PRIVATE KEY-----/],
  ['private workspace dependency', /workspace:\*/],
  ['GitHub token', /(?:github_pat_|gh[pousr]_)[A-Za-z0-9_]{20,}/],
  ['npm token', /npm_[A-Za-z0-9]{20,}/],
];
const findings = [];

async function inspect(directory) {
  const entries = await readdir(directory, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) continue;

    const absolutePath = path.join(directory, entry.name);
    const relativePath = path.relative(repositoryRoot, absolutePath).replaceAll(path.sep, '/');
    const metadata = await lstat(absolutePath);

    if (metadata.isSymbolicLink()) {
      findings.push(`${relativePath}: symbolic links are not allowed`);
      continue;
    }
    if (metadata.isDirectory()) {
      await inspect(absolutePath);
      continue;
    }
    if (!metadata.isFile() || ignoredFiles.has(relativePath)) continue;
    if (metadata.size > 25 * 1024 * 1024) {
      findings.push(`${relativePath}: file exceeds 25 MiB`);
      continue;
    }

    const extension = path.extname(entry.name).toLowerCase();
    if ((entry.name.startsWith('.env') && entry.name !== '.env.example') || forbiddenExtensions.has(extension)) {
      findings.push(`${relativePath}: sensitive or generated file type`);
      continue;
    }
    if (!textExtensions.has(extension)) continue;

    const contents = await readFile(absolutePath, 'utf8');
    for (const [label, pattern] of forbiddenContent) {
      if (pattern.test(contents)) findings.push(`${relativePath}: ${label}`);
    }
  }
}

await inspect(repositoryRoot);

if (findings.length > 0) {
  console.error('Public repository boundary check failed:');
  for (const finding of findings.sort()) console.error(`- ${finding}`);
  process.exitCode = 1;
} else {
  console.log('Public repository boundary check passed.');
}
