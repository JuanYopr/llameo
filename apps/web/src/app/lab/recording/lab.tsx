'use client';

import { detectOnset } from '@llameo/shared/onset';
import type { Schedule } from '@llameo/shared/timing';
import { useRef, useState, type ChangeEvent } from 'react';
import {
  alignmentErrorMs,
  calibrate,
  clickThreshold,
  loadLatency,
  looksBluetooth,
  outputKey,
  saveLatency,
  takeOffsetMs,
} from '@/audio/calibration';
import { Engine, type Layer } from '@/audio/engine';
import { MicError, openMic, recordFrom, type MicErrorReason, type Recording } from '@/audio/recorder';
import { encodeWav } from '@/audio/wav';
import { offsetFromFileName, takeFileName } from './take-file';

const RITMOS = [
  { id: 'el-pescador', name: 'El Pescador', bpm: 92, offsetSec: 0.255 },
  { id: 'caliente', name: 'Caliente', bpm: 123, offsetSec: 1.022 },
] as const;
type Ritmo = (typeof RITMOS)[number];

const MIC_MESSAGES: Record<MicErrorReason, string> = {
  denied: 'No tengo permiso para usar el micrófono. Actívalo en los ajustes del navegador, o sube un archivo abajo.',
  'no-device': 'No encontré un micrófono. Puedes subir un archivo abajo.',
  unsupported: 'Este navegador no puede grabar. Puedes subir un archivo abajo.',
};

const CALIBRATION_MESSAGES = {
  'no-click-heard': 'No escuché los clics. Pon un audífono pegado al micrófono, sube el volumen y prueba otra vez.',
  inconsistent: 'Los clics llegaron con tiempos distintos. Prueba otra vez en un lugar callado.',
};

const PASS_MS = { wired: 20, bluetooth: 40 };

type Take = {
  buffer: AudioBuffer;
  offsetMs: number;
  // Only mic takes have a session; uploaded files can't be measured.
  session?: { t0: number; clicks: number[]; startedAt: number };
};

type Mic = { stream: MediaStream; output: string; latency: number | null };

export function Lab() {
  const [ritmo, setRitmo] = useState<Ritmo>(RITMOS[0]);
  const [output, setOutput] = useState<string | null>(null);
  const [latency, setLatency] = useState<number | null>(null);
  const [busy, setBusy] = useState<'calibrating' | 'starting' | 'recording' | null>(null);
  const [status, setStatus] = useState('');
  const [take, setTake] = useState<Take | null>(null);
  const [nudge, setNudge] = useState(0);
  const [errorMs, setErrorMs] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const totalOffsetMs = (take?.offsetMs ?? 0) + nudge;

  const audioRef = useRef<{ ctx: AudioContext; engine: Engine } | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const tracksRef = useRef(new Map<string, Promise<AudioBuffer>>());
  const recRef = useRef<{ stop(): Promise<Recording>; schedule: Schedule; latency: number } | null>(null);

  // Called first in every handler, inside the tap, so iOS lets the audio start.
  function audio() {
    if (!audioRef.current) {
      const ctx = new AudioContext();
      audioRef.current = { ctx, engine: new Engine(ctx) };
    }
    void audioRef.current.ctx.resume();
    return audioRef.current;
  }

  async function mic(): Promise<Mic | null> {
    try {
      streamRef.current ??= await openMic();
    } catch (e) {
      setStatus(e instanceof MicError ? MIC_MESSAGES[e.reason] : 'No pude abrir el micrófono.');
      return null;
    }
    // Labels only show after mic permission, and the output may have changed since the last calibration.
    const out = await outputKey();
    const stored = loadLatency(out);
    setOutput(out);
    setLatency(stored);
    return { stream: streamRef.current, output: out, latency: stored };
  }

  function loadTrack(ctx: AudioContext, r: Ritmo): Promise<AudioBuffer> {
    let p = tracksRef.current.get(r.id);
    if (!p) {
      p = fetch(`/lab/${r.id}.mp3`)
        .then(res => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return res.arrayBuffer();
        })
        .then(a => ctx.decodeAudioData(a));
      p.catch(() => tracksRef.current.delete(r.id));
      tracksRef.current.set(r.id, p);
    }
    return p;
  }

  function stopPlayback() {
    audioRef.current?.engine.stop();
    setPlaying(false);
  }

  async function onCalibrate() {
    const { ctx } = audio();
    stopPlayback();
    setBusy('calibrating');
    try {
      const m = await mic();
      if (!m) return;
      setStatus('Escuchando los clics…');
      const result = await calibrate(ctx, m.stream);
      if (!result.ok) return setStatus(CALIBRATION_MESSAGES[result.reason]);
      saveLatency(m.output, result.latencyMs);
      setLatency(result.latencyMs);
      setStatus(`Listo: ${result.latencyMs} ms de latencia con «${m.output}».`);
    } catch {
      setStatus('La calibración falló. Prueba otra vez.');
    } finally {
      setBusy(null);
    }
  }

  async function onRecord() {
    const { ctx, engine } = audio();
    stopPlayback();
    // Set before the first await: loading the ritmo can take seconds, and a second tap would start a second recorder.
    setBusy('starting');
    const m = await mic();
    if (!m) return setBusy(null);
    let track: AudioBuffer;
    try {
      track = await loadTrack(ctx, ritmo);
    } catch {
      setStatus('No pude cargar el audio del ritmo.');
      return setBusy(null);
    }
    let rec: ReturnType<typeof recordFrom>;
    try {
      // MediaRecorder throws on browsers that can't record this stream.
      rec = recordFrom(m.stream, ctx);
      await rec.started;
    } catch {
      setStatus('No pude empezar a grabar.');
      return setBusy(null);
    }
    const schedule = engine.play({ layers: [{ key: 'track', buffer: track }], ...ritmo, countIn: true });
    recRef.current = { stop: rec.stop, schedule, latency: m.latency ?? 0 };
    setTake(null);
    setErrorMs(null);
    setBusy('recording');
    setStatus(m.latency == null ? 'Grabando sin calibrar: la toma puede quedar corrida.' : 'Grabando…');
  }

  async function onStopRecording() {
    audioRef.current?.engine.stop();
    const r = recRef.current;
    recRef.current = null;
    if (!r) return;
    let recording: Recording;
    try {
      recording = await r.stop();
    } catch {
      setStatus('No pude leer la grabación. Prueba otra vez.');
      return;
    } finally {
      setBusy(null);
    }
    const { buffer, startedAt } = recording;
    const { t0, countInClicks } = r.schedule;
    setTake({ buffer, offsetMs: takeOffsetMs({ latencyMs: r.latency, t0, startedAt }), session: { t0, clicks: countInClicks, startedAt } });
    setNudge(0);
    setStatus('Toma lista. Escúchala y ajusta si hace falta.');
  }

  async function playWith(layers: Layer[]) {
    const { ctx, engine } = audio();
    let track: AudioBuffer;
    try {
      track = await loadTrack(ctx, ritmo);
    } catch {
      setStatus('No pude cargar el audio del ritmo.');
      return;
    }
    engine.play({ layers: [{ key: 'track', buffer: track, gain: 0.8 }, ...layers], ...ritmo, countIn: false });
    setPlaying(true);
  }

  const playTake = (t: Take) => playWith([{ key: 'take', buffer: t.buffer, offsetMs: totalOffsetMs }]);

  // `playing` stays true after the track ends on its own; the engine knows whether anything is still sounding.
  const sounding = () => playing && !!audioRef.current?.engine.playing;

  function onListen() {
    if (sounding()) return stopPlayback();
    if (take) void playTake(take);
  }

  function onNudgeDone() {
    if (sounding() && take) void playTake(take);
  }

  function onMeasure() {
    const s = take?.session;
    const [click, next] = s?.clicks ?? [];
    if (!take || !s || click == null || next == null) return;
    const samples = take.buffer.getChannelData(0);
    const rate = take.buffer.sampleRate;
    const from = Math.max(0, Math.round((click - s.startedAt - 0.1) * rate));
    const to = Math.round((next - s.startedAt - 0.1) * rate);
    const threshold = clickThreshold(samples.subarray(0, to), from);
    const onset = detectOnset(samples.subarray(from, to), rate, { threshold });
    if (onset == null) {
      setErrorMs(null);
      setStatus('No encontré el clic en la toma. Graba con un audífono pegado al micrófono.');
      return;
    }
    setErrorMs(alignmentErrorMs({ onsetInTakeSec: from / rate + onset, offsetMs: totalOffsetMs, clickSec: click, t0: s.t0 }));
    setStatus('');
  }

  function onDownload() {
    if (!take) return;
    const url = URL.createObjectURL(encodeWav(take.buffer));
    const a = document.createElement('a');
    a.href = url;
    a.download = takeFileName(ritmo.id, totalOffsetMs, output ?? 'default');
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function decodeFiles(e: ChangeEvent<HTMLInputElement>) {
    const { ctx } = audio();
    const files = [...(e.target.files ?? [])];
    e.target.value = '';
    try {
      return await Promise.all(files.map(async f => ({ name: f.name, buffer: await ctx.decodeAudioData(await f.arrayBuffer()) })));
    } catch {
      setStatus('No pude leer uno de los archivos.');
      return [];
    }
  }

  async function onUpload(e: ChangeEvent<HTMLInputElement>) {
    const [file] = await decodeFiles(e);
    if (!file) return;
    stopPlayback();
    setTake({ buffer: file.buffer, offsetMs: offsetFromFileName(file.name) ?? 0 });
    setNudge(0);
    setErrorMs(null);
    setStatus('Toma subida. Ajusta el desfase a oído.');
  }

  async function onMix(e: ChangeEvent<HTMLInputElement>) {
    const files = await decodeFiles(e);
    if (files.length === 0) return;
    const layers = files.map((f, i) => ({ key: `mix:${i}`, buffer: f.buffer, offsetMs: offsetFromFileName(f.name) ?? 0 }));
    await playWith(layers);
    setStatus(`Mezclando ${files.map((f, i) => `${f.name} (${layers[i]!.offsetMs} ms)`).join(', ')}`);
  }

  const bluetooth = output != null && looksBluetooth(output);
  const passMs = bluetooth ? PASS_MS.bluetooth : PASS_MS.wired;

  return (
    <section className="scr">
      <div>
        <p className="mono mut">LABORATORIO · NO PÚBLICO</p>
        <h2>Grabar a tiempo</h2>
      </div>

      <label className="mut">
        Ritmo{' '}
        <select
          value={ritmo.id}
          disabled={busy != null}
          onChange={e => {
            stopPlayback();
            setTake(null);
            setRitmo(RITMOS.find(r => r.id === e.target.value) ?? RITMOS[0]);
          }}
        >
          {RITMOS.map(r => (
            <option key={r.id} value={r.id}>
              {r.name} · {r.bpm} BPM
            </option>
          ))}
        </select>
      </label>

      <p className="mut">Usa audífonos para grabar, así el ritmo no se cuela en tu toma.</p>
      {bluetooth && <p style={{ color: 'var(--gold)' }}>Los audífonos Bluetooth atrasan la grabación. Mejor con cable.</p>}

      <p className="mono">
        Salida: {output ?? '—'} · Latencia: {latency == null ? 'sin calibrar' : `${latency} ms`}
      </p>
      <button className="btn alt" disabled={busy != null} onClick={onCalibrate}>
        {busy === 'calibrating' ? 'Calibrando…' : 'Calibrar'}
      </button>
      <p className="mut">Para calibrar, pon un audífono pegado al micrófono.</p>

      {busy === 'recording' ? (
        <button className="btn red" onClick={onStopRecording}>
          Detener
        </button>
      ) : (
        <button className="btn red" disabled={busy != null} onClick={onRecord}>
          {busy === 'starting' ? 'Preparando…' : 'Grabar'}
        </button>
      )}

      <p role="status">{status}</p>

      {take && (
        <>
          <h3>Revisar la toma</h3>
          <button className="btn" onClick={onListen}>
            {playing ? 'Parar' : 'Escuchar con el ritmo'}
          </button>
          <label className="mut">
            Ajuste: {nudge > 0 ? '+' : ''}
            {nudge} ms ({nudge >= 0 ? 'adelantar' : 'atrasar'})
            <input
              type="range"
              min={-500}
              max={500}
              step={5}
              value={nudge}
              onChange={e => {
                setNudge(Number(e.target.value));
                setErrorMs(null);
              }}
              onPointerUp={onNudgeDone}
              onKeyUp={onNudgeDone}
              style={{ width: '100%' }}
            />
          </label>
          <p className="mono">Desfase total: {totalOffsetMs} ms</p>
          {take.session && (
            <button className="btn alt" onClick={onMeasure}>
              Medir
            </button>
          )}
          {errorMs != null && (
            <p className="mono">
              Error: {errorMs > 0 ? '+' : ''}
              {errorMs.toFixed(1)} ms · {Math.abs(errorMs) <= passMs ? 'PASA' : 'NO PASA'} (±{passMs} ms)
            </p>
          )}
          <button className="btn alt" onClick={onDownload}>
            Descargar toma
          </button>
        </>
      )}

      <h3>Mezclar tomas</h3>
      <p className="mut">Elige dos o más tomas descargadas; suenan sobre el ritmo, cada una con su desfase.</p>
      <input type="file" accept=".wav,audio/wav" multiple disabled={busy != null} onChange={onMix} aria-label="Tomas para mezclar" />
      {playing && !take && (
        <button className="btn alt" onClick={stopPlayback}>
          Parar
        </button>
      )}

      <h3>Sin micrófono</h3>
      <input type="file" accept="audio/*" disabled={busy != null} onChange={onUpload} aria-label="Subir una toma" />
    </section>
  );
}
