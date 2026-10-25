import { base64ToBytes, bytesToBase64 } from "./pcm";

// Wraps 16-bit mono PCM in a WAV container so an ordinary audio player can play it.
export function buildWav(pcmBytes, sampleRate) {
  const header = new ArrayBuffer(44);
  const view = new DataView(header);
  const write = (offset, text) => {
    for (let i = 0; i < text.length; i += 1) view.setUint8(offset + i, text.charCodeAt(i));
  };
  write(0, "RIFF");
  view.setUint32(4, 36 + pcmBytes.length, true);
  write(8, "WAVE");
  write(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  write(36, "data");
  view.setUint32(40, pcmBytes.length, true);
  const wav = new Uint8Array(44 + pcmBytes.length);
  wav.set(new Uint8Array(header), 0);
  wav.set(pcmBytes, 44);
  return wav;
}

// Plays a stream of PCM chunks through a player that can only play whole files (expo-av).
// Chunks are batched into ~minBufferMs WAV clips; the next clip is loaded while the current
// one plays so gaps stay short.
//   createClip(wavBase64) -> Promise<{ play(): Promise<void> (resolves when finished), stop(), unload() }>
export function createPcmPlayer({ createClip, sampleRate = 24000, minBufferMs = 320, tailMs = 140, setTimer = setTimeout, clearTimer = clearTimeout }) {
  let pending = [];
  let pendingBytes = 0;
  let tailTimer = null;
  let generation = 0;
  let chain = Promise.resolve();
  let active = 0; // clips queued or playing
  let current = null;
  let lastEndsAt = 0;

  const bytesPerMs = (sampleRate * 2) / 1000;

  const flushPending = () => {
    if (tailTimer) {
      clearTimer(tailTimer);
      tailTimer = null;
    }
    if (!pendingBytes) return;
    const merged = new Uint8Array(pendingBytes);
    let offset = 0;
    for (const piece of pending) {
      merged.set(piece, offset);
      offset += piece.length;
    }
    pending = [];
    pendingBytes = 0;

    const myGeneration = generation;
    const wavBase64 = bytesToBase64(buildWav(merged, sampleRate));
    const durationMs = merged.length / bytesPerMs;
    active += 1;
    lastEndsAt = Math.max(lastEndsAt, Date.now()) + durationMs;
    // Start loading right away; play strictly in order.
    const loading = createClip(wavBase64).catch(() => null);
    chain = chain.then(async () => {
      const clip = await loading;
      try {
        if (clip && myGeneration === generation) {
          current = clip;
          await clip.play();
        }
      } catch {
        // a clip that fails to play is skipped
      } finally {
        if (current === clip) current = null;
        if (clip) await clip.unload().catch(() => {});
        active -= 1;
      }
    });
  };

  return {
    push(base64Pcm) {
      const bytes = base64ToBytes(base64Pcm);
      if (!bytes.length) return;
      pending.push(bytes);
      pendingBytes += bytes.length;
      if (tailTimer) clearTimer(tailTimer);
      if (pendingBytes / bytesPerMs >= minBufferMs) flushPending();
      else tailTimer = setTimer(flushPending, tailMs);
    },
    // Call when the model's turn is over so a short tail doesn't wait for the timer.
    endTurn: flushPending,
    // User interrupted: drop everything not yet heard.
    flush() {
      generation += 1;
      pending = [];
      pendingBytes = 0;
      if (tailTimer) {
        clearTimer(tailTimer);
        tailTimer = null;
      }
      lastEndsAt = 0;
      const playing = current;
      current = null;
      playing?.stop().catch(() => {});
    },
    isPlaying: () => active > 0 || pendingBytes > 0 || Date.now() < lastEndsAt,
  };
}
