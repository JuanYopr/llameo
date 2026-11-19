import { expect, test } from 'vitest';
import { encodeWav, offsetFromFileName, takeFileName } from './wav';

test('take file name carries the signed offset and a safe output label', () => {
  expect(takeFileName('el-pescador', 232, 'AirPods Pro')).toBe('toma_el-pescador_+232ms_airpods-pro.wav');
  expect(takeFileName('caliente', -15, 'default')).toBe('toma_caliente_-15ms_default.wav');
});

test('offset round-trips through the file name', () => {
  expect(offsetFromFileName(takeFileName('el-pescador', 2656, 'Wired'))).toBe(2656);
  expect(offsetFromFileName('toma_caliente_-15ms_default.wav')).toBe(-15);
  expect(offsetFromFileName('mi-grabacion.wav')).toBeNull();
});

test('encodes a mono 16-bit WAV', async () => {
  const data = Float32Array.from([0, 1, -1, 0.5]);
  const buffer = { sampleRate: 48000, length: 4, getChannelData: () => data } as unknown as AudioBuffer;
  const view = new DataView(await encodeWav(buffer).arrayBuffer());
  expect(view.byteLength).toBe(44 + 8);
  expect(view.getUint32(24, true)).toBe(48000);
  expect(view.getUint16(34, true)).toBe(16);
  expect([0, 1, 2, 3].map(i => view.getInt16(44 + i * 2, true))).toEqual([0, 32767, -32767, 16384]);
});
