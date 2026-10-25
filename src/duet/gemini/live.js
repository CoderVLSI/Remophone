import { LIVE_ENDPOINT, LIVE_INPUT_RATE } from "./config";
import { toolsConfig } from "./tools";
import { decodeUtf8 } from "../audio/pcm";

// Thin client for the Gemini Live API (BidiGenerateContent over WebSocket).
// Events are delivered through `onEvent({ type, ... })`:
//   ready, audio{data}, inputText{text}, outputText{text}, interrupted,
//   turnComplete, toolCall{calls}, goAway, error{message}, close
export class LiveSession {
  constructor({
    apiKey,
    model,
    voice = "Kore",
    systemInstruction,
    onEvent,
    WebSocketImpl,
    endpoint = LIVE_ENDPOINT,
    tools = toolsConfig,
  }) {
    this.apiKey = String(apiKey || "").replace(/[^\x21-\x7E]/g, "");
    this.model = model.startsWith("models/") ? model : `models/${model}`;
    this.voice = voice;
    this.systemInstruction = systemInstruction;
    this.onEvent = onEvent || (() => {});
    this.WebSocketImpl = WebSocketImpl || globalThis.WebSocket;
    this.endpoint = endpoint;
    this.tools = tools;
    this.socket = null;
    this.ready = false;
    this.everReady = false;
    this.closed = false;
  }

  connect() {
    return new Promise((resolve, reject) => {
      if (!this.apiKey) {
        reject(new Error("Add your Gemini API key in Settings to use voice."));
        return;
      }
      if (!this.WebSocketImpl) {
        reject(new Error("WebSocket is not available in this environment."));
        return;
      }
      const url = `${this.endpoint}?key=${encodeURIComponent(this.apiKey)}`;
      let settled = false;
      const socket = new this.WebSocketImpl(url);
      socket.binaryType = "arraybuffer";
      this.socket = socket;

      socket.onopen = () => {
        this._send({
          setup: {
            model: this.model,
            generationConfig: {
              responseModalities: ["AUDIO"],
              speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: this.voice } } },
            },
            systemInstruction: { parts: [{ text: this.systemInstruction }] },
            tools: this.tools,
            inputAudioTranscription: {},
            outputAudioTranscription: {},
          },
        });
      };

      socket.onmessage = (event) => {
        const message = this._parse(event.data);
        if (!message) return;
        if (message.setupComplete && !settled) {
          settled = true;
          this.ready = true;
          this.everReady = true;
          this.onEvent({ type: "ready" });
          resolve();
          return;
        }
        this._dispatch(message);
      };

      socket.onerror = () => {
        const error = new Error("Could not reach Gemini Live. Check your network and API key.");
        if (!settled) {
          settled = true;
          reject(error);
        } else {
          this.onEvent({ type: "error", message: error.message });
        }
      };

      socket.onclose = (event) => {
        this.ready = false;
        const reason = event?.reason ? `: ${event.reason}` : "";
        if (!settled) {
          settled = true;
          const error = new Error(`Gemini Live closed the connection${reason} (code ${event?.code ?? "?"})`);
          // Lets connectWithFallback tell "this model was refused" from "the network is down".
          error.code = event?.code;
          error.reason = event?.reason || "";
          reject(error);
        }
        // A close before setup finished is reported through connect()'s rejection instead.
        if (!this.closed && this.everReady) this.onEvent({ type: "close", code: event?.code, reason: event?.reason });
      };
    });
  }

  sendAudio(base64Pcm16k) {
    if (!this.ready) return;
    this._send({
      realtimeInput: { audio: { data: base64Pcm16k, mimeType: `audio/pcm;rate=${LIVE_INPUT_RATE}` } },
    });
  }

  sendText(text) {
    if (!this.ready) return;
    this._send({ realtimeInput: { text } });
  }

  sendAudioStreamEnd() {
    if (!this.ready) return;
    this._send({ realtimeInput: { audioStreamEnd: true } });
  }

  sendToolResponses(functionResponses) {
    if (!this.ready) return;
    this._send({ toolResponse: { functionResponses } });
  }

  close() {
    this.closed = true;
    this.ready = false;
    try {
      this.socket?.close(1000, "client closed");
    } catch {
      // already closed
    }
  }

  _send(payload) {
    if (!this.socket || this.socket.readyState !== 1) return;
    this.socket.send(JSON.stringify(payload));
  }

  _parse(data) {
    try {
      if (typeof data === "string") return JSON.parse(data);
      if (data instanceof ArrayBuffer) return JSON.parse(decodeUtf8(data));
      if (ArrayBuffer.isView(data)) return JSON.parse(decodeUtf8(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength)));
    } catch {
      this.onEvent({ type: "error", message: "Received an unreadable message from Gemini Live." });
    }
    return null;
  }

  _dispatch(message) {
    const content = message.serverContent;
    if (content) {
      for (const part of content.modelTurn?.parts || []) {
        if (part.inlineData?.data) this.onEvent({ type: "audio", data: part.inlineData.data });
      }
      if (content.inputTranscription?.text) this.onEvent({ type: "inputText", text: content.inputTranscription.text });
      if (content.outputTranscription?.text) this.onEvent({ type: "outputText", text: content.outputTranscription.text });
      if (content.interrupted) this.onEvent({ type: "interrupted" });
      if (content.turnComplete) this.onEvent({ type: "turnComplete" });
    }
    if (message.toolCall?.functionCalls?.length) {
      this.onEvent({ type: "toolCall", calls: message.toolCall.functionCalls });
    }
    if (message.goAway) this.onEvent({ type: "goAway", timeLeft: message.goAway.timeLeft });
  }
}

// A refused model (not found, retired, unsupported) closes the socket with a reason. A bad
// key or a network failure would fail on every model, so those are not retried.
export function liveFallbackAllowed(error) {
  if (!error || error.code === undefined || error.code === 1006) return false;
  return !/api[ _]?key/i.test(`${error.reason || ""} ${error.message || ""}`);
}

// Tries each model in order and resolves { session, model } for the first that completes setup.
// When the list runs out, `getMore(triedModels)` may supply more (for example the newest Live
// models the key can use) and is asked only once.
export async function connectWithFallback({ models, createSession, onSkip, getMore }) {
  const queue = [...models];
  const tried = [];
  let lastError = null;
  let asked = false;
  while (queue.length) {
    const model = queue.shift();
    tried.push(model);
    const session = createSession(model);
    try {
      await session.connect();
      return { session, model };
    } catch (error) {
      session.close();
      if (!liveFallbackAllowed(error)) throw error;
      lastError = error;
      onSkip?.({ model, error });
    }
    if (!queue.length && !asked && getMore) {
      asked = true;
      try {
        queue.push(...(await getMore(tried)).filter((m) => !tried.includes(m)));
      } catch {
        // discovery failed; fall through to the original error
      }
    }
  }
  if (!lastError) throw new Error("No voice model is set. Add one in Settings.");
  throw new Error(`${lastError.message} (tried ${tried.join(", ")})`);
}
