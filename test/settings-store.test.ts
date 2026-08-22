import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { SettingsStore } from '../src/settings-store.js';

test('migrates existing settings to automatic Dolby Vision handling at source resolution', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'streamshare-settings-'));
  try {
    const path = join(directory, 'settings.json');
    await writeFile(path, JSON.stringify({ receiverId: 'existing', deviceName: 'TV', ffmpegEnabled: true }));
    const settings = await new SettingsStore(path, 'Streamshare TV').load();
    assert.equal(settings.dolbyVisionMode, 'automatic');
    assert.equal(settings.videoTranscodeResolution, 'source');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('persists a video conversion resolution limit', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'streamshare-settings-'));
  try {
    const path = join(directory, 'settings.json');
    const store = new SettingsStore(path, 'Streamshare TV');
    await store.load();
    await store.update({ videoTranscodeResolution: '1080p' });
    assert.equal(JSON.parse(await readFile(path, 'utf8')).videoTranscodeResolution, '1080p');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('persists an explicit SDR preference', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'streamshare-settings-'));
  try {
    const path = join(directory, 'settings.json');
    const store = new SettingsStore(path, 'Streamshare TV');
    await store.load();
    await store.update({ dolbyVisionMode: 'sdr' });
    assert.equal(JSON.parse(await readFile(path, 'utf8')).dolbyVisionMode, 'sdr');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
