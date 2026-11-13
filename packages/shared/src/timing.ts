const COUNT_IN_BEATS = 4;

export type Schedule = { t0: number; firstBeat: number; countInClicks: number[] };

export function beatSeconds(bpm: number, rate = 1): number {
  return 60 / bpm / rate;
}

export function stepSeconds(bpm: number, stepsPerBar: 12 | 16 = 16, rate = 1): number {
  return beatSeconds(bpm, rate) / (stepsPerBar / 4);
}

export function schedulePlayback(opts: {
  now: number;
  bpm: number;
  offsetSec: number;
  countIn: boolean;
  rate?: number;
}): Schedule {
  const rate = opts.rate ?? 1;
  const beat = beatSeconds(opts.bpm, rate);
  const offset = opts.offsetSec / rate;
  if (!opts.countIn) return { t0: opts.now, firstBeat: opts.now + offset, countInClicks: [] };

  const lead = COUNT_IN_BEATS * beat;
  // A track whose first beat comes later than the count-in starts now; the clicks wait for it.
  const t0 = opts.now + Math.max(0, lead - offset);
  const firstBeat = t0 + offset;
  const countInClicks = Array.from({ length: COUNT_IN_BEATS }, (_, i) => firstBeat - lead + i * beat);
  return { t0, firstBeat, countInClicks };
}

export function takeStart(t0: number, offsetMs: number): { when: number; skipSec: number } {
  return offsetMs >= 0
    ? { when: t0, skipSec: offsetMs / 1000 }
    : { when: t0 - offsetMs / 1000, skipSec: 0 };
}
