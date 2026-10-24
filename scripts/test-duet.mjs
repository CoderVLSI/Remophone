// Offline tests for the Gemini layer: PCM helpers, the Live client against a mock
// BidiGenerateContent server, and the REST agent loop against a mock fetch.
// Run with: npm run test:duet
import assert from "node:assert/strict";
import { WebSocketServer, WebSocket } from "ws";
import { LiveSession } from "../src/duet/gemini/live.js";
import { runAgent, generateArtifact } from "../src/duet/gemini/rest.js";
import { executeTool, functionDeclarations } from "../src/duet/gemini/tools.js";
import {
  base64ToBytes,
  bytesToBase64,
  floatToPcm16Base64,
  pcm16Base64ToFloat,
  resampleFloat,
  decodeUtf8,
} from "../src/duet/audio/pcm.js";

let passed = 0;
const test = async (name, fn) => {
  try {
    await fn();
    passed += 1;
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}\n${error.stack}`);
    process.exitCode = 1;
  }
};

await test("base64 round-trips and matches Buffer", () => {
  for (const len of [0, 1, 2, 3, 4, 5, 100, 1023]) {
    const bytes = Uint8Array.from({ length: len }, (_, i) => (i * 37 + 11) & 255);
    const b64 = bytesToBase64(bytes);
    assert.equal(b64, Buffer.from(bytes).toString("base64"));
    assert.deepEqual(Array.from(base64ToBytes(b64)), Array.from(bytes));
  }
});

await test("pcm16 conversion round-trips within quantisation error", () => {
  const input = Float32Array.from({ length: 480 }, (_, i) => Math.sin(i / 10) * 0.8);
  const output = pcm16Base64ToFloat(floatToPcm16Base64(input));
  assert.equal(output.length, input.length);
  for (let i = 0; i < input.length; i += 1) assert.ok(Math.abs(input[i] - output[i]) < 1e-3);
});

await test("resampler changes length by the rate ratio", () => {
  const out = resampleFloat(new Float32Array(4800).fill(0.5), 48000, 16000);
  assert.equal(out.length, 1600);
  assert.ok(Math.abs(out[100] - 0.5) < 1e-6);
});

await test("decodeUtf8 fallback handles multi-byte text", () => {
  const original = globalThis.TextDecoder;
  globalThis.TextDecoder = undefined;
  try {
    const text = "héllo ✓ 😀";
    const buf = Buffer.from(text, "utf8");
    assert.equal(decodeUtf8(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)), text);
  } finally {
    globalThis.TextDecoder = original;
  }
});

await test("tool declarations are well formed", () => {
  const names = functionDeclarations.map((f) => f.name);
  assert.deepEqual(names, ["send_to_channel", "create_task", "update_task", "create_artifact", "edit_artifact"]);
  for (const decl of functionDeclarations) {
    assert.equal(decl.parameters.type, "OBJECT");
    for (const key of decl.parameters.required) assert.ok(decl.parameters.properties[key], `${decl.name}.${key}`);
  }
});

await test("LiveSession handshake, audio, transcripts and tool calls against a mock server", async () => {
  const received = [];
  const wss = new WebSocketServer({ port: 0 });
  await new Promise((r) => wss.on("listening", r));
  const port = wss.address().port;

  wss.on("connection", (socket, request) => {
    received.push({ url: request.url });
    socket.on("message", (raw) => {
      const msg = JSON.parse(raw.toString());
      received.push(msg);
      // Real Gemini sends binary frames, so send binary here.
      const reply = (obj) => socket.send(Buffer.from(JSON.stringify(obj)));
      if (msg.setup) reply({ setupComplete: {} });
      if (msg.realtimeInput?.audio) {
        reply({ serverContent: { inputTranscription: { text: "add a slide" } } });
        reply({ toolCall: { functionCalls: [{ id: "c1", name: "create_task", args: { title: "Slide" } }] } });
      }
      if (msg.toolResponse) {
        reply({
          serverContent: {
            modelTurn: { parts: [{ inlineData: { mimeType: "audio/pcm;rate=24000", data: "AAAA" } }] },
            outputTranscription: { text: "Done." },
          },
        });
        reply({ serverContent: { interrupted: true } });
        reply({ serverContent: { turnComplete: true } });
      }
    });
  });

  const events = [];
  const session = new LiveSession({
    apiKey: "test key",
    model: "gemini-3.8-live",
    systemInstruction: "be brief",
    WebSocketImpl: WebSocket,
    endpoint: `ws://127.0.0.1:${port}/live`,
    onEvent: (e) => {
      events.push(e);
      if (e.type === "toolCall") {
        session.sendToolResponses(e.calls.map((c) => ({ id: c.id, name: c.name, response: { result: { ok: true } } })));
      }
    },
  });
  await session.connect();
  session.sendAudio("AAAA");
  await new Promise((resolve) => {
    const timer = setInterval(() => {
      if (events.some((e) => e.type === "turnComplete")) {
        clearInterval(timer);
        resolve();
      }
    }, 10);
  });
  session.close();
  wss.close();

  assert.match(received[0].url, /\?key=test%20key$/);
  const setup = received[1].setup;
  assert.equal(setup.model, "models/gemini-3.8-live");
  assert.deepEqual(setup.generationConfig.responseModalities, ["AUDIO"]);
  assert.equal(setup.generationConfig.speechConfig.voiceConfig.prebuiltVoiceConfig.voiceName, "Kore");
  assert.deepEqual(setup.inputAudioTranscription, {});
  assert.equal(setup.tools[0].functionDeclarations.length, 5);
  assert.equal(received[2].realtimeInput.audio.mimeType, "audio/pcm;rate=16000");
  assert.deepEqual(
    events.map((e) => e.type),
    ["ready", "inputText", "toolCall", "audio", "outputText", "interrupted", "turnComplete"],
  );
  assert.equal(received.find((m) => m.toolResponse).toolResponse.functionResponses[0].id, "c1");
});

await test("LiveSession rejects without an API key", async () => {
  const session = new LiveSession({ apiKey: "", model: "x", systemInstruction: "", WebSocketImpl: WebSocket });
  await assert.rejects(session.connect(), /API key/);
});

const baseState = () => ({
  channels: [
    { id: "ch1", name: "content", description: "" },
    { id: "ch2", name: "finances", description: "" },
  ],
  tasks: [],
  artifacts: [],
});

await test("runAgent executes tool calls and preserves the model turn", async () => {
  const requests = [];
  const modelTurn = {
    role: "model",
    parts: [
      { functionCall: { name: "send_to_channel", args: { channel: "#content", message: "hello" } }, thoughtSignature: "sig-1" },
    ],
  };
  const responses = [
    { candidates: [{ content: modelTurn }] },
    { candidates: [{ content: { role: "model", parts: [{ text: "Sent it." }] } }] },
  ];
  const fetchImpl = async (url, init) => {
    requests.push({ url, init, body: JSON.parse(init.body) });
    return { ok: true, status: 200, text: async () => JSON.stringify(responses.shift()) };
  };
  const posted = [];
  const ctx = {
    getState: baseState,
    addMessage: (m) => posted.push(m),
    noteRoutedChannel: () => {},
  };
  const result = await runAgent({
    settings: { apiKey: "k", chatModel: "gemini-3.8-flash" },
    history: [
      { role: "assistant", text: "orphan greeting" },
      { role: "user", text: "tell content" },
    ],
    systemInstruction: "sys",
    executeTool: (name, args) => executeTool(name, args, ctx),
    fetchImpl,
  });
  assert.equal(result.text, "Sent it.");
  assert.equal(posted.length, 1);
  assert.equal(posted[0].channel, "ch1");
  assert.match(requests[0].url, /models\/gemini-3\.8-flash:generateContent$/);
  assert.equal(requests[0].init.headers["x-goog-api-key"], "k");
  // leading assistant turn is dropped so the conversation starts with the user
  assert.equal(requests[0].body.contents[0].role, "user");
  const second = requests[1].body.contents;
  assert.equal(second[1].parts[0].thoughtSignature, "sig-1");
  assert.equal(second[2].parts[0].functionResponse.response.result.ok, true);
});

await test("runAgent surfaces API errors with Gemini's message", async () => {
  const fetchImpl = async () => ({
    ok: false,
    status: 400,
    text: async () => JSON.stringify({ error: { message: "API key not valid." } }),
  });
  await assert.rejects(
    runAgent({
      settings: { apiKey: "bad", chatModel: "m" },
      history: [{ role: "user", text: "hi" }],
      systemInstruction: "",
      executeTool: async () => ({}),
      fetchImpl,
    }),
    /API key not valid/,
  );
});

await test("generateArtifact requests structured JSON and parses it", async () => {
  let body;
  const fetchImpl = async (_url, init) => {
    body = JSON.parse(init.body);
    return {
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          candidates: [{ content: { parts: [{ text: JSON.stringify({ title: "T", slides: [{ layout: "title", title: "Hi" }] }) }] } }],
        }),
    };
  };
  const out = await generateArtifact({
    settings: { apiKey: "k", chatModel: "m" },
    kind: "deck",
    title: "T",
    brief: "b",
    fetchImpl,
  });
  assert.equal(out.slides[0].title, "Hi");
  assert.equal(body.generationConfig.responseMimeType, "application/json");
  assert.equal(body.generationConfig.responseSchema.type, "OBJECT");
});

console.log(`\n${passed} passed`);
