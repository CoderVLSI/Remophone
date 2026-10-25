import { REST_BASE } from "./config";
import { toolsConfig } from "./tools";
import { ARTIFACT_RULES, SCHEMAS } from "./prompts";

const MAX_TOOL_ROUNDS = 6;

export class GeminiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = "GeminiError";
    this.status = status;
  }
}

export async function generateContent({ apiKey, model, body, signal, fetchImpl = fetch }) {
  if (!apiKey) throw new GeminiError("Add your Gemini API key in Settings to talk to Claude Duet.", 401);
  const response = await fetchImpl(`${REST_BASE}/models/${encodeURIComponent(model)}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
    body: JSON.stringify(body),
    signal,
  });
  const text = await response.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }
  if (!response.ok) {
    const message = json?.error?.message || text.slice(0, 200) || `HTTP ${response.status}`;
    throw new GeminiError(message, response.status);
  }
  return json;
}

// ----- model discovery -----
// Asks Google which models this key can use. Cached for an hour per key.
let modelCache = null;

export async function listModels({ apiKey, fetchImpl = fetch, now = Date.now, force = false }) {
  if (!apiKey) throw new GeminiError("Paste a key first.", 401);
  if (!force && modelCache && modelCache.key === apiKey && now() - modelCache.at < 60 * 60 * 1000) return modelCache.models;
  const models = [];
  let pageToken = "";
  for (let page = 0; page < 10; page += 1) {
    const url = `${REST_BASE}/models?pageSize=100${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ""}`;
    const response = await fetchImpl(url, { headers: { "x-goog-api-key": apiKey } });
    const text = await response.text();
    let json = null;
    try {
      json = JSON.parse(text);
    } catch {
      json = null;
    }
    if (!response.ok) throw new GeminiError(json?.error?.message || `HTTP ${response.status}`, response.status);
    for (const model of json?.models || []) {
      models.push({ id: String(model.name || "").replace(/^models\//, ""), methods: model.supportedGenerationMethods || [], displayName: model.displayName || "" });
    }
    pageToken = json?.nextPageToken;
    if (!pageToken) break;
  }
  modelCache = { key: apiKey, at: now(), models };
  return models;
}

const NOT_CHAT = /(image|tts|embed|aqa|imagen|veo|robotics|computer-use|learnlm|gemma|deep-research|lyria|live|native-audio)/i;
const versionOf = (id) => (/-latest$/.test(id) ? 1000 : parseFloat(/gemini-(\d+(?:\.\d+)?)/.exec(id)?.[1] || "0"));
const familyRank = (id) => (/flash-lite/.test(id) ? 1 : /flash/.test(id) ? 3 : /pro/.test(id) ? 2 : 0);
const isPreview = (id) => (/preview|exp/.test(id) ? 1 : 0);

// Newest Gemini models for "chat" (generateContent) or "live" (bidiGenerateContent):
// highest version first, then flash over pro over lite, then stable over preview.
export function pickFallbacks(models, kind, exclude = [], limit = 3) {
  const method = kind === "live" ? "bidiGenerateContent" : "generateContent";
  return models
    .filter((m) => m.id.startsWith("gemini-") && m.methods.includes(method))
    .filter((m) => (kind === "live" ? true : !NOT_CHAT.test(m.id)))
    .filter((m) => !exclude.includes(m.id))
    .sort((a, b) => versionOf(b.id) - versionOf(a.id) || familyRank(b.id) - familyRank(a.id) || isPreview(a.id) - isPreview(b.id) || a.id.localeCompare(b.id))
    .slice(0, limit)
    .map((m) => m.id);
}

// ----- model fallback -----
// Order to try: the chosen model, then the fallbacks. A model that just failed is moved to
// the back of the line for a while so every message doesn't pay for a dead model first.
const COOLDOWN_MS = { gone: 30 * 60 * 1000, busy: 2 * 60 * 1000 };
const cooldowns = new Map();

export function resetModelCooldowns() {
  cooldowns.clear();
  modelCache = null;
}

export function markModelFailed(model, kind = "gone", now = Date.now()) {
  cooldowns.set(model, now + COOLDOWN_MS[kind]);
}

export function modelChain(primary, fallbacks = [], now = Date.now()) {
  const names = [primary, ...(fallbacks || [])]
    .map((name) => String(name || "").trim().replace(/^models\//, ""))
    .filter(Boolean);
  const unique = [...new Set(names)];
  const ready = unique.filter((name) => (cooldowns.get(name) || 0) <= now);
  const cooling = unique.filter((name) => (cooldowns.get(name) || 0) > now);
  return [...ready, ...cooling];
}

// "gone": the model is missing or unsupported. "busy": rate limit or server trouble.
// Anything else (bad key, blocked prompt, bad request) would fail on every model.
export function fallbackKind(error) {
  if (!(error instanceof GeminiError)) return null;
  const message = error.message || "";
  if (/api[ _]?key/i.test(message)) return null;
  if (error.status === 404) return "gone";
  if (error.status === 400 && /not found|not supported|unsupported|does not exist|no longer available|deprecated/i.test(message)) return "gone";
  if ([429, 500, 502, 503, 504].includes(error.status)) return "busy";
  return null;
}

// Thought signatures only make sense to the model that issued them.
export function stripThoughtSignatures(body) {
  if (!body?.contents) return body;
  return {
    ...body,
    contents: body.contents.map((turn) => ({
      ...turn,
      parts: (turn.parts || []).map(({ thoughtSignature, ...rest }) => rest),
    })),
  };
}

// Tries each model in the chain, then (once) the newest models the key can actually use.
// Resolves { json, model, fellBack }.
export async function generateWithFallback({ settings, body, signal, fetchImpl, producedBy = null, onFallback, now = Date.now }) {
  const chain = modelChain(settings.chatModel, settings.chatFallbacks, now());
  if (!chain.length) throw new GeminiError("No chat model is set. Add one in Settings.", 400);
  const queue = [...chain];
  const tried = [];
  const failures = [];
  let discovered = false;
  while (queue.length) {
    const model = queue.shift();
    tried.push(model);
    try {
      const sendBody = producedBy && producedBy !== model ? stripThoughtSignatures(body) : body;
      const json = await generateContent({ apiKey: settings.apiKey, model, body: sendBody, signal, fetchImpl });
      return { json, model, fellBack: model !== settings.chatModel };
    } catch (error) {
      const kind = fallbackKind(error);
      if (!kind) throw error;
      cooldowns.set(model, now() + COOLDOWN_MS[kind]);
      failures.push({ model, error });
      onFallback?.({ model, error });
    }
    if (!queue.length && !discovered) {
      discovered = true;
      try {
        const models = await listModels({ apiKey: settings.apiKey, fetchImpl, now });
        queue.push(...pickFallbacks(models, "chat", tried));
      } catch {
        // can't list models; report the original failures instead
      }
    }
  }
  const last = failures[failures.length - 1].error;
  throw new GeminiError(`${last.message} (tried ${failures.map((f) => f.model).join(", ")})`, last.status);
}

function partsText(content) {
  return (content?.parts || [])
    .filter((p) => typeof p.text === "string" && !p.thought)
    .map((p) => p.text)
    .join("");
}

function toGeminiContents(history) {
  const contents = [];
  for (const message of history) {
    const role = message.role === "assistant" ? "model" : "user";
    const last = contents[contents.length - 1];
    // Gemini wants alternating turns, so merge neighbours with the same role.
    if (last && last.role === role) last.parts.push({ text: message.text });
    else contents.push({ role, parts: [{ text: message.text }] });
  }
  while (contents.length && contents[0].role !== "user") contents.shift();
  return contents;
}

// Runs the chat agent until the model answers without calling a tool.
export async function runAgent({
  settings,
  history,
  systemInstruction,
  executeTool,
  onToolCall,
  signal,
  fetchImpl,
}) {
  const contents = toGeminiContents(history);
  let producedBy = null;
  let usedModel = null;
  for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {
    const { json, model } = await generateWithFallback({
      settings,
      signal,
      fetchImpl,
      producedBy,
      body: {
        systemInstruction: { parts: [{ text: systemInstruction }] },
        contents,
        tools: toolsConfig,
      },
    });
    usedModel = model;
    producedBy = model;
    const candidate = json?.candidates?.[0];
    if (!candidate?.content) {
      const reason = json?.promptFeedback?.blockReason || candidate?.finishReason || "empty response";
      throw new GeminiError(`Gemini returned no answer (${reason}).`);
    }
    const calls = (candidate.content.parts || []).filter((p) => p.functionCall);
    if (!calls.length) return { text: partsText(candidate.content).trim(), model: usedModel, fellBack: usedModel !== settings.chatModel };

    // Keep the model turn exactly as received so thought signatures survive the round trip.
    contents.push(candidate.content);
    const responses = [];
    for (const part of calls) {
      const { name, args = {}, id } = part.functionCall;
      onToolCall?.(name, args);
      let result;
      try {
        result = await executeTool(name, args);
      } catch (error) {
        result = { error: error.message || String(error) };
      }
      responses.push({
        functionResponse: { name, ...(id ? { id } : null), response: { result } },
      });
    }
    contents.push({ role: "user", parts: responses });
  }
  return { text: "I ran into a loop while working on that. Try rephrasing the request.", model: usedModel, fellBack: usedModel !== settings.chatModel };
}

// Structured generation for the Make tab.
export async function generateArtifact({ settings, kind, title, brief, existing, instruction, signal, fetchImpl }) {
  const schema = SCHEMAS[kind];
  if (!schema) throw new GeminiError(`Unknown file type "${kind}".`);
  const prompt = existing
    ? [
        `Here is the current ${kind} as JSON:`,
        JSON.stringify(existing),
        "",
        `Apply this change and return the complete updated ${kind}: ${instruction}`,
        "Keep everything the change does not touch.",
      ].join("\n")
    : [`Create a ${kind} titled "${title}".`, `Brief: ${brief}`].join("\n");

  const { json } = await generateWithFallback({
    settings,
    signal,
    fetchImpl,
    body: {
      systemInstruction: { parts: [{ text: ARTIFACT_RULES[kind] }] },
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: "application/json", responseSchema: schema },
    },
  });
  const raw = partsText(json?.candidates?.[0]?.content);
  try {
    return JSON.parse(raw);
  } catch {
    throw new GeminiError("Gemini returned a file I could not read. Try again.");
  }
}

// Dictation: send a short recording to Gemini and get the words back.
export async function transcribeAudio({ settings, base64, mimeType, signal, fetchImpl }) {
  const { json } = await generateWithFallback({
    settings,
    signal,
    fetchImpl,
    body: {
      contents: [
        {
          role: "user",
          parts: [
            { text: "Transcribe this audio verbatim. Reply with only the transcript. If there is no speech, reply with an empty string." },
            { inlineData: { mimeType, data: base64 } },
          ],
        },
      ],
    },
  });
  return partsText(json?.candidates?.[0]?.content).trim();
}

// Cheap authenticated call used by Settings -> "Test key". Lists one model.
export async function checkApiKey({ apiKey, fetchImpl = fetch }) {
  if (!apiKey) throw new GeminiError("Paste a key first.", 401);
  const response = await fetchImpl(`${REST_BASE}/models?pageSize=1`, { headers: { "x-goog-api-key": apiKey } });
  if (response.ok) return true;
  let message = `HTTP ${response.status}`;
  try {
    message = JSON.parse(await response.text())?.error?.message || message;
  } catch {
    // keep the status line
  }
  throw new GeminiError(message, response.status);
}
