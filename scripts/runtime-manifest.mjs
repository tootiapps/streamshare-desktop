export function identifiesBundledLibplacebo(platform, runtimeManifest) {
  const runtimeComponents = runtimeManifest
    .split(/\r?\n/)
    .filter(Boolean)
    .map(line => line.split('\t'));

  if (platform === 'win') {
    return runtimeComponents.some(([file, packageName]) =>
      /^libplacebo(?:[-.]|$)/i.test(file)
      && packageName === 'mingw-w64-ucrt-x86_64-libplacebo');
  }

  if (platform === 'mac') {
    return runtimeComponents.some(([packageName]) => packageName === 'libplacebo');
  }

  return false;
}
