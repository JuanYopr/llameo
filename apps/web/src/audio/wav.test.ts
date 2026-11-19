import { expect, test } from 'vitest';
import { encodeWav } from './wav';

test('encodes a mono 16-bit WAV', async () => {
  const data = Float32Array.from([0, 1, -1, 0.5]);
  const buffer = { sampleRate: 48000, length: 4, getChannelData: () => data } as unknown as AudioBuffer;
  const view = new DataView(await encodeWav(buffer).arrayBuffer());
  expect(view.byteLength).toBe(44 + 8);
  expect(view.getUint32(24, true)).toBe(48000);
  expect(view.getUint16(34, true)).toBe(16);
  expect([0, 1, 2, 3].map(i => view.getInt16(44 + i * 2, true))).toEqual([0, 32767, -32767, 16384]);
});
