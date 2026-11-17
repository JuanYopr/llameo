import { expect, test } from 'vitest';
import { detectOnset } from './onset';

const RATE = 48000;

function noise(seconds: number, seed = 1): Float32Array {
  const out = new Float32Array(Math.round(seconds * RATE));
  let s = seed;
  for (let i = 0; i < out.length; i++) {
    s = (s * 1664525 + 1013904223) >>> 0;
    out[i] = (s / 0xffffffff - 0.5) * 0.02;
  }
  return out;
}

function burst(buf: Float32Array, atSample: number, ms = 10, amp = 0.8): void {
  const len = Math.round((ms / 1000) * RATE);
  for (let i = 0; i < len; i++) buf[atSample + i] = amp * (i % 2 ? -1 : 1);
}

test('finds a 10 ms burst at 0.3 s', () => {
  const buf = noise(1);
  burst(buf, 14400);
  expect(detectOnset(buf, RATE)).toBeCloseTo(0.3, 3);
});

test('ignores anything before fromSec', () => {
  const buf = noise(1);
  burst(buf, 14400);
  expect(detectOnset(buf, RATE, { fromSec: 0.5 })).toBeNull();
});

test('noise only returns null', () => {
  expect(detectOnset(noise(1), RATE)).toBeNull();
});

test('skips a single-sample pop and finds the real burst', () => {
  const buf = noise(1);
  buf[Math.round(0.1 * RATE)] = 0.9;
  burst(buf, Math.round(0.6 * RATE));
  expect(detectOnset(buf, RATE)).toBeCloseTo(0.6, 3);
});
