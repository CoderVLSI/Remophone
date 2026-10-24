import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import Icon from "../components/Icon";
import ArtifactCard from "../components/ArtifactCard";
import { TAB_BAR_HEIGHT, colors } from "../theme";
import { useDuet } from "../store";

const DAY = 24 * 60 * 60 * 1000;

function Section({ title, count, onSeeAll, children }) {
  return (
    <View style={{ gap: 10 }}>
      <View style={styles.head}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.count}>{count}</Text>
        {onSeeAll ? (
          <Pressable onPress={onSeeAll} style={{ marginLeft: "auto" }} accessibilityRole="button">
            <Text style={styles.seeAll}>See all</Text>
          </Pressable>
        ) : null}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.cards}>
        {children}
      </ScrollView>
    </View>
  );
}

export default function MakeScreen({ onOpenArtifact, onSeeAll, onNew, onCardMenu }) {
  const { state } = useDuet();
  const { width } = useWindowDimensions();
  const cardWidth = Math.min(136, Math.round((Math.min(width, 430) - 32 - 20) / 2.6));
  const byUpdated = [...state.artifacts].sort((a, b) => b.updatedAt - a.updatedAt);
  const now = Date.now();
  const sections = [
    { key: "changed", title: "Changed today", items: byUpdated.filter((a) => now - a.updatedAt < DAY).slice(0, 12) },
    { key: "pinned", title: "Pinned", items: byUpdated.filter((a) => a.pinned) },
    { key: "document", title: "Documents", items: byUpdated.filter((a) => a.kind === "document"), seeAll: "document" },
    { key: "design", title: "Designs", items: byUpdated.filter((a) => a.kind === "design"), seeAll: "design" },
    { key: "deck", title: "Presentations", items: byUpdated.filter((a) => a.kind === "deck"), seeAll: "deck" },
  ].filter((section) => section.items.length);

  return (
    <View style={{ flex: 1 }}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content}>
        {sections.length === 0 ? (
          <View style={styles.empty}>
            <Icon name="edit" size={30} color={colors.textFaint} />
            <Text style={styles.emptyText}>Files Claude Duet builds for you show up here. Tap + to make one.</Text>
          </View>
        ) : null}
        {sections.map((section) => (
          <Section
            key={section.key}
            title={section.title}
            count={section.items.length}
            onSeeAll={section.seeAll ? () => onSeeAll(section.seeAll) : null}
          >
            {section.items.map((artifact) => (
              <ArtifactCard key={artifact.id} artifact={artifact} width={cardWidth} onPress={(a) => onOpenArtifact(a.id)} onLongPress={onCardMenu} />
            ))}
          </Section>
        ))}
      </ScrollView>
      <Pressable accessibilityRole="button" accessibilityLabel="New file" onPress={onNew} style={styles.fab}>
        <Icon name="plus" size={26} color="#fff" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 6, paddingBottom: TAB_BAR_HEIGHT + 60, gap: 22 },
  head: { flexDirection: "row", alignItems: "center", gap: 7, paddingHorizontal: 16 },
  title: { color: colors.text, fontSize: 13.5, fontWeight: "600" },
  count: { color: colors.textFaint, fontSize: 13 },
  seeAll: { color: colors.textDim, fontSize: 13 },
  cards: { paddingHorizontal: 16, gap: 10 },
  fab: {
    position: "absolute",
    right: 18,
    bottom: TAB_BAR_HEIGHT + 34,
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.5,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  empty: { alignItems: "center", gap: 12, paddingTop: 80, paddingHorizontal: 30 },
  emptyText: { color: colors.textDim, fontSize: 14, textAlign: "center", lineHeight: 20 },
});
