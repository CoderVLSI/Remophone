import React from "react";
import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import ArtifactCard, { KIND_META } from "../components/ArtifactCard";
import { RoundButton, TOP_INSET } from "../components/Chrome";
import { colors } from "../theme";
import { useDuet } from "../store";

export default function SeeAllScreen({ kind, onClose, onOpenArtifact, onCardMenu }) {
  const { state } = useDuet();
  const { width } = useWindowDimensions();
  const gridW = Math.min(width, 430) - 32;
  const cardWidth = Math.floor((gridW - 10) / 2);
  const items = state.artifacts.filter((a) => a.kind === kind).sort((a, b) => b.updatedAt - a.updatedAt);
  const label = { document: "Documents", design: "Designs", deck: "Presentations" }[kind] || KIND_META[kind]?.label;

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: TOP_INSET }]}>
        <RoundButton icon="chevron-left" onPress={onClose} label="Back" />
        <Text style={styles.title}>{label}</Text>
        <View style={{ width: 44 }} />
      </View>
      <ScrollView contentContainerStyle={styles.grid}>
        {items.map((artifact) => (
          <ArtifactCard key={artifact.id} artifact={artifact} width={cardWidth} onPress={(a) => onOpenArtifact(a.id)} onLongPress={onCardMenu} />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { ...StyleSheet.absoluteFillObject, backgroundColor: colors.bg },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 14, paddingBottom: 10 },
  title: { color: colors.text, fontSize: 17, fontWeight: "700" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10, paddingHorizontal: 16, paddingBottom: 40 },
});
