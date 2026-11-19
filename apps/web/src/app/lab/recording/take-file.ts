export function takeFileName(ritmo: string, offsetMs: number, output: string): string {
  const sign = offsetMs < 0 ? '-' : '+';
  const label = output.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'default';
  return `toma_${ritmo}_${sign}${Math.abs(Math.round(offsetMs))}ms_${label}.wav`;
}

export function offsetFromFileName(name: string): number | null {
  const m = /_([+-]\d+)ms_/.exec(name);
  return m ? Number(m[1]) : null;
}
