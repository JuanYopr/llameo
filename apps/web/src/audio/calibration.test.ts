import { afterEach, expect, test, vi } from 'vitest';
import { detectOnset } from '@llameo/shared/onset';
import { alignmentErrorMs, clickThreshold, loadLatency, saveLatency, summarize, takeOffsetMs } from './calibration';

afterEach(() => vi.unstubAllGlobals());

const scheduled = [1, 1.6, 2.2, 2.8, 3.4];

test('five clicks heard 180 ms late give 180 ms', () => {
  expect(summarize(scheduled.map(s => s + 0.18), scheduled)).toEqual({ ok: true, latencyMs: 180 });
});

test('one missed click still passes with the median of the rest', () => {
  const onsets = [1.2, null, 2.41, 3.0, 3.61];
  expect(summarize(onsets, scheduled)).toEqual({ ok: true, latencyMs: 205 });
});

test('two missed clicks fail as no-click-heard', () => {
  const onsets = [1.18, null, 2.38, null, 3.58];
  expect(summarize(onsets, scheduled)).toEqual({ ok: false, reason: 'no-click-heard' });
});

test('latencies spread over 40 ms fail as inconsistent', () => {
  const onsets = scheduled.map((s, i) => s + 0.18 + i * 0.01);
  expect(summarize(onsets, scheduled)).toEqual({ ok: false, reason: 'inconsistent' });
});

test('a take recorded from before t0 skips the lead-in plus the latency', () => {
  expect(takeOffsetMs({ latencyMs: 232, t0: 12.4737, startedAt: 10.05 })).toBe(2656);
});

test('with the true latency the recorded click lines up exactly', () => {
  const t0 = 12.4737, startedAt = 10.05, click = 10.12, latencyMs = 232;
  const onsetInTake = click + latencyMs / 1000 - startedAt;
  const offsetMs = takeOffsetMs({ latencyMs, t0, startedAt });
  expect(alignmentErrorMs({ onsetInTakeSec: onsetInTake, offsetMs, clickSec: click, t0 })).toBeCloseTo(0, 0);
  expect(alignmentErrorMs({ onsetInTakeSec: onsetInTake, offsetMs: offsetMs - 30, clickSec: click, t0 })).toBeCloseTo(30, 0);
});

test('a recording with only room noise finds no click at any scheduled time', () => {
  const rate = 48000;
  let seed = 7;
  const samples = Float32Array.from({ length: rate * 4 }, () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return (seed / 0xffffffff - 0.5) * 0.08;
  });
  const threshold = clickThreshold(samples, rate / 2);
  const onsets = scheduled.map(t => detectOnset(samples, rate, { threshold, fromSec: t }));
  expect(summarize(onsets, scheduled)).toEqual({ ok: false, reason: 'no-click-heard' });
});

test('a real click stays above the threshold', () => {
  const samples = new Float32Array(48000).fill(0.001);
  samples.fill(0.5, 30000, 30500);
  expect(clickThreshold(samples, 24000)).toBeLessThan(0.5);
});

test('saveLatency then loadLatency returns the value', () => {
  const store = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => store.set(k, v),
  });
  saveLatency('AirPods', 232);
  expect(loadLatency('AirPods')).toBe(232);
  expect(loadLatency('Wired')).toBeNull();
});

test('loadLatency returns null when localStorage throws', () => {
  vi.stubGlobal('localStorage', {
    getItem: () => {
      throw new Error('blocked');
    },
  });
  expect(loadLatency('AirPods')).toBeNull();
});
