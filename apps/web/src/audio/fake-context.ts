type Call = [string, ...number[]];

function param(calls: Call[], value = 1) {
  return {
    value,
    setValueAtTime: (v: number, t: number) => calls.push(['setValueAtTime', v, t]),
    setTargetAtTime: (v: number, t: number, c: number) => calls.push(['setTargetAtTime', v, t, c]),
    exponentialRampToValueAtTime: (v: number, t: number) => calls.push(['exponentialRampToValueAtTime', v, t]),
  };
}

export class FakeNode {
  calls: Call[] = [];
  gain = param(this.calls);
  frequency = param(this.calls);
  playbackRate = param(this.calls);
  buffer: unknown = null;
  type = '';
  onended: (() => void) | null = null;
  constructor(readonly kind: string) {}
  connect() {}
  disconnect() {}
  start(when = 0, skip = 0) { this.calls.push(['start', when, skip]); }
  stop(when = 0) { this.calls.push(['stop', when]); }
}

export class FakeContext {
  currentTime = 0;
  destination = new FakeNode('destination');
  nodes: FakeNode[] = [];
  private make(kind: string) {
    const n = new FakeNode(kind);
    this.nodes.push(n);
    return n;
  }
  createGain() { return this.make('gain'); }
  createDynamicsCompressor() { return this.make('compressor'); }
  createOscillator() { return this.make('oscillator'); }
  createBufferSource() { return this.make('buffer'); }
  of(kind: string) { return this.nodes.filter(n => n.kind === kind); }
  asContext() { return this as unknown as AudioContext; }
}

export const fakeBuffer = (seconds: number) => ({ duration: seconds }) as AudioBuffer;
