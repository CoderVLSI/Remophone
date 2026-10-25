import React, { useEffect, useRef } from "react";
import { Animated, Image, Pressable, StyleSheet, Text, View } from "react-native";
import Icon from "../components/Icon";
import { TOP_INSET } from "../components/Chrome";
import { colors } from "../theme";
import { EVERYTHING } from "../seed";
import { useDuet } from "../store";

const WIDTH = 318;

function Row({ icon, title, subtitle, active, accent, onPress, child }) {
  return (
    <View style={child ? styles.childWrap : undefined}>
      {child ? <View style={styles.elbow} /> : null}
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        style={({ pressed }) => [styles.row, active && styles.rowActive, pressed && { opacity: 0.75 }, child && { flex: 1 }]}
      >
        <View style={[styles.iconBox, accent && { backgroundColor: colors.accentSoft }]}>
          <Icon name={icon} size={17} color={accent ? colors.accent : colors.textDim} />
        </View>
        <View style={{ flex: 1 }}>
          <Text numberOfLines={1} style={[styles.rowTitle, active && { fontWeight: "700" }]}>{title}</Text>
          {subtitle ? <Text numberOfLines={1} style={styles.rowSub}>{subtitle}</Text> : null}
        </View>
      </Pressable>
    </View>
  );
}

export default function DrawerPanel({ open, activeChannel, onSelect, onNewChannel, onSettings, onClose }) {
  const { state } = useDuet();
  const progress = useRef(new Animated.Value(0)).current;
  const [mounted, setMounted] = React.useState(open);

  useEffect(() => {
    if (open) setMounted(true);
    Animated.timing(progress, { toValue: open ? 1 : 0, duration: 220, useNativeDriver: true }).start(({ finished }) => {
      if (finished && !open) setMounted(false);
    });
  }, [open, progress]);

  if (!mounted) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents={open ? "auto" : "none"}>
      <Animated.View style={[styles.scrim, { opacity: progress }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close channels" />
      </Animated.View>
      <Animated.View
        style={[styles.panel, { paddingTop: TOP_INSET + 8, transform: [{ translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [-WIDTH, 0] }) }] }]}
      >
        <View style={styles.header}>
          <Image source={require("../../../assets/logo.png")} style={styles.logoImage} />
          <Text style={styles.brand}>Claude Duet</Text>
        </View>

        <Row
          icon="layers"
          accent
          title="Everything"
          subtitle="All chat context across every channel"
          active={activeChannel === EVERYTHING}
          onPress={() => onSelect(EVERYTHING)}
        />
        <View style={styles.tree}>
          {state.channels.map((channel) => (
            <Row
              key={channel.id}
              child
              icon={channel.icon || "hash"}
              title={channel.name}
              subtitle={channel.description}
              active={activeChannel === channel.id}
              onPress={() => onSelect(channel.id)}
            />
          ))}
          <View style={styles.childWrap}>
            <View style={styles.elbow} />
            <Pressable accessibilityRole="button" onPress={onNewChannel} style={[styles.row, { flex: 1 }]}>
              <View style={[styles.iconBox, { backgroundColor: "transparent" }]}>
                <Icon name="plus" size={18} color={colors.textDim} />
              </View>
              <Text style={[styles.rowTitle, { color: colors.textDim }]}>New channel</Text>
            </Pressable>
          </View>
        </View>

        <View style={{ flex: 1 }} />
        <Pressable accessibilityRole="button" onPress={onSettings} style={[styles.row, { marginBottom: 22 }]}>
          <View style={[styles.iconBox, { backgroundColor: "transparent" }]}>
            <Icon name="settings" size={18} color={colors.textDim} />
          </View>
          <Text style={[styles.rowTitle, { color: colors.textDim }]}>Settings</Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: colors.scrim },
  panel: { position: "absolute", left: 0, top: 0, bottom: 0, width: WIDTH, backgroundColor: "#050505", paddingHorizontal: 14, borderRightWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  header: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 4, paddingVertical: 10, marginBottom: 12 },
  logoImage: { width: 40, height: 40, borderRadius: 11 },
  brand: { color: colors.text, fontSize: 18, fontWeight: "700" },
  row: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 54, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 16 },
  rowActive: { backgroundColor: "#1c1c1e" },
  iconBox: { width: 34, height: 34, borderRadius: 10, backgroundColor: colors.surfaceRaised, alignItems: "center", justifyContent: "center" },
  rowTitle: { color: colors.text, fontSize: 16, fontWeight: "600" },
  rowSub: { color: colors.textFaint, fontSize: 12, marginTop: 1 },
  tree: { marginLeft: 26, borderLeftWidth: 1, borderLeftColor: colors.borderStrong, paddingTop: 2 },
  childWrap: { flexDirection: "row", alignItems: "center" },
  elbow: { width: 14, height: 1, backgroundColor: colors.borderStrong },
});
