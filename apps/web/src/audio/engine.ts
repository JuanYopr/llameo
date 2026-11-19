import { schedulePlayback, takeStart, type Schedule } from '@llameo/shared/timing';

export type Layer = { key: string; buffer: AudioBuffer; gain?: number; muted?: boolean; offsetMs?: number };

export const SCHEDULE_MARGIN_SEC = 0.12;
const FADE_SEC = 0.03;

export function clave(ctx: AudioContext, out: AudioNode, when: number, level: number): OscillatorNode {
  const osc = ctx.createOscillator();
  const env = ctx.createGain();
  const dur = 0.07;
  const peak = Math.max(level * 0.45, 0.0002);
  osc.type = 'sine';
  osc.frequency.setValueAtTime(2500, when);
  osc.frequency.exponentialRampToValueAtTime(2380, when + dur);
  env.gain.setValueAtTime(0.0001, when);
  env.gain.exponentialRampToValueAtTime(peak, when + 0.003);
  env.gain.exponentialRampToValueAtTime(0.0001, when + 0.003 + dur);
  osc.connect(env);
  env.connect(out);
  osc.start(when);
  osc.stop(when + dur + 0.05);
  return osc;
}

type Voice = { gain: GainNode; level: number; muted: boolean };

export class Engine {
  private readonly master: AudioNode;
  private voices = new Map<string, Voice>();
  private sources: AudioScheduledSourceNode[] = [];
  private live = 0;

  constructor(private readonly ctx: AudioContext) {
    const compressor = ctx.createDynamicsCompressor();
    const out = ctx.createGain();
    out.gain.value = 0.8;
    compressor.connect(out);
    out.connect(ctx.destination);
    this.master = compressor;
  }

  get playing(): boolean {
    return this.live > 0;
  }

  play(opts: {
    layers: Layer[];
    bpm: number;
    offsetSec: number;
    countIn: boolean;
    rate?: number;
    onEnded?: () => void;
  }): Schedule {
    this.stop();
    const rate = opts.rate ?? 1;
    const schedule = schedulePlayback({ ...opts, now: this.ctx.currentTime + SCHEDULE_MARGIN_SEC });

    schedule.countInClicks.forEach((t, i) => this.sources.push(clave(this.ctx, this.master, t, i === 0 ? 1.1 : 0.7)));

    for (const layer of opts.layers) {
      const voice: Voice = { gain: this.ctx.createGain(), level: layer.gain ?? 1, muted: !!layer.muted };
      voice.gain.gain.value = voice.muted ? 0 : voice.level;
      voice.gain.connect(this.master);
      this.voices.set(layer.key, voice);

      const src = this.ctx.createBufferSource();
      src.buffer = layer.buffer;
      // shortcut: rate changes pitch too; the prototype streams stems through <audio> to keep pitch. Port that with Práctica.
      if (rate !== 1) src.playbackRate.value = rate;
      src.connect(voice.gain);
      const { when, skipSec } = takeStart(schedule.t0, layer.offsetMs ?? 0);
      src.start(schedule.t0 + (when - schedule.t0) / rate, skipSec);
      src.onended = () => {
        this.live = Math.max(0, this.live - 1);
        if (this.live === 0) opts.onEnded?.();
      };
      this.sources.push(src);
      this.live++;
    }
    return schedule;
  }

  stop(): void {
    for (const src of this.sources) {
      src.onended = null;
      try {
        src.stop();
      } catch {
        // clave() already scheduled its own stop(); older WebKit throws InvalidStateError on a second one.
      }
    }
    for (const v of this.voices.values()) v.gain.disconnect();
    this.sources = [];
    this.voices.clear();
    this.live = 0;
  }

  setMuted(key: string, muted: boolean): void {
    const v = this.voices.get(key);
    if (!v) return;
    v.muted = muted;
    v.gain.gain.setTargetAtTime(muted ? 0 : v.level, this.ctx.currentTime, FADE_SEC);
  }

  setGain(key: string, gain: number): void {
    const v = this.voices.get(key);
    if (!v) return;
    v.level = gain;
    if (!v.muted) v.gain.gain.setTargetAtTime(gain, this.ctx.currentTime, FADE_SEC);
  }
}
