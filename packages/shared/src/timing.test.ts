import { expect, test } from 'vitest';
import { beatSeconds, schedulePlayback, stepSeconds, takeStart } from './timing';

test('El Pescador: 92 BPM, offset 0.255, count-in', () => {
  const s = schedulePlayback({ now: 10, bpm: 92, offsetSec: 0.255, countIn: true });
  expect(s.t0).toBeCloseTo(12.3537, 4);
  expect(s.firstBeat).toBeCloseTo(12.6087, 4);
  expect(s.countInClicks.map(c => +c.toFixed(4))).toEqual([10, 10.6522, 11.3043, 11.9565]);
});

test('Rap plena: first beat after the count-in length starts playback now', () => {
  const s = schedulePlayback({ now: 0, bpm: 89, offsetSec: 6.409, countIn: true });
  expect(s.t0).toBe(0);
  expect(s.firstBeat).toBeCloseTo(6.409, 4);
  expect(s.countInClicks[0]).toBeCloseTo(3.7124, 4);
});

test('no count-in: t0 is now, no clicks', () => {
  expect(schedulePlayback({ now: 5, bpm: 120, offsetSec: 1, countIn: false }))
    .toEqual({ t0: 5, firstBeat: 6, countInClicks: [] });
});

test('rate 0.75 slows beat and offset', () => {
  expect(beatSeconds(120, 0.75)).toBeCloseTo(0.6667, 4);
  const s = schedulePlayback({ now: 0, bpm: 120, offsetSec: 0.3, countIn: false, rate: 0.75 });
  expect(s.firstBeat).toBeCloseTo(0.4, 4);
});

test('stepSeconds: 16 steps and 12 steps (6/8) at 92 BPM', () => {
  expect(stepSeconds(92)).toBeCloseTo(0.16304, 4);
  expect(stepSeconds(92, 12)).toBeCloseTo(0.21739, 4);
});

test('takeStart: late take skips, nudged-later take waits', () => {
  expect(takeStart(2, 250)).toEqual({ when: 2, skipSec: 0.25 });
  const later = takeStart(2, -40);
  expect(later.when).toBeCloseTo(2.04, 4);
  expect(later.skipSec).toBe(0);
  expect(takeStart(2, 0)).toEqual({ when: 2, skipSec: 0 });
});
