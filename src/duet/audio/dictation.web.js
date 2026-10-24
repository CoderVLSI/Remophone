import { bytesToBase64 } from "./pcm";

// Records a short clip with MediaRecorder; Gemini transcribes it afterwards.
export function createDictation() {
  const supported =
    typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== "undefined";
  let recorder = null;
  let stream = null;
  let chunks = [];

  return {
    supported,
    async start() {
      if (!supported) throw new Error("Dictation isn't available in this browser.");
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      chunks = [];
      recorder = new MediaRecorder(stream);
      recorder.ondataavailable = (event) => {
        if (event.data?.size) chunks.push(event.data);
      };
      recorder.start();
    },
    async stop() {
      if (!recorder) return null;
      const active = recorder;
      const done = new Promise((resolve) => {
        active.onstop = resolve;
      });
      active.stop();
      await done;
      stream?.getTracks().forEach((track) => track.stop());
      const mimeType = (active.mimeType || "audio/webm").split(";")[0];
      const blob = new Blob(chunks, { type: mimeType });
      recorder = null;
      stream = null;
      if (!blob.size) return null;
      const bytes = new Uint8Array(await blob.arrayBuffer());
      return { base64: bytesToBase64(bytes), mimeType };
    },
    async cancel() {
      try {
        recorder?.stop();
      } catch {
        // ignore
      }
      stream?.getTracks().forEach((track) => track.stop());
      recorder = null;
      stream = null;
    },
  };
}
