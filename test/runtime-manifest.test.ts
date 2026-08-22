import assert from 'node:assert/strict';
import test from 'node:test';
import { identifiesBundledLibplacebo } from '../scripts/runtime-manifest.mjs';

test('identifies the versioned Windows libplacebo DLL from its owning package', () => {
  const manifest = [
    'libplacebo-349.dll\tmingw-w64-ucrt-x86_64-libplacebo\t7.351.0-1',
    'vulkan-1.dll\tmingw-w64-ucrt-x86_64-vulkan-loader\t1.4.321.0-1'
  ].join('\n');

  assert.equal(identifiesBundledLibplacebo('win', manifest), true);
});

test('does not trust a Windows DLL without the expected package owner', () => {
  const manifest = 'libplacebo-349.dll\tan-unrelated-package\t1.0.0';

  assert.equal(identifiesBundledLibplacebo('win', manifest), false);
});

test('identifies the macOS libplacebo formula entry', () => {
  const manifest = 'libplacebo\t7.351.0\tLGPL-2.1-or-later\thttps://libplacebo.org';

  assert.equal(identifiesBundledLibplacebo('mac', manifest), true);
});
