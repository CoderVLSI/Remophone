// expo-av can record to a file in Expo Go. The clip is read back as base64 and sent to
// Gemini for transcription. Not exercised on a device in this repo's checks.
let Av = null;
let FileSystem = null;
try {
  // eslint-disable-next-line global-require
  Av = require("expo-av");
  // eslint-disable-next-line global-require
  FileSystem = require("expo-file-system");
} catch {
  Av = null;
}

export function createDictation() {
  let recording = null;

  return {
    supported: !!Av && !!FileSystem,
    async start() {
      if (!Av || !FileSystem) throw new Error("Dictation needs expo-av and expo-file-system.");
      const permission = await Av.Audio.requestPermissionsAsync();
      if (!permission.granted) throw new Error("Microphone permission was denied.");
      await Av.Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const created = await Av.Audio.Recording.createAsync(Av.Audio.RecordingOptionsPresets.HIGH_QUALITY);
      recording = created.recording;
    },
    async stop() {
      if (!recording) return null;
      const active = recording;
      recording = null;
      await active.stopAndUnloadAsync();
      await Av.Audio.setAudioModeAsync({ allowsRecordingIOS: false });
      const uri = active.getURI();
      if (!uri) return null;
      const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
      FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {});
      // HIGH_QUALITY records AAC in an MPEG-4 container on both platforms.
      return { base64, mimeType: "audio/mp4" };
    },
    async cancel() {
      try {
        await recording?.stopAndUnloadAsync();
      } catch {
        // ignore
      }
      recording = null;
    },
  };
}
