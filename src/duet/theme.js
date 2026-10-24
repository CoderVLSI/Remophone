export const colors = {
  bg: "#000000",
  surface: "#1a1a1b",
  surfaceRaised: "#242426",
  surfaceHigh: "#2e2e31",
  border: "#2a2a2d",
  borderStrong: "#3a3a3e",
  text: "#f4f2ef",
  textDim: "#a09e9a",
  textFaint: "#6c6a67",
  accent: "#e5532c",
  accentDeep: "#b93c1b",
  accentSoft: "rgba(229, 83, 44, 0.16)",
  bubble: "#4b2418",
  bubbleText: "#f7e5dd",
  doc: "#6e9bff",
  design: "#b68cff",
  deck: "#f0763f",
  success: "#5fc98a",
  danger: "#ff6b60",
  scrim: "rgba(0,0,0,0.55)",
};

export const radius = { sm: 8, md: 12, lg: 16, xl: 22, pill: 999 };

export const TAB_BAR_HEIGHT = 64;

export function relativeTime(ts, now = Date.now()) {
  const diff = Math.max(0, now - ts);
  const min = Math.round(diff / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr} hr ago`;
  const day = Math.round(hr / 24);
  if (day === 1) return "yesterday";
  if (day < 30) return `${day} days ago`;
  return new Date(ts).toLocaleDateString();
}

export function truncate(text, max) {
  if (!text) return "";
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

export function initials(name) {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}
