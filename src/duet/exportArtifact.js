import { Platform, Share } from "react-native";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import { base64ToBytes } from "./audio/pcm";
import { PPTX_MIME, buildDeckPptx, deckFileName } from "./pptx";

export function toMarkdown(artifact) {
  const content = artifact.content || {};
  const lines = [`# ${artifact.title}`, ""];
  if (artifact.kind === "deck") {
    (content.slides || []).forEach((slide, i) => {
      lines.push(`## ${i + 1}. ${slide.title}`);
      if (slide.subtitle) lines.push("", slide.subtitle);
      if (slide.bullets?.length) lines.push("", ...slide.bullets.map((b) => `- ${b}`));
      if (slide.notes) lines.push("", `> Notes: ${slide.notes}`);
      lines.push("");
    });
  } else if (artifact.kind === "design") {
    (content.frames || []).forEach((frame) => {
      lines.push(`## ${frame.name}`);
      if (frame.description) lines.push("", frame.description);
      lines.push("", ...(frame.elements || []).map((el) => `- ${el.type}: ${el.text}`), "");
    });
  } else {
    (content.sections || []).forEach((section) => {
      lines.push(`## ${section.heading}`, "", section.body, "");
    });
  }
  return lines.join("\n").trimEnd() + "\n";
}

export async function exportArtifact(artifact) {
  const text = toMarkdown(artifact);
  if (Platform.OS === "web") {
    const slug = artifact.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "file";
    const url = URL.createObjectURL(new Blob([text], { type: "text/markdown" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${slug}.md`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    return;
  }
  await Share.share({ title: artifact.title, message: text });
}

// Builds a real .pptx and hands it to the user: a download on web, the share sheet on phones.
export async function exportPptx(artifact) {
  const base64 = await buildDeckPptx(artifact);
  const name = deckFileName(artifact);
  if (Platform.OS === "web") {
    const url = URL.createObjectURL(new Blob([base64ToBytes(base64)], { type: PPTX_MIME }));
    const link = document.createElement("a");
    link.href = url;
    link.download = name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    return;
  }
  const uri = `${FileSystem.cacheDirectory}${name}`;
  await FileSystem.writeAsStringAsync(uri, base64, { encoding: FileSystem.EncodingType.Base64 });
  if (!(await Sharing.isAvailableAsync())) throw new Error("Sharing isn't available on this device.");
  await Sharing.shareAsync(uri, {
    mimeType: PPTX_MIME,
    dialogTitle: artifact.title,
    UTI: "org.openxmlformats.presentationml.presentation",
  });
}
