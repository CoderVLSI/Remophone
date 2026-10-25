import { LiveSession, connectWithFallback } from "./gemini/live";
import { listModels, markModelFailed, modelChain, pickFallbacks } from "./gemini/rest";
import { executeTool } from "./gemini/tools";
import { buildSystemInstruction } from "./gemini/prompts";
import { createLiveAudio } from "./audio/liveAudio";

// Drives one Gemini Live voice conversation: mic -> Live -> speaker, transcripts into chat,
// and tool calls into the same executor the text agent uses.
// `deps`: getSettings, getState, toolContext, addMessage(role,text), onChange(voiceState)
export function createVoiceController(deps) {
  let session = null;
  let audio = null;
  let pendingUser = "";
  let pendingAssistant = "";
  let lastLevelAt = 0;
  let state = { status: "idle", level: 0, muted: false, error: null, userText: "", assistantText: "", model: null, fellBack: false };

  const set = (patch) => {
    state = { ...state, ...patch };
    deps.onChange(state);
  };

  const commitUser = () => {
    if (pendingUser.trim()) deps.addMessage("user", pendingUser.trim());
    pendingUser = "";
  };
  const commitAssistant = () => {
    if (pendingAssistant.trim()) deps.addMessage("assistant", pendingAssistant.trim());
    pendingAssistant = "";
  };

  const handleEvent = async (event) => {
    switch (event.type) {
      case "audio":
        audio?.play(event.data);
        if (state.status !== "speaking") set({ status: "speaking" });
        break;
      case "inputText":
        if (pendingAssistant) commitAssistant();
        pendingUser += event.text;
        set({ userText: pendingUser, assistantText: "" });
        break;
      case "outputText":
        if (pendingUser) commitUser();
        pendingAssistant += event.text;
        set({ assistantText: pendingAssistant });
        break;
      case "interrupted":
        audio?.flush();
        commitAssistant();
        set({ status: "listening" });
        break;
      case "turnComplete":
        commitUser();
        commitAssistant();
        set({ status: "listening", userText: "", assistantText: "" });
        break;
      case "toolCall": {
        set({ status: "working" });
        const responses = [];
        for (const call of event.calls) {
          let result;
          try {
            result = await executeTool(call.name, call.args || {}, deps.toolContext);
          } catch (error) {
            result = { error: error.message || String(error) };
          }
          responses.push({ id: call.id, name: call.name, response: { result } });
        }
        session?.sendToolResponses(responses);
        break;
      }
      case "goAway":
        set({ error: "Gemini is about to end this session. Start voice again to continue." });
        break;
      case "error":
        set({ status: "error", error: event.message });
        break;
      case "close":
        if (state.status !== "idle") {
          set({ status: "error", error: "The voice session ended." });
          cleanup();
        }
        break;
      default:
        break;
    }
  };

  const cleanup = async () => {
    const liveSession = session;
    const liveAudio = audio;
    session = null;
    audio = null;
    liveSession?.close();
    await liveAudio?.stop();
  };

  return {
    getState: () => state,

    async start() {
      if (state.status !== "idle" && state.status !== "error") return;
      pendingUser = "";
      pendingAssistant = "";
      set({ status: "connecting", error: null, level: 0, muted: false, userText: "", assistantText: "" });

      const settings = deps.getSettings();
      audio = createLiveAudio({
        onChunk: (b64) => session?.sendAudio(b64),
        onLevel: (level) => {
          const now = Date.now();
          if (now - lastLevelAt > 70) {
            lastLevelAt = now;
            set({ level });
          }
        },
      });
      if (!audio.supported) {
        set({ status: "error", error: audio.unsupportedReason });
        audio = null;
        return;
      }

      const systemInstruction = buildSystemInstruction(deps.getState(), { voice: true, userName: settings.userName });
      try {
        const connected = await connectWithFallback({
          models: modelChain(settings.liveModel, settings.liveFallbacks),
          createSession: (model) =>
            new LiveSession({ apiKey: settings.apiKey, model, voice: settings.voice, systemInstruction, onEvent: handleEvent }),
          onSkip: ({ model }) => markModelFailed(model, "gone"),
          getMore: async (tried) => pickFallbacks(await listModels({ apiKey: settings.apiKey }), "live", tried),
        });
        session = connected.session;
        await audio.start();
        set({ status: "listening", model: connected.model, fellBack: connected.model !== settings.liveModel });
      } catch (error) {
        await cleanup();
        set({ status: "error", error: error.message || String(error) });
      }
    },

    setMuted(muted) {
      audio?.setMuted(muted);
      set({ muted });
    },

    async stop() {
      commitUser();
      commitAssistant();
      await cleanup();
      set({ status: "idle", level: 0, userText: "", assistantText: "", error: null });
    },
  };
}
