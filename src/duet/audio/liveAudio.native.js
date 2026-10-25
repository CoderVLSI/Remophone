import { PermissionsAndroid, Platform } from "react-native";
import { LIVE_INPUT_RATE, LIVE_OUTPUT_RATE } from "../gemini/config";
import { pcm16Base64ToFloat, rmsLevel } from "./pcm";
import { createPcmPlayer } from "./pcmPlayer";

// Live voice on phones, built from pieces that work in a plain Expo build:
//   microphone: duet-live-audio-stream (native module in native-modules/, Android only)
//   speaker:    expo-av, playing the model's audio as short WAV clips
// This is untested on a device. Voice is half duplex: the mic is muted while the model
// speaks so the phone doesn't hear itself and interrupt.
let Mic = null;
let micAvailable = false;
let Av = null;
let FileSystem = null;
try {
  // eslint-disable-next-line global-require
  const mod = require("duet-live-audio-stream");
  Mic = mod.default;
  micAvailable = mod.available && Platform.OS === "android";
  // eslint-disable-next-line global-require
  Av = require("expo-av");
  // eslint-disable-next-line global-require
  FileSystem = require("expo-file-system");
} catch {
  Mic = null;
}

const UNSUPPORTED =
  Platform.OS === "android"
    ? "Voice needs the native microphone module, which isn't in this build. Install the latest APK."
    : "Live voice isn't available on iOS in this build yet. It works in the web version, and text chat works everywhere.";

const MIC_SOURCE_VOICE_COMMUNICATION = 7; // enables echo cancellation where the phone supports it
const ECHO_TAIL_MS = 350;

export function createLiveAudio({ onChunk, onLevel }) {
  if (!micAvailable || !Av || !FileSystem) {
    return {
      supported: false,
      unsupportedReason: UNSUPPORTED,
      async start() {
        throw new Error(UNSUPPORTED);
      },
      setMuted() {},
      play() {},
      endTurn() {},
      flush() {},
      isPlaying: () => false,
      async stop() {},
    };
  }

  let muted = false;
  let subscription = null;
  let clipCounter = 0;
  let quietUntil = 0;

  const player = createPcmPlayer({
    sampleRate: LIVE_OUTPUT_RATE,
    createClip: async (wavBase64) => {
      const uri = `${FileSystem.cacheDirectory}duet-voice-${(clipCounter += 1)}.wav`;
      await FileSystem.writeAsStringAsync(uri, wavBase64, { encoding: FileSystem.EncodingType.Base64 });
      const { sound } = await Av.Audio.Sound.createAsync({ uri }, { shouldPlay: false });
      return {
        play: () =>
          new Promise((resolve) => {
            sound.setOnPlaybackStatusUpdate((status) => {
              if (!status.isLoaded || status.didJustFinish) resolve();
            });
            sound.playAsync().catch(resolve);
          }),
        stop: () => sound.stopAsync(),
        unload: async () => {
          await sound.unloadAsync();
          await FileSystem.deleteAsync(uri, { idempotent: true });
        },
      };
    },
  });

  return {
    supported: true,
    unsupportedReason: null,

    async start() {
      const permission = await Av.Audio.requestPermissionsAsync();
      if (!permission.granted) throw new Error("Microphone permission was denied. Allow it in the phone's app settings.");
      if (Platform.OS === "android") {
        // expo-av asks for RECORD_AUDIO; this double check gives a clear error if it was revoked.
        const has = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
        if (!has) throw new Error("Microphone permission is off for this app.");
      }
      await Av.Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
        staysActiveInBackground: false,
      });
      Mic.init({
        sampleRate: LIVE_INPUT_RATE,
        channels: 1,
        bitsPerSample: 16,
        audioSource: MIC_SOURCE_VOICE_COMMUNICATION,
        bufferSize: 2048,
        wavFile: "",
      });
      subscription = Mic.on("data", (base64) => {
        onLevel?.(rmsLevel(pcm16Base64ToFloat(base64)));
        if (muted) return;
        const now = Date.now();
        if (player.isPlaying()) {
          quietUntil = now + ECHO_TAIL_MS;
          return;
        }
        if (now < quietUntil) return;
        onChunk(base64);
      });
      await Mic.start();
    },

    setMuted(value) {
      muted = value;
    },

    play(base64Pcm24k) {
      player.push(base64Pcm24k);
    },

    endTurn() {
      player.endTurn();
    },

    flush() {
      player.flush();
    },

    isPlaying: () => player.isPlaying(),

    async stop() {
      player.flush();
      try {
        subscription?.remove();
        subscription = null;
        await Mic.stop();
      } catch {
        // ignore teardown errors
      }
      try {
        await Av.Audio.setAudioModeAsync({ allowsRecordingIOS: false });
      } catch {
        // ignore
      }
    },
  };
}
