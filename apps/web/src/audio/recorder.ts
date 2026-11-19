// Browser echo cancellation, noise suppression and auto gain shift and smear the recorded click.
export const MIC_CONSTRAINTS: MediaStreamConstraints = {
  audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
};

export type MicErrorReason = 'denied' | 'no-device' | 'unsupported';

export class MicError extends Error {
  constructor(readonly reason: MicErrorReason) {
    super(`mic ${reason}`);
    this.name = 'MicError';
  }
}

export async function openMic(): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia) throw new MicError('unsupported');
  try {
    return await navigator.mediaDevices.getUserMedia(MIC_CONSTRAINTS);
  } catch (e) {
    const name = e instanceof DOMException ? e.name : undefined;
    if (name === 'NotAllowedError' || name === 'SecurityError') throw new MicError('denied');
    if (name === 'NotFoundError' || name === 'OverconstrainedError') throw new MicError('no-device');
    throw e;
  }
}

export type Recording = { blob: Blob; buffer: AudioBuffer; startedAt: number };

/** `startedAt` is the audio-clock time the recorder reported starting; sample 0 of the take maps to it. */
export function recordFrom(
  stream: MediaStream,
  ctx: AudioContext,
): { started: Promise<void>; stop(): Promise<Recording> } {
  const rec = new MediaRecorder(stream);
  const chunks: Blob[] = [];
  let startedAt = ctx.currentTime;
  const started = new Promise<void>((resolve, reject) => {
    rec.onstart = () => {
      startedAt = ctx.currentTime;
      resolve();
    };
    // Without this a recorder that fails before starting leaves callers awaiting `started` forever.
    rec.onerror = reject;
  });
  rec.ondataavailable = e => {
    if (e.data.size) chunks.push(e.data);
  };
  const stopped = new Promise<void>(resolve => {
    rec.onstop = () => resolve();
  });
  rec.start();

  return {
    started,
    async stop() {
      if (rec.state !== 'inactive') rec.stop();
      await stopped;
      const blob = new Blob(chunks, { type: rec.mimeType });
      const buffer = await ctx.decodeAudioData(await blob.arrayBuffer());
      return { blob, buffer, startedAt };
    },
  };
}
