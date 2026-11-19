import { beforeEach, expect, test, vi } from 'vitest';
import { Engine } from './engine';
import { FakeContext, fakeBuffer } from './fake-context';

let ctx: FakeContext;
let engine: Engine;

const pescador = { bpm: 92, offsetSec: 0.255, countIn: true };

beforeEach(() => {
  ctx = new FakeContext();
  ctx.currentTime = 10;
  engine = new Engine(ctx.asContext());
});

function starts(kind: string) {
  return ctx.of(kind).flatMap(n => n.calls.filter(c => c[0] === 'start'));
}

test('El Pescador: track and take start at t0, the take skips its offset', () => {
  const s = engine.play({
    ...pescador,
    layers: [
      { key: 'track', buffer: fakeBuffer(180) },
      { key: 'take:1', buffer: fakeBuffer(170), offsetMs: 250 },
    ],
  });
  expect(s.t0).toBeCloseTo(12.4737, 4);
  const [track, take] = starts('buffer');
  expect(track![1]).toBeCloseTo(12.4737, 4);
  expect(track![2]).toBe(0);
  expect(take![1]).toBeCloseTo(12.4737, 4);
  expect(take![2]).toBeCloseTo(0.25, 4);
  expect(engine.playing).toBe(true);
});

test('a take nudged later than recorded waits after t0 instead of a negative skip', () => {
  const s = engine.play({ ...pescador, layers: [{ key: 'take:1', buffer: fakeBuffer(10), offsetMs: -40 }] });
  const [take] = starts('buffer');
  expect(take![1]).toBeCloseTo(s.t0 + 0.04, 4);
  expect(take![2]).toBe(0);
});

test('count-in schedules four clave clicks, the first after the scheduling margin', () => {
  engine.play({ ...pescador, layers: [] });
  const clicks = starts('oscillator').map(c => c[1]!);
  expect(clicks).toHaveLength(4);
  expect(clicks[0]).toBeCloseTo(10.12, 4);
});

test('setMuted fades that layer to 0 and back to its level', () => {
  engine.play({ ...pescador, layers: [{ key: 'take:1', buffer: fakeBuffer(10), gain: 0.6 }] });
  const layerGain = ctx.of('gain').at(-1)!;
  engine.setMuted('take:1', true);
  expect(layerGain.calls.at(-1)?.slice(0, 2)).toEqual(['setTargetAtTime', 0]);
  engine.setMuted('take:1', false);
  expect(layerGain.calls.at(-1)?.slice(0, 2)).toEqual(['setTargetAtTime', 0.6]);
});

test('setGain while muted keeps it silent and is used on unmute', () => {
  engine.play({ ...pescador, layers: [{ key: 'take:1', buffer: fakeBuffer(10), muted: true }] });
  const layerGain = ctx.of('gain').at(-1)!;
  expect(layerGain.gain.value).toBe(0);
  engine.setGain('take:1', 0.3);
  expect(layerGain.calls.some(c => c[0] === 'setTargetAtTime')).toBe(false);
  engine.setMuted('take:1', false);
  expect(layerGain.calls.at(-1)?.slice(0, 2)).toEqual(['setTargetAtTime', 0.3]);
});

test('stop stops every source and playing becomes false', () => {
  engine.play({ ...pescador, layers: [{ key: 'track', buffer: fakeBuffer(10) }] });
  engine.stop();
  expect(ctx.of('buffer')[0]!.calls.some(c => c[0] === 'stop')).toBe(true);
  expect(engine.playing).toBe(false);
});

test('stop cuts pending count-in clicks immediately', () => {
  engine.play({ ...pescador, layers: [] });
  engine.stop();
  for (const osc of ctx.of('oscillator')) expect(osc.calls.at(-1)).toEqual(['stop', 0]);
});

test('playing becomes false when the last layer ends on its own', () => {
  const ended = vi.fn();
  engine.play({ ...pescador, onEnded: ended, layers: [{ key: 'a', buffer: fakeBuffer(1) }, { key: 'b', buffer: fakeBuffer(2) }] });
  const [a, b] = ctx.of('buffer');
  a!.onended!();
  expect(engine.playing).toBe(true);
  b!.onended!();
  expect(engine.playing).toBe(false);
  expect(ended).toHaveBeenCalledOnce();
});
