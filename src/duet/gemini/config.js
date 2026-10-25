// Model IDs change often, so every value here can be overridden from Settings.
// "gemini-3.8-flash" and "gemini-3.8-live" are the current IDs on the Gemini
// Developer API as of October 2026; the older Live IDs are being retired.
export const DEFAULT_SETTINGS = {
  apiKey: "",
  chatModel: "gemini-3.8-flash",
  liveModel: "gemini-3.8-live",
  // Tried in order when the model above is missing, retired, rate limited or overloaded.
  // After these, the app asks Google which models the key can use and tries the newest.
  // "gemini-flash-latest" is Google's moving alias. Editable in Settings.
  chatFallbacks: ["gemini-flash-latest"],
  liveFallbacks: [],
  // Bump when the defaults above change so saved older lists are replaced once.
  fallbackVersion: 2,
  voice: "Kore",
  userName: "Riley B",
};

export const VOICES = ["Kore", "Puck", "Charon", "Aoede", "Fenrir", "Leda"];

export const REST_BASE = "https://generativelanguage.googleapis.com/v1beta";

export const LIVE_ENDPOINT =
  "wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent";

// Ephemeral tokens (v1alpha) use a different endpoint and an access_token query param.
export const LIVE_ENDPOINT_EPHEMERAL =
  "wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContentConstrained";

export const LIVE_INPUT_RATE = 16000;
export const LIVE_OUTPUT_RATE = 24000;
