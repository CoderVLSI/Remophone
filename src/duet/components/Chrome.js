import React from "react";
import { Platform, Pressable, StatusBar, StyleSheet, Text, View } from "react-native";
import Icon from "./Icon";
import { WaveMark } from "./Logo";
import { TAB_BAR_HEIGHT, colors, initials, radius } from "../theme";

export const TOP_INSET = Platform.OS === "android" ? StatusBar.currentHeight || 24 : Platform.OS === "ios" ? 50 : 14;

export function RoundButton({ icon, onPress, size = 44, iconSize = 20, style, label }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.round, { width: size, height: size, borderRadius: size / 2 }, pressed && styles.pressed, style]}
    >
      <Icon name={icon} size={iconSize} />
    </Pressable>
  );
}

export function TopBar({ name, onMenu, onLogo, onAvatar }) {
  return (
    <View style={[styles.topBar, { paddingTop: TOP_INSET }]}>
      <RoundButton icon="menu" onPress={onMenu} label="Open channels" />
      <Pressable accessibilityRole="button" accessibilityLabel="Claude Duet" onPress={onLogo} style={styles.logoWrap}>
        <WaveMark size={26} />
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="Settings" onPress={onAvatar} style={styles.avatar}>
        <Text style={styles.avatarText}>{initials(name)}</Text>
      </Pressable>
    </View>
  );
}

const TABS = [
  { key: "chat", label: "Chat", icon: "message-circle" },
  { key: "tasks", label: "Tasks", icon: "check-square" },
  { key: "make", label: "Make", icon: "edit" },
];

export function TabBar({ active, onChange, badge }) {
  return (
    <View pointerEvents="box-none" style={styles.tabWrap}>
      <View style={styles.tabBar}>
        {TABS.map((tab) => {
          const selected = tab.key === active;
          return (
            <Pressable
              key={tab.key}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              onPress={() => onChange(tab.key)}
              style={[styles.tab, selected && styles.tabActive]}
            >
              <View>
                <Icon name={tab.icon} size={19} color={selected ? colors.text : colors.textDim} />
                {tab.key === "tasks" && badge > 0 ? (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{badge}</Text>
                  </View>
                ) : null}
              </View>
              <Text style={[styles.tabLabel, selected && styles.tabLabelActive]}>{tab.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  round: { backgroundColor: colors.surfaceRaised, alignItems: "center", justifyContent: "center", borderWidth: StyleSheet.hairlineWidth, borderColor: colors.borderStrong },
  pressed: { opacity: 0.7 },
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 14, paddingBottom: 8 },
  logoWrap: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: "#3a2a24",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.accent,
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
  },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surfaceHigh, alignItems: "center", justifyContent: "center", borderWidth: StyleSheet.hairlineWidth, borderColor: colors.borderStrong },
  avatarText: { color: colors.text, fontSize: 14, fontWeight: "600" },
  tabWrap: { position: "absolute", left: 0, right: 0, bottom: 14, alignItems: "center" },
  tabBar: {
    flexDirection: "row",
    height: TAB_BAR_HEIGHT - 8,
    padding: 5,
    borderRadius: 30,
    backgroundColor: "rgba(38,38,40,0.96)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderStrong,
    gap: 4,
  },
  tab: { width: 88, borderRadius: 25, alignItems: "center", justifyContent: "center", gap: 3 },
  tabActive: { backgroundColor: "#3b3b3f" },
  tabLabel: { color: colors.textDim, fontSize: 11, fontWeight: "500" },
  tabLabelActive: { color: colors.text },
  badge: { position: "absolute", top: -6, right: -10, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: colors.accent, alignItems: "center", justifyContent: "center", paddingHorizontal: 4 },
  badgeText: { color: "#fff", fontSize: 10, fontWeight: "700" },
});

export { radius };
