import React from "react";
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Icon from "./Icon";
import { colors } from "../theme";

// Bottom sheet built on Modal so it works the same on iOS, Android and web.
export default function Sheet({ visible, onClose, title, children, maxHeight = "86%" }) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.root}>
        <Pressable style={styles.scrim} onPress={onClose} accessibilityLabel="Close" />
        <View style={[styles.sheet, { maxHeight }]}>
          <View style={styles.grabber} />
          {title ? <Text style={styles.title}>{title}</Text> : null}
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.body}>
            {children}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export function SheetButton({ label, onPress, kind = "primary", disabled }) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        kind === "primary" && styles.buttonPrimary,
        kind === "danger" && styles.buttonDanger,
        (pressed || disabled) && { opacity: 0.6 },
      ]}
    >
      <Text style={[styles.buttonText, kind === "primary" && { color: "#fff" }, kind === "danger" && { color: colors.danger }]}>{label}</Text>
    </Pressable>
  );
}

export function SheetRow({ icon, label, onPress, danger, detail }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.6 }]}
    >
      <Icon name={icon} size={19} color={danger ? colors.danger : colors.text} />
      <Text style={[styles.rowLabel, danger && { color: colors.danger }]}>{label}</Text>
      {detail ? <Text style={styles.rowDetail}>{detail}</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 14, minHeight: 50, paddingHorizontal: 4 },
  rowLabel: { color: colors.text, fontSize: 16, flex: 1 },
  rowDetail: { color: colors.textFaint, fontSize: 13 },
  root: { flex: 1, justifyContent: "flex-end" },
  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: colors.scrim },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 8, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.borderStrong, width: "100%", maxWidth: 520, alignSelf: "center" },
  grabber: { alignSelf: "center", width: 38, height: 4, borderRadius: 2, backgroundColor: colors.borderStrong, marginBottom: 10 },
  title: { color: colors.text, fontSize: 18, fontWeight: "700", paddingHorizontal: 20, paddingBottom: 6 },
  body: { paddingHorizontal: 20, paddingBottom: 28, gap: 12 },
  button: { height: 48, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceHigh },
  buttonPrimary: { backgroundColor: colors.accent },
  buttonDanger: { backgroundColor: "rgba(255,107,96,0.12)" },
  buttonText: { color: colors.text, fontSize: 15, fontWeight: "600" },
});
