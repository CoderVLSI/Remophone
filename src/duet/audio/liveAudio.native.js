import { LIVE_INPUT_RATE, LIVE_OUTPUT_RATE } from "../gemini/config";
import { floatToPcm16Base64, pcm16Base64ToFloat, rmsLevel } from "./pcm";

// Native streaming audio needs raw PCM capture and queued PCM playback, which Expo Go
// cannot do. It is built on react-native-audio-api, which requires a development build
// on a React Native version it supports (0.81+, so Expo SDK 54 or newer). This app is on
// SDK 51, so the module is absent and voice shows a clear message instead.
// The code below is written against the library's published types and has NOT been run
// on a device.
let Api = null;
try {
  // eslint-disable-next-line global-require
  Api = require("react-native-audio-api");
} catch {
  Api = null;
}

export function createLiveAudio({ onChunk, onLevel }) {
  if (!Api) {
    return {
      supported: false,
      unsupportedReason:
        "Live voice needs a development build with react-native-audio-api (Expo SDK 54+). Text chat works everywhere, and live voice works today in the web version.",
      async start() {
        throw new Error(this.unsupportedReason);
      },
      setMuted() {},
      play() {},
      flush() {},
      isPlaying: () => false,
      async stop() {},
    };
  }

  const { AudioContext, AudioRecorder, AudioManager } = Api;
  let recorder = null;
  let ctx = null;
  let queue = null;
  let muted = false;
  let playingUntil = 0;

  return {
    supported: true,
    unsupportedReason: null,

    async start() {
      const permission = await AudioManager.requestRecordingPermissions();
      if (permission !== "Granted") throw new Error("Microphone permission was denied.");
      AudioManager.setAudioSessionOptions({
        iosCategory: "playAndRecord",
        iosMode: "voiceChat",
        iosOptions: ["defaultToSpeaker", "allowBluetooth"],
      });
      ctx = new AudioContext({ sampleRate: LIVE_OUTPUT_RATE });
      queue = ctx.createBufferQueueSource();
      queue.connect(ctx.destination);
      queue.start();

      recorder = new AudioRecorder({
        sampleRate: LIVE_INPUT_RATE,
        bufferLengthInSamples: Math.round(LIVE_INPUT_RATE * 0.06),
      });
      recorder.onAudioReady(({ buffer }) => {
        const samples = buffer.getChannelData(0);
        onLevel?.(rmsLevel(samples));
        if (!muted) onChunk(floatToPcm16Base64(samples));
      });
      recorder.start();
    },

    setMuted(value) {
      muted = value;
    },

    play(base64Pcm24k) {
      if (!ctx || !queue) return;
      const floats = pcm16Base64ToFloat(base64Pcm24k);
      if (!floats.length) return;
      const buffer = ctx.createBuffer(1, floats.length, LIVE_OUTPUT_RATE);
      buffer.copyToChannel(floats, 0);
      queue.enqueueBuffer(buffer);
      playingUntil = Math.max(playingUntil, Date.now()) + (floats.length / LIVE_OUTPUT_RATE) * 1000;
    },

    flush() {
      queue?.clearBuffers();
      playingUntil = 0;
    },

    isPlaying: () => playingUntil > Date.now(),

    async stop() {
      try {
        recorder?.stop();
        queue?.stop();
        await ctx?.close();
      } catch {
        // ignore teardown errors
      }
      recorder = null;
      queue = null;
      ctx = null;
    },
  };
}
