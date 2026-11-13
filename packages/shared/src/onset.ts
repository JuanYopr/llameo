export function detectOnset(
  samples: Float32Array,
  sampleRate: number,
  opts: { threshold?: number; fromSec?: number } = {},
): number | null {
  const threshold = opts.threshold ?? 0.2;
  const window = Math.round(0.005 * sampleRate);
  // A real click stays loud for a while; a single-sample pop does not.
  const minLoud = Math.round(0.001 * sampleRate);

  for (let i = Math.max(0, Math.round((opts.fromSec ?? 0) * sampleRate)); i < samples.length; i++) {
    if (Math.abs(samples[i]!) <= threshold) continue;
    let loud = 0;
    const end = Math.min(samples.length, i + window);
    for (let j = i; j < end; j++) if (Math.abs(samples[j]!) > threshold / 2) loud++;
    if (loud >= minLoud) return i / sampleRate;
  }
  return null;
}
