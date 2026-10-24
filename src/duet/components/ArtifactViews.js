import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { WaveMark } from "./Logo";
import { colors } from "../theme";

// Renders children laid out at baseW x baseH, scaled to `width`.
export function Scaled({ baseW, baseH, width, children, style }) {
  const scale = width / baseW;
  const height = baseH * scale;
  return (
    <View style={[{ width, height, overflow: "hidden" }, style]}>
      <View
        style={{
          position: "absolute",
          width: baseW,
          height: baseH,
          left: (width - baseW) / 2,
          top: (height - baseH) / 2,
          transform: [{ scale }],
        }}
      >
        {children}
      </View>
    </View>
  );
}

export const SLIDE_W = 1280;
export const SLIDE_H = 720;
export const FRAME_W = 390;
export const FRAME_H = 844;

export function SlideView({ slide, width }) {
  return (
    <Scaled baseW={SLIDE_W} baseH={SLIDE_H} width={width} style={{ borderRadius: Math.max(4, width * 0.025) }}>
      <View style={s.slide}>
        {slide.layout === "bullets" ? (
          <View style={s.bulletsWrap}>
            <Text style={s.bulletTitle}>{slide.title}</Text>
            {slide.subtitle ? <Text style={s.bulletSub}>{slide.subtitle}</Text> : null}
            <View style={{ gap: 22, marginTop: 36 }}>
              {(slide.bullets || []).map((bullet, i) => (
                <View key={i} style={s.bulletRow}>
                  <View style={s.dot} />
                  <Text style={s.bulletText}>{bullet}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : (
          <View style={s.centerWrap}>
            {slide.layout === "title" ? <WaveMark size={84} /> : null}
            <Text style={slide.layout === "title" ? s.heroTitle : s.statement}>{slide.title}</Text>
            {slide.subtitle ? <Text style={s.heroSub}>{slide.subtitle}</Text> : null}
            {slide.layout === "title" ? (
              <View style={s.strip}>
                <View style={[s.stripPane, { opacity: 0.5 }]} />
                <View style={[s.stripPane, s.stripPaneMain]} />
                <View style={[s.stripPane, { opacity: 0.5 }]} />
              </View>
            ) : null}
          </View>
        )}
      </View>
    </Scaled>
  );
}

export function FrameView({ frame, width }) {
  const palette = frame.palette && frame.palette.length ? frame.palette : ["#111214", "#e5532c", "#f4f2ef", "#2a2a2d"];
  const [bg, accent = colors.accent, fg = "#f4f2ef", card = "#2a2a2d"] = palette;
  return (
    <Scaled baseW={FRAME_W} baseH={FRAME_H} width={width} style={{ borderRadius: Math.max(6, width * 0.08) }}>
      <View style={{ flex: 1, backgroundColor: bg, padding: 28, paddingTop: 80, gap: 18 }}>
        {(frame.elements || []).map((el, i) => {
          if (el.type === "heading") return <Text key={i} style={{ color: fg, fontSize: 34, fontWeight: "800", lineHeight: 40 }}>{el.text}</Text>;
          if (el.type === "button") {
            return (
              <View key={i} style={{ backgroundColor: accent, borderRadius: 16, paddingVertical: 16, alignItems: "center" }}>
                <Text style={{ color: "#fff", fontSize: 18, fontWeight: "700" }}>{el.text}</Text>
              </View>
            );
          }
          if (el.type === "card") {
            return (
              <View key={i} style={{ backgroundColor: card, borderRadius: 18, padding: 20 }}>
                <Text style={{ color: fg, fontSize: 18, fontWeight: "600" }}>{el.text}</Text>
              </View>
            );
          }
          if (el.type === "image") {
            return (
              <View key={i} style={{ backgroundColor: card, borderRadius: 18, height: 200, alignItems: "center", justifyContent: "center" }}>
                <Text style={{ color: fg, opacity: 0.6, fontSize: 16 }}>{el.text}</Text>
              </View>
            );
          }
          return <Text key={i} style={{ color: fg, opacity: 0.75, fontSize: 18, lineHeight: 26 }}>{el.text}</Text>;
        })}
      </View>
    </Scaled>
  );
}

export function parseBody(body) {
  return String(body || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => (line.startsWith("- ") || line.startsWith("• ") ? { bullet: true, text: line.slice(2) } : { bullet: false, text: line }));
}

export function DocView({ content }) {
  return (
    <View style={{ gap: 8 }}>
      <Text style={d.title}>{content.title}</Text>
      {(content.sections || []).map((section, i) => (
        <View key={i} style={{ marginTop: 14, gap: 8 }}>
          <Text style={d.heading}>{section.heading}</Text>
          {parseBody(section.body).map((line, j) =>
            line.bullet ? (
              <View key={j} style={d.bulletRow}>
                <Text style={d.bulletDot}>•</Text>
                <Text style={d.body}>{line.text}</Text>
              </View>
            ) : (
              <Text key={j} style={d.body}>{line.text}</Text>
            ),
          )}
        </View>
      ))}
    </View>
  );
}

export function ArtifactThumb({ artifact, width, height }) {
  const content = artifact.content;
  let inner = null;
  if (content) {
    if (artifact.kind === "deck" && content.slides?.[0]) {
      inner = <SlideView slide={content.slides[0]} width={width} />;
    } else if (artifact.kind === "design" && content.frames?.[0]) {
      inner = <FrameView frame={content.frames[0]} width={Math.min(width * 0.6, (height * FRAME_W) / FRAME_H * 1.6)} />;
    } else if (artifact.kind === "document") {
      const first = content.sections?.[0];
      inner = (
        <View style={{ width, padding: 8, gap: 3 }}>
          <Text numberOfLines={1} style={{ color: colors.text, fontSize: 7, fontWeight: "700" }}>{content.title}</Text>
          {first ? <Text numberOfLines={1} style={{ color: colors.textDim, fontSize: 6, fontWeight: "600" }}>{first.heading}</Text> : null}
          {first ? <Text numberOfLines={5} style={{ color: colors.textFaint, fontSize: 6, lineHeight: 8 }}>{first.body}</Text> : null}
        </View>
      );
    }
  }
  return (
    <View style={{ width, height, backgroundColor: "#111112", borderRadius: 8, overflow: "hidden", alignItems: "center", justifyContent: artifact.kind === "design" ? "flex-start" : "center" }}>
      {inner}
    </View>
  );
}

const s = StyleSheet.create({
  slide: { flex: 1, backgroundColor: "#0d0d0e", borderWidth: 2, borderColor: "#2a2a2d" },
  centerWrap: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 110, gap: 26 },
  heroTitle: { color: colors.text, fontSize: 76, fontWeight: "700", textAlign: "center", lineHeight: 86 },
  statement: { color: colors.text, fontSize: 84, fontWeight: "700", textAlign: "center", lineHeight: 96 },
  heroSub: { color: colors.textDim, fontSize: 36, textAlign: "center", lineHeight: 46 },
  strip: { flexDirection: "row", gap: 24, marginTop: 20, alignItems: "flex-end" },
  stripPane: { width: 200, height: 110, borderRadius: 16, backgroundColor: "#1d1d20", borderWidth: 2, borderColor: "#303034" },
  stripPaneMain: { width: 300, height: 140, borderColor: colors.accentDeep, backgroundColor: "#2a1a14" },
  bulletsWrap: { flex: 1, paddingHorizontal: 110, paddingTop: 100 },
  bulletTitle: { color: colors.text, fontSize: 68, fontWeight: "700", lineHeight: 78 },
  bulletSub: { color: colors.textDim, fontSize: 34, marginTop: 10 },
  bulletRow: { flexDirection: "row", alignItems: "flex-start", gap: 24 },
  dot: { width: 14, height: 14, borderRadius: 7, backgroundColor: colors.accent, marginTop: 18 },
  bulletText: { color: colors.text, fontSize: 42, lineHeight: 52, flex: 1 },
});

const d = StyleSheet.create({
  title: { color: colors.text, fontSize: 30, fontWeight: "800", lineHeight: 36 },
  heading: { color: colors.text, fontSize: 20, fontWeight: "700" },
  body: { color: "#d6d4d0", fontSize: 16, lineHeight: 24, flexShrink: 1 },
  bulletRow: { flexDirection: "row", gap: 10, paddingRight: 8 },
  bulletDot: { color: colors.accent, fontSize: 16, lineHeight: 24 },
});
