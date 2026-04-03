export function createRelayMessage(type, payload) {
  return {
    type,
    payload,
    sentAt: new Date().toISOString(),
  };
}

export const RELAY_MESSAGE_TYPES = {
  JOIN: "join",
  JOINED: "joined",
  PRESENCE: "presence",
  STATUS: "status",
  COMMAND: "command",
  NOTIFICATION: "notification",
  CALL: "call",
  MESSAGE_THREAD: "message_thread",
  PHOTO_LIBRARY: "photo_library",
  CAPABILITIES: "capabilities",
  ERROR: "error",
};

export function parseRelayMessage(raw) {
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed.type !== "string") {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}
