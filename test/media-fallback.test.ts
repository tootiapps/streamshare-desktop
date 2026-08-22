import assert from 'node:assert/strict';
import test from 'node:test';
import {
  dolbyVisionToneMappingProbeArgs,
  fragmentedMp4VideoCodec,
  h264TranscodeArgs,
  h264TranscodePlan,
  type ProbeStream
} from '../src/media-fallback.js';

function hevc(sideData?: ProbeStream['side_data_list']): ProbeStream {
  return { index: 0, codec_type: 'video', codec_name: 'hevc', profile: 'Main 10', level: 153, side_data_list: sideData };
}

test('announces ordinary HEVC as hvc1', () => {
  assert.equal(fragmentedMp4VideoCodec(hevc()), 'hvc1.2.4.L153.B0');
});

test('announces Dolby Vision Profile 5 with the exact dvh1 profile and level', () => {
  assert.equal(fragmentedMp4VideoCodec(hevc([{
    side_data_type: 'DOVI configuration record',
    dv_profile: 5,
    dv_level: 6,
    dv_bl_signal_compatibility_id: 0
  }])), 'dvh1.05.06');
});

test('uses libplacebo only for explicit Dolby Vision SDR conversion', () => {
  const ordinary = h264TranscodeArgs('h264_mf');
  const toneMapped = h264TranscodeArgs('h264_mf', true);
  assert.doesNotMatch(ordinary.join(' '), /libplacebo/);
  assert.match(toneMapped.join(' '), /libplacebo=/);
  assert.match(toneMapped.join(' '), /apply_dolbyvision=true/);
  assert.match(toneMapped.join(' '), /colorspace=bt709/);
});

test('keeps the source resolution and raises the H.264 quality tier by default', () => {
  const plan = h264TranscodePlan('h264_videotoolbox', true, 'source', 3824, 1592);

  assert.equal(plan.width, 3824);
  assert.equal(plan.height, 1592);
  assert.equal(plan.mimeType, 'avc1.4D4033');
  assert.match(plan.args.join(' '), /libplacebo=w=3824:h=1592/);
  assert.match(plan.args.join(' '), /-b:v 24M -maxrate 32M -bufsize 48M/);
  assert.match(plan.args.join(' '), /-level:v 5\.1/);
});

test('caps conversion resolution without changing the source aspect ratio', () => {
  const plan = h264TranscodePlan('h264_mf', true, '1080p', 3824, 1592);

  assert.equal(plan.width, 1920);
  assert.equal(plan.height, 798);
  assert.equal(plan.mimeType, 'avc1.4D402A');
  assert.match(plan.args.join(' '), /libplacebo=w=1920:h=798/);
  assert.match(plan.args.join(' '), /-b:v 8M -maxrate 12M -bufsize 16M/);
  assert.match(plan.args.join(' '), /-profile:v 77 -level:v 42/);
});

test('probes libplacebo without requiring the disabled lavfi input device', () => {
  const probe = dolbyVisionToneMappingProbeArgs().join(' ');
  assert.match(probe, /-f rawvideo/);
  assert.match(probe, /-i pipe:0/);
  assert.doesNotMatch(probe, /lavfi/);
});
