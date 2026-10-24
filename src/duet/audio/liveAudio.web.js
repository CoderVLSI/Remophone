import { LIVE_INPUT_RATE, LIVE_OUTPUT_RATE } from "../gemini/config";
import { floatToPcm16Base64, pcm16Base64ToFloat, resampleFloat, rmsLevel } from "./pcm";

const WORKLET_SOURCE = `
class DuetCapture extends AudioWorkletProcessor {
  process(inputs) {
    const channel = inputs[0] && inputs[0][0];
    if (channel) this.port.postMessage(channel.slice(0));
    return true;
  }
}
registerProcessor("duet-capture", DuetCapture);
`;

// Streams the microphone to Gemini Live as 16 kHz PCM16 and plays back 24 kHz PCM16.
export function createLiveAudio({ onChunk, onLevel }) {
  const AudioContextCtor =
    typeof window !== "undefined" ? window.AudioContext || window.webkitAudioContext : null;
  const supported =
    !!AudioContextCtor && typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia;

  let ctx = null;
  let stream = null;
  let sourceNode = null;
  let captureNode = null;
  let muted = false;
  let pending = [];
  let pendingLength = 0;
  let nextPlayTime = 0;
  const playing = new Set();

  const handleSamples = (samples) => {
    onLevel?.(rmsLevel(samples));
    if (muted) return;
    pending.push(samples);
    pendingLength += samples.length;
    // ~60 ms of audio per websocket message
    if (pendingLength < ctx.sampleRate * 0.06) return;
    const merged = new Float32Array(pendingLength);
    let offset = 0;
    for (const piece of pending) {
      merged.set(piece, offset);
      offset += piece.length;
    }
    pending = [];
    pendingLength = 0;
    onChunk(floatToPcm16Base64(resampleFloat(merged, ctx.sampleRate, LIVE_INPUT_RATE)));
  };

  return {
    supported,
    unsupportedReason: supported ? null : "This browser can't capture the microphone here. Open the app over HTTPS or localhost.",

    async start() {
      if (!supported) throw new Error("Microphone capture isn't available in this browser.");
      ctx = new AudioContextCtor();
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      if (ctx.state === "suspended") await ctx.resume();
      sourceNode = ctx.createMediaStreamSource(stream);

      if (ctx.audioWorklet) {
        const url = URL.createObjectURL(new Blob([WORKLET_SOURCE], { type: "application/javascript" }));
        try {
          await ctx.audioWorklet.addModule(url);
        } finally {
          URL.revokeObjectURL(url);
        }
        captureNode = new AudioWorkletNode(ctx, "duet-capture");
        captureNode.port.onmessage = (event) => handleSamples(event.data);
      } else {
        captureNode = ctx.createScriptProcessor(2048, 1, 1);
        captureNode.onaudioprocess = (event) => handleSamples(new Float32Array(event.inputBuffer.getChannelData(0)));
      }
      sourceNode.connect(captureNode);
      // The node must be connected to the graph to keep processing; it outputs silence.
      const silent = ctx.createGain();
      silent.gain.value = 0;
      captureNode.connect(silent);
      silent.connect(ctx.destination);
    },

    setMuted(value) {
      muted = value;
    },

    play(base64Pcm24k) {
      if (!ctx) return;
      const floats = pcm16Base64ToFloat(base64Pcm24k);
      if (!floats.length) return;
      const buffer = ctx.createBuffer(1, floats.length, LIVE_OUTPUT_RATE);
      buffer.copyToChannel(floats, 0);
      const node = ctx.createBufferSource();
      node.buffer = buffer;
      node.connect(ctx.destination);
      const startAt = Math.max(ctx.currentTime + 0.02, nextPlayTime);
      node.start(startAt);
      nextPlayTime = startAt + buffer.duration;
      playing.add(node);
      node.onended = () => playing.delete(node);
    },

    flush() {
      for (const node of playing) {
        try {
          node.stop();
        } catch {
          // already stopped
        }
      }
      playing.clear();
      nextPlayTime = 0;
    },

    isPlaying() {
      return !!ctx && nextPlayTime > ctx.currentTime;
    },

    async stop() {
      this.flush();
      try {
        captureNode?.disconnect();
        sourceNode?.disconnect();
      } catch {
        // ignore
      }
      stream?.getTracks().forEach((track) => track.stop());
      captureNode = null;
      sourceNode = null;
      stream = null;
      pending = [];
      pendingLength = 0;
      if (ctx) {
        try {
          await ctx.close();
        } catch {
          // ignore
        }
      }
      ctx = null;
    },
  };
}
