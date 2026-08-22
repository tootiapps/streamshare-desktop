import assert from 'node:assert/strict';
import test from 'node:test';
import { compatibilityVideoOptions, resolveDolbyVisionPlayback } from '../src/dolby-vision-policy.js';

test('automatic mode keeps native Profile 5 when exact support is confirmed', () => {
  assert.deepEqual(resolveDolbyVisionPlayback('automatic', 5, true, true), {
    transcodeVideo: false,
    toneMapDolbyVision: false,
    nativeDolbyVisionSupported: true
  });
});

test('automatic mode requests SDR conversion only when Profile 5 is unsupported', () => {
  assert.deepEqual(resolveDolbyVisionPlayback('automatic', 5, false, false), {
    transcodeVideo: true,
    toneMapDolbyVision: true,
    nativeDolbyVisionSupported: false
  });
});

test('native and SDR overrides remain explicit', () => {
  assert.deepEqual(resolveDolbyVisionPlayback('native', 5, true), {
    transcodeVideo: false,
    toneMapDolbyVision: false
  });
  assert.deepEqual(resolveDolbyVisionPlayback('sdr', 5, false), {
    transcodeVideo: true,
    toneMapDolbyVision: true
  });
});

test('non Profile 5 video follows the ordinary codec fallback', () => {
  assert.deepEqual(resolveDolbyVisionPlayback('sdr', 8, false), {
    transcodeVideo: false,
    toneMapDolbyVision: false
  });
});

test('forwards the Dolby Vision decision when a compatibility session is restarted', () => {
  const decision = resolveDolbyVisionPlayback('automatic', 5, false, false);
  assert.deepEqual(compatibilityVideoOptions(decision), {
    transcodeVideo: true,
    toneMapDolbyVision: true
  });
});
