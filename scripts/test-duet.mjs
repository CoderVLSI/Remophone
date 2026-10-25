// Offline tests for the Gemini layer: PCM helpers, the Live client against a mock
// BidiGenerateContent server, and the REST agent loop against a mock fetch.
// Run with: npm run test:duet
import assert from "node:assert/strict";
import { WebSocketServer, WebSocket } from "ws";
import { LiveSession, connectWithFallback, liveFallbackAllowed } from "../src/duet/gemini/live.js";
import { runAgent, generateArtifact, checkApiKey, generateWithFallback, listModels, pickFallbacks, modelChain, fallbackKind, resetModelCooldowns, stripThoughtSignatures, GeminiError } from "../src/duet/gemini/rest.js";
import { LOGOS } from "../src/duet/logos.js";
import { CONNECTORS } from "../src/duet/connectors.js";
import { executeTool, functionDeclarations } from "../src/duet/gemini/tools.js";
import JSZip from "jszip";
import { buildDeckPptx } from "../src/duet/pptx.js";
import { makeSeed } from "../src/duet/seed.js";
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

await test("buildDeckPptx writes a valid .pptx with every slide and the speaker notes", async () => {
  const deck = makeSeed().artifacts.find((a) => a.id === "a_deck9");
  const b64 = await buildDeckPptx(deck);
  const zip = await JSZip.loadAsync(b64, { base64: true });
  const slideFiles = Object.keys(zip.files).filter((f) => /^ppt\/slides\/slide\d+\.xml$/.test(f));
  assert.equal(slideFiles.length, deck.content.slides.length);
  const first = await zip.file("ppt/slides/slide1.xml").async("string");
  assert.match(first, /Anthropic just released Duet\./);
  const notes1 = await zip.file("ppt/notesSlides/notesSlide1.xml").async("string");
  assert.match(notes1, /Open with the one-line summary/);
  await assert.rejects(buildDeckPptx({ kind: "document", title: "x", content: {} }), /Only presentations/);
});

await test("checkApiKey accepts a good key and surfaces Google's message for a bad one", async () => {
  let seen;
  const good = async (url, init) => {
    seen = { url, key: init.headers["x-goog-api-key"] };
    return { ok: true, status: 200, text: async () => "{}" };
  };
  assert.equal(await checkApiKey({ apiKey: "k1", fetchImpl: good }), true);
  assert.match(seen.url, /\/v1beta\/models\?pageSize=1$/);
  assert.equal(seen.key, "k1");
  const bad = async () => ({ ok: false, status: 400, text: async () => JSON.stringify({ error: { message: "API key not valid." } }) });
  await assert.rejects(checkApiKey({ apiKey: "nope", fetchImpl: bad }), /API key not valid/);
  await assert.rejects(checkApiKey({ apiKey: "" }), /Paste a key/);
});

await test("every connector has a brand logo with a path and colour", () => {
  assert.ok(CONNECTORS.length >= 8);
  for (const connector of CONNECTORS) {
    const logo = LOGOS[connector.id];
    assert.ok(logo, `logo for ${connector.id}`);
    assert.match(logo.hex, /^#[0-9A-F]{6}$/i);
    assert.ok(logo.path.length > 20, `path for ${connector.id}`);
  }
});

const jsonRes = (status, body) => ({ ok: status < 400, status, text: async () => JSON.stringify(body) });
const okBody = (text) => ({ candidates: [{ content: { role: "model", parts: [{ text }] } }] });
const errBody = (message) => ({ error: { message } });

await test("modelChain dedupes and strips the models/ prefix", () => {
  resetModelCooldowns();
  assert.deepEqual(modelChain("a", ["models/b", "a", " c ", ""]), ["a", "b", "c"]);
  assert.deepEqual(modelChain("", []), []);
});

await test("fallbackKind only retries model-specific and capacity errors", () => {
  assert.equal(fallbackKind(new GeminiError("models/x is not found for API version v1beta", 404)), "gone");
  assert.equal(fallbackKind(new GeminiError("Model is not supported for generateContent", 400)), "gone");
  assert.equal(fallbackKind(new GeminiError("Resource exhausted", 429)), "busy");
  assert.equal(fallbackKind(new GeminiError("The model is overloaded", 503)), "busy");
  assert.equal(fallbackKind(new GeminiError("API key not valid. Please pass a valid API key.", 400)), null);
  assert.equal(fallbackKind(new GeminiError("API key not valid", 404)), null);
  assert.equal(fallbackKind(new GeminiError("Invalid JSON payload", 400)), null);
  assert.equal(fallbackKind(new GeminiError("denied", 403)), null);
  assert.equal(fallbackKind(new Error("network")), null);
});

await test("generateWithFallback moves down the chain and skips a dead model next time", async () => {
  resetModelCooldowns();
  const tried = [];
  const fetchImpl = async (url) => {
    const model = /models\/([^:]+):/.exec(url)[1];
    tried.push(model);
    if (model === "gemini-3.8-flash") return jsonRes(404, errBody("models/gemini-3.8-flash is not found"));
    if (model === "flash-latest") return jsonRes(503, errBody("overloaded"));
    return jsonRes(200, okBody("from " + model));
  };
  const settings = { apiKey: "k", chatModel: "gemini-3.8-flash", chatFallbacks: ["flash-latest", "gemini-2.5-flash"] };
  const seen = [];
  const first = await generateWithFallback({ settings, body: { contents: [] }, fetchImpl, onFallback: (f) => seen.push(f.model) });
  assert.equal(first.model, "gemini-2.5-flash");
  assert.equal(first.fellBack, true);
  assert.deepEqual(tried, ["gemini-3.8-flash", "flash-latest", "gemini-2.5-flash"]);
  assert.deepEqual(seen, ["gemini-3.8-flash", "flash-latest"]);
  tried.length = 0;
  const second = await generateWithFallback({ settings, body: { contents: [] }, fetchImpl });
  assert.deepEqual(tried, ["gemini-2.5-flash"], "dead models are not retried right away");
  assert.equal(second.model, "gemini-2.5-flash");
  resetModelCooldowns();
});

await test("generateWithFallback does not fall back on a bad key and reports every model when all fail", async () => {
  resetModelCooldowns();
  let calls = 0;
  const badKey = async () => (calls += 1, jsonRes(400, errBody("API key not valid. Please pass a valid API key.")));
  await assert.rejects(generateWithFallback({ settings: { apiKey: "k", chatModel: "a", chatFallbacks: ["b"] }, body: {}, fetchImpl: badKey }), /API key not valid/);
  assert.equal(calls, 1);
  const allDown = async () => jsonRes(503, errBody("overloaded"));
  await assert.rejects(generateWithFallback({ settings: { apiKey: "k", chatModel: "a", chatFallbacks: ["b"] }, body: {}, fetchImpl: allDown }), /overloaded \(tried a, b\)/);
  resetModelCooldowns();
});

await test("thought signatures are stripped when a different model takes over mid tool call", async () => {
  resetModelCooldowns();
  const body = { contents: [{ role: "model", parts: [{ functionCall: { name: "x", args: {} }, thoughtSignature: "sig" }] }] };
  assert.equal(stripThoughtSignatures(body).contents[0].parts[0].thoughtSignature, undefined);
  assert.equal(body.contents[0].parts[0].thoughtSignature, "sig", "original is untouched");
  const sent = [];
  const fetchImpl = async (url, init) => {
    sent.push({ url, body: JSON.parse(init.body) });
    return /3\.8/.test(url) ? jsonRes(404, errBody("not found")) : jsonRes(200, okBody("ok"));
  };
  await generateWithFallback({ settings: { apiKey: "k", chatModel: "gemini-3.8-flash", chatFallbacks: ["gemini-2.5-flash"] }, body, producedBy: "gemini-3.8-flash", fetchImpl });
  assert.equal(sent[0].body.contents[0].parts[0].thoughtSignature, "sig", "same model keeps its signature");
  assert.equal(sent[1].body.contents[0].parts[0].thoughtSignature, undefined, "other model gets none");
  resetModelCooldowns();
});

await test("runAgent reports which model answered when it fell back", async () => {
  resetModelCooldowns();
  const fetchImpl = async (url) => (/3\.8/.test(url) ? jsonRes(404, errBody("not found")) : jsonRes(200, okBody("hello")));
  const out = await runAgent({
    settings: { apiKey: "k", chatModel: "gemini-3.8-flash", chatFallbacks: ["gemini-2.5-flash"] },
    history: [{ role: "user", text: "hi" }],
    systemInstruction: "",
    executeTool: async () => ({}),
    fetchImpl,
  });
  assert.deepEqual({ text: out.text, model: out.model, fellBack: out.fellBack }, { text: "hello", model: "gemini-2.5-flash", fellBack: true });
  resetModelCooldowns();
});

await test("Live: a refused model falls through to the next one; a bad key does not", async () => {
  const wss = new WebSocketServer({ port: 0 });
  await new Promise((r) => wss.on("listening", r));
  const port = wss.address().port;
  const setups = [];
  wss.on("connection", (socket) => {
    socket.on("message", (raw) => {
      const msg = JSON.parse(raw.toString());
      if (!msg.setup) return;
      setups.push(msg.setup.model);
      if (msg.setup.model === "models/retired") socket.close(1008, "models/retired is not found for API version v1beta");
      else if (msg.setup.model === "models/badkey") socket.close(1007, "API key not valid. Please pass a valid API key.");
      else socket.send(Buffer.from(JSON.stringify({ setupComplete: {} })));
    });
  });
  const events = [];
  const make = (model) =>
    new LiveSession({ apiKey: "k", model, systemInstruction: "", WebSocketImpl: WebSocket, endpoint: `ws://127.0.0.1:${port}/live`, onEvent: (e) => events.push(e.type) });
  const skipped = [];
  const ok = await connectWithFallback({ models: ["retired", "good", "never"], createSession: make, onSkip: (s) => skipped.push(s.model) });
  assert.equal(ok.model, "good");
  assert.deepEqual(skipped, ["retired"]);
  assert.deepEqual(setups, ["models/retired", "models/good"]);
  assert.ok(!events.includes("close"), "a refused model must not look like a dropped call");
  ok.session.close();
  await assert.rejects(connectWithFallback({ models: ["badkey", "good"], createSession: make }), /API key not valid/);
  await assert.rejects(connectWithFallback({ models: ["retired"], createSession: make }), /not found.*\(tried retired\)/);
  assert.equal(liveFallbackAllowed(new Error("network down")), false);
  wss.close();
});

const listBody = {
  models: [
    { name: "models/gemini-2.5-flash", supportedGenerationMethods: ["generateContent"] },
    { name: "models/gemini-3.8-flash", supportedGenerationMethods: ["generateContent"] },
    { name: "models/gemini-3.8-pro", supportedGenerationMethods: ["generateContent"] },
    { name: "models/gemini-3.5-flash-lite", supportedGenerationMethods: ["generateContent"] },
    { name: "models/gemini-3.9-flash-preview", supportedGenerationMethods: ["generateContent"] },
    { name: "models/gemini-3.8-flash-image", supportedGenerationMethods: ["generateContent"] },
    { name: "models/gemini-3.8-flash-tts", supportedGenerationMethods: ["generateContent"] },
    { name: "models/gemini-embedding-002", supportedGenerationMethods: ["embedContent"] },
    { name: "models/gemini-3.8-live", supportedGenerationMethods: ["bidiGenerateContent"] },
    { name: "models/gemini-3.1-flash-live-preview", supportedGenerationMethods: ["bidiGenerateContent"] },
    { name: "models/gemini-flash-latest", supportedGenerationMethods: ["generateContent"] },
    { name: "models/gemma-3-27b-it", supportedGenerationMethods: ["generateContent"] },
  ],
};

await test("listModels pages through results and caches per key", async () => {
  resetModelCooldowns();
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(url);
    return url.includes("pageToken=p2")
      ? jsonRes(200, { models: [{ name: "models/b", supportedGenerationMethods: ["generateContent"] }] })
      : jsonRes(200, { models: [{ name: "models/a", supportedGenerationMethods: ["generateContent"] }], nextPageToken: "p2" });
  };
  const first = await listModels({ apiKey: "k", fetchImpl });
  assert.deepEqual(first.map((m) => m.id), ["a", "b"]);
  await listModels({ apiKey: "k", fetchImpl });
  assert.equal(calls.length, 2, "second call served from cache");
  await listModels({ apiKey: "other", fetchImpl });
  assert.equal(calls.length, 4);
  resetModelCooldowns();
});

await test("pickFallbacks ranks newest, skips image/tts/embedding/gemma/live, keeps the alias first", () => {
  const models = listBody.models.map((m) => ({ id: m.name.replace("models/", ""), methods: m.supportedGenerationMethods }));
  assert.deepEqual(pickFallbacks(models, "chat", ["gemini-3.8-flash"], 4), ["gemini-flash-latest", "gemini-3.9-flash-preview", "gemini-3.8-pro", "gemini-3.5-flash-lite"]);
  assert.deepEqual(pickFallbacks(models, "live", ["gemini-3.8-live"]), ["gemini-3.1-flash-live-preview"]);
});

await test("when the whole chain fails, chat discovers newer models from the key and uses one", async () => {
  resetModelCooldowns();
  const tried = [];
  const fetchImpl = async (url) => {
    if (url.includes("/models?pageSize")) return jsonRes(200, listBody);
    const model = /models\/([^:]+):/.exec(url)[1];
    tried.push(model);
    return model === "gemini-3.9-flash-preview" ? jsonRes(200, okBody("found you")) : jsonRes(404, errBody(`models/${model} is not found`));
  };
  const out = await generateWithFallback({
    settings: { apiKey: "k", chatModel: "gemini-3.8-flash", chatFallbacks: ["old-model"] },
    body: { contents: [] },
    fetchImpl,
  });
  assert.equal(out.model, "gemini-3.9-flash-preview");
  assert.deepEqual(tried, ["gemini-3.8-flash", "old-model", "gemini-flash-latest", "gemini-3.9-flash-preview"]);
  resetModelCooldowns();
});

await test("Live: when configured models are refused, newest discovered voice models are tried once", async () => {
  const wss = new WebSocketServer({ port: 0 });
  await new Promise((r) => wss.on("listening", r));
  const port = wss.address().port;
  const setups = [];
  wss.on("connection", (socket) => {
    socket.on("message", (raw) => {
      const msg = JSON.parse(raw.toString());
      if (!msg.setup) return;
      setups.push(msg.setup.model);
      if (msg.setup.model === "models/found-live") socket.send(Buffer.from(JSON.stringify({ setupComplete: {} })));
      else socket.close(1008, `${msg.setup.model} is not found`);
    });
  });
  let asked = 0;
  const make = (model) => new LiveSession({ apiKey: "k", model, systemInstruction: "", WebSocketImpl: WebSocket, endpoint: `ws://127.0.0.1:${port}/live`, onEvent: () => {} });
  const ok = await connectWithFallback({
    models: ["gone-1", "gone-2"],
    createSession: make,
    getMore: async (tried) => (asked += 1, ["gone-1", "found-live"]),
  });
  assert.equal(ok.model, "found-live");
  assert.equal(asked, 1);
  assert.deepEqual(setups, ["models/gone-1", "models/gone-2", "models/found-live"]);
  ok.session.close();
  wss.close();
});

console.log(`\n${passed} passed`);
