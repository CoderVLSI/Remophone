import React from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import Icon from "./Icon";
import { ArtifactThumb } from "./ArtifactViews";
import { colors, relativeTime } from "../theme";

export const KIND_META = {
  deck: { icon: "monitor", color: colors.deck, label: "Presentation" },
  document: { icon: "file-text", color: colors.doc, label: "Document" },
  design: { icon: "pen-tool", color: colors.design, label: "Design" },
};

export default function ArtifactCard({ artifact, width = 132, onPress, onLongPress }) {
  const meta = KIND_META[artifact.kind] || KIND_META.document;
  const working = artifact.status === "generating" || artifact.editing;
  const thumbW = width - 16;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={artifact.title}
      onPress={() => onPress(artifact)}
      onLongPress={() => onLongPress?.(artifact)}
      style={({ pressed }) => [styles.card, { width }, pressed && { opacity: 0.8 }]}
    >
      <Text numberOfLines={2} style={styles.title}>{artifact.title}</Text>
      <View style={styles.meta}>
        <Icon name={meta.icon} size={11} color={meta.color} />
        <Text style={styles.time}>{artifact.status === "error" ? "Failed" : working ? "Working…" : relativeTime(artifact.updatedAt)}</Text>
        {artifact.pinned ? <Icon name="bookmark" size={11} color={colors.accent} style={{ marginLeft: "auto" }} /> : null}
      </View>
      <View>
        <ArtifactThumb artifact={artifact} width={thumbW} height={64} />
        {working ? (
          <View style={styles.overlay}>
            <ActivityIndicator color={colors.accent} size="small" />
          </View>
        ) : null}
        {artifact.status === "error" ? (
          <View style={styles.overlay}>
            <Icon name="alert-circle" size={18} color={colors.danger} />
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: 14, padding: 8, gap: 6, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, minHeight: 142 },
  title: { color: colors.text, fontSize: 12.5, fontWeight: "600", lineHeight: 16, minHeight: 32, paddingTop: 2 },
  meta: { flexDirection: "row", alignItems: "center", gap: 5 },
  time: { color: colors.textFaint, fontSize: 10.5 },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.55)", alignItems: "center", justifyContent: "center", borderRadius: 8 },
});
