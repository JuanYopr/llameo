export function takeFileName(ritmo: string, offsetMs: number, output: string): string {
  const sign = offsetMs < 0 ? '-' : '+';
  const label = output.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'default';
  return `toma_${ritmo}_${sign}${Math.abs(Math.round(offsetMs))}ms_${label}.wav`;
}

export function offsetFromFileName(name: string): number | null {
  const m = /_([+-]\d+)ms_/.exec(name);
  return m ? Number(m[1]) : null;
}

/** Mono 16-bit PCM from the first channel. */
export function encodeWav(buffer: AudioBuffer): Blob {
  const samples = buffer.getChannelData(0).subarray(0, buffer.length);
  const view = new DataView(new ArrayBuffer(44 + samples.length * 2));
  const ascii = (at: number, s: string) => [...s].forEach((c, i) => view.setUint8(at + i, c.charCodeAt(0)));
  ascii(0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  ascii(8, 'WAVE');
  ascii(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, buffer.sampleRate, true);
  view.setUint32(28, buffer.sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  ascii(36, 'data');
  view.setUint32(40, samples.length * 2, true);
  samples.forEach((s, i) => view.setInt16(44 + i * 2, Math.round(Math.max(-1, Math.min(1, s)) * 32767), true));
  return new Blob([view], { type: 'audio/wav' });
}
