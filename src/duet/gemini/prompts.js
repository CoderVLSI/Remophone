export function buildSystemInstruction(state, { voice = false, userName = "" } = {}) {
  const channels = state.channels.map((c) => `#${c.name}${c.description ? ` (${c.description})` : ""}`).join(", ");
  const artifacts = state.artifacts
    .filter((a) => a.status !== "error")
    .slice(0, 25)
    .map((a) => `- ${a.id} | ${a.kind} | ${a.title}${a.channel ? ` | #${channelName(state, a.channel)}` : ""}`)
    .join("\n");
  const tasks = state.tasks
    .filter((t) => t.status !== "done")
    .slice(0, 15)
    .map((t) => `- ${t.id} | ${t.status} | ${t.title}`)
    .join("\n");

  return [
    "You are Claude Duet, a proactive personal agent living in a phone app.",
    userName ? `The user's name is ${userName}.` : "",
    "You work across the user's channels, keep background tasks, and build files that appear in the Make tab.",
    "Use tools when the user asks for something to be created, changed, routed or tracked. Do not claim you did something unless a tool call succeeded.",
    "Anything that sends a message, spends money, signs a document or deletes something must be created as a task with requires_approval set, and you must say it is waiting for approval.",
    "When you mention a file, write it as [[artifact:ID]] using the id below so the app can render a link chip.",
    voice
      ? "You are speaking aloud. Keep replies short and conversational, with no markdown."
      : "Keep replies short and plain. Avoid headings and long lists.",
    "",
    `Channels: ${channels || "none"}`,
    "Files in Make:",
    artifacts || "(none yet)",
    "Open tasks:",
    tasks || "(none)",
  ]
    .filter((line) => line !== "")
    .join("\n");
}

function channelName(state, id) {
  const channel = state.channels.find((c) => c.id === id);
  return channel ? channel.name : id;
}

export const DECK_SCHEMA = {
  type: "OBJECT",
  properties: {
    title: { type: "STRING" },
    slides: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          layout: { type: "STRING", enum: ["title", "bullets", "statement"] },
          title: { type: "STRING" },
          subtitle: { type: "STRING" },
          bullets: { type: "ARRAY", items: { type: "STRING" } },
          notes: { type: "STRING" },
        },
        required: ["layout", "title"],
      },
    },
  },
  required: ["title", "slides"],
};

export const DOCUMENT_SCHEMA = {
  type: "OBJECT",
  properties: {
    title: { type: "STRING" },
    sections: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          heading: { type: "STRING" },
          body: { type: "STRING", description: "Plain paragraphs. Start a line with '- ' for a bullet." },
        },
        required: ["heading", "body"],
      },
    },
  },
  required: ["title", "sections"],
};

export const DESIGN_SCHEMA = {
  type: "OBJECT",
  properties: {
    title: { type: "STRING" },
    frames: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          name: { type: "STRING" },
          description: { type: "STRING" },
          palette: { type: "ARRAY", items: { type: "STRING" }, description: "Up to 4 hex colors; first is the background." },
          elements: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              properties: {
                type: { type: "STRING", enum: ["heading", "text", "button", "card", "image"] },
                text: { type: "STRING" },
              },
              required: ["type", "text"],
            },
          },
        },
        required: ["name", "elements"],
      },
    },
  },
  required: ["title", "frames"],
};

export const SCHEMAS = { deck: DECK_SCHEMA, document: DOCUMENT_SCHEMA, design: DESIGN_SCHEMA };

export const ARTIFACT_RULES = {
  deck: "Write a slide deck. The first slide uses layout 'title'. Use 'statement' for one big sentence and 'bullets' for lists of at most 5 short bullets. Add brief speaker notes.",
  document: "Write a clear document with 3 to 7 sections. Keep paragraphs tight.",
  design: "Design 3 to 5 mobile screens as frames. Pick a restrained palette per frame and describe each screen with 4 to 8 elements.",
};
