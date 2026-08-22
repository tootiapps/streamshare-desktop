import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const platform = process.platform === 'darwin' ? 'mac' : process.platform === 'win32' ? 'win' : 'linux';
const architecture = process.arch;
if (!['x64', 'arm64'].includes(architecture)) {
  throw new Error(`Unsupported host architecture: ${architecture}`);
}

const environment = hostBuildEnvironment(platform, architecture);
if (platform === 'mac') assertNativeMacDependencies(architecture, environment);

const result = spawnSync('bash', ['scripts/build-bundled-ffmpeg.sh', platform, architecture], {
  cwd: new URL('../', import.meta.url),
  stdio: 'inherit',
  env: environment
});
if (result.error || result.status !== 0) {
  throw new Error(result.error?.message || `FFmpeg bundle build failed with exit code ${result.status}`);
}

function assertNativeMacDependencies(hostArchitecture, commandEnvironment) {
  const requiredArchitecture = hostArchitecture === 'x64' ? 'x86_64' : 'arm64';
  for (const [formula, library] of [
    ['libplacebo', 'lib/libplacebo.dylib'],
    ['molten-vk', 'lib/libMoltenVK.dylib']
  ]) {
    const prefix = collect('brew', ['--prefix', formula], commandEnvironment);
    const architectures = collect('lipo', ['-archs', join(prefix, library)], commandEnvironment).split(/\s+/);
    if (!architectures.includes(requiredArchitecture)) {
      throw new Error(
        `${formula} is ${architectures.join('/') || 'an unknown architecture'}, but this Mac requires ${requiredArchitecture}. `
        + 'Install a native Homebrew in /opt/homebrew and run brew install nasm pkgconf libplacebo molten-vk.'
      );
    }
  }
}

function hostBuildEnvironment(hostPlatform, hostArchitecture) {
  if (hostPlatform !== 'mac') return process.env;
  const nativePrefix = hostArchitecture === 'arm64' ? '/opt/homebrew' : '/usr/local';
  if (!existsSync(join(nativePrefix, 'bin', 'brew'))) return process.env;
  return {
    ...process.env,
    PATH: `${join(nativePrefix, 'bin')}:${join(nativePrefix, 'sbin')}:${process.env.PATH || ''}`
  };
}

function collect(command, args, commandEnvironment) {
  const result = spawnSync(command, args, { encoding: 'utf8', env: commandEnvironment });
  if (result.error || result.status !== 0) {
    throw new Error(result.error?.message || `${command} ${args.join(' ')} failed: ${result.stderr || result.status}`);
  }
  return result.stdout.trim();
}
