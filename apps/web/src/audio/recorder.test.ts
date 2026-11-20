import { afterEach, expect, test, vi } from 'vitest';
import { MIC_CONSTRAINTS, MicError, openMic } from './recorder';

afterEach(() => vi.unstubAllGlobals());

function stubGetUserMedia(impl: () => Promise<MediaStream>) {
  vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: vi.fn(impl) } });
}

test('asks for the mic with all browser processing off', () => {
  expect(MIC_CONSTRAINTS).toEqual({
    audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
  });
});

test('passes MIC_CONSTRAINTS to getUserMedia', async () => {
  const stream = {} as MediaStream;
  stubGetUserMedia(() => Promise.resolve(stream));
  await expect(openMic()).resolves.toBe(stream);
  expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith(MIC_CONSTRAINTS);
});

test.each([
  ['NotAllowedError', 'denied'],
  ['NotFoundError', 'no-device'],
])('%s becomes reason %s', async (name, reason) => {
  stubGetUserMedia(() => Promise.reject(new DOMException('nope', name)));
  const err = await openMic().catch(e => e);
  expect(err).toBeInstanceOf(MicError);
  expect(err.reason).toBe(reason);
});

test('no navigator.mediaDevices is unsupported', async () => {
  vi.stubGlobal('navigator', {});
  const err = await openMic().catch(e => e);
  expect(err).toBeInstanceOf(MicError);
  expect(err.reason).toBe('unsupported');
});
