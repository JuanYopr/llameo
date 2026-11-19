import { detectOnset } from '@llameo/shared/onset';
import { clave } from './engine';
import { recordFrom } from './recorder';

export type CalibrationResult =
  | { ok: true; latencyMs: number }
  | { ok: false; reason: 'no-click-heard' | 'inconsistent' };

const CLICKS = 5;
const CLICK_GAP_SEC = 0.6;
const MIN_HEARD = 4;
const MAX_SPREAD_MS = 15;

export function summarize(onsetsSec: (number | null)[], scheduledSec: number[]): CalibrationResult {
  const latencies = onsetsSec
    .map((onset, i) => (onset == null ? null : (onset - scheduledSec[i]!) * 1000))
    .filter((ms): ms is number => ms != null)
    .sort((a, b) => a - b);
  if (latencies.length < MIN_HEARD) return { ok: false, reason: 'no-click-heard' };
  if (latencies.at(-1)! - latencies[0]! > MAX_SPREAD_MS) return { ok: false, reason: 'inconsistent' };
  const mid = latencies.length / 2;
  const median = latencies.length % 2 ? latencies[Math.floor(mid)]! : (latencies[mid - 1]! + latencies[mid]!) / 2;
  return { ok: true, latencyMs: Math.round(median) };
}

/**
 * A click must stand well above the room's noise; otherwise noise alone would "find" a click right at
 * every scheduled time and calibrate to ~0 ms.
 */
export function clickThreshold(samples: Float32Array, quietSamples: number): number {
  let sum = 0;
  let peak = 0;
  const quiet = Math.max(1, Math.min(quietSamples, samples.length));
  for (let i = 0; i < samples.length; i++) {
    const a = Math.abs(samples[i]!);
    if (i < quiet) sum += a * a;
    if (a > peak) peak = a;
  }
  return Math.max(0.02, 6 * Math.sqrt(sum / quiet), 0.3 * peak);
}

/** Plays clicks while recording and measures how late the mic hears them, on the audio clock. */
export async function calibrate(ctx: AudioContext, stream: MediaStream): Promise<CalibrationResult> {
  const recording = recordFrom(stream, ctx);
  const first = ctx.currentTime + 0.8;
  const scheduled = Array.from({ length: CLICKS }, (_, i) => first + i * CLICK_GAP_SEC);
  scheduled.forEach(t => clave(ctx, ctx.destination, t, 2));

  await new Promise(r => setTimeout(r, (scheduled.at(-1)! + CLICK_GAP_SEC - ctx.currentTime) * 1000));
  const { buffer, startedAt } = await recording.stop();

  const samples = buffer.getChannelData(0);
  const rate = buffer.sampleRate;
  const threshold = clickThreshold(samples, Math.round((first - startedAt - 0.1) * rate));
  const onsets = scheduled.map(t => {
    // Each click gets its own window so a late (Bluetooth) click can't be mistaken for the next one.
    const from = Math.max(0, Math.round((t - startedAt - 0.1) * rate));
    const to = Math.round((t - startedAt + CLICK_GAP_SEC - 0.1) * rate);
    const onset = detectOnset(samples.subarray(from, to), rate, { threshold });
    return onset == null ? null : startedAt + from / rate + onset;
  });
  return summarize(onsets, scheduled);
}

/** Skip into the take so that what the mic heard at `t0` plays at `t0`. */
export function takeOffsetMs(latencyMs: number, t0: number, startedAt: number): number {
  return Math.round(latencyMs + (t0 - startedAt) * 1000);
}

/** How far a click recorded in the take lands from where it was played, once `offsetMs` is applied. */
export function alignmentErrorMs(onsetInTakeSec: number, offsetMs: number, clickSec: number, t0: number): number {
  return (onsetInTakeSec - offsetMs / 1000 - (clickSec - t0)) * 1000;
}

export async function outputKey(): Promise<string> {
  try {
    const outputs = (await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === 'audiooutput' && d.label);
    return (outputs.find(d => d.deviceId === 'default') ?? outputs[0])?.label ?? 'default';
  } catch {
    return 'default';
  }
}

export function looksBluetooth(label: string): boolean {
  return /airpods|buds|bluetooth/i.test(label);
}

const storageKey = (key: string) => `llameo.latency.${key}`;

export function saveLatency(key: string, ms: number): void {
  try {
    localStorage.setItem(storageKey(key), String(ms));
  } catch {
    // Private mode or blocked storage: the user just calibrates again next time.
  }
}

export function loadLatency(key: string): number | null {
  try {
    const raw = localStorage.getItem(storageKey(key));
    const ms = raw == null ? NaN : Number(raw);
    return Number.isFinite(ms) ? ms : null;
  } catch {
    return null;
  }
}
