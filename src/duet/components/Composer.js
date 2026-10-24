import React, { useState } from "react";
import { ActivityIndicator, Platform, Pressable, StyleSheet, TextInput, View } from "react-native";
import Icon from "./Icon";
import { VoiceBars } from "./Logo";
import { colors } from "../theme";

// The pill-shaped message box shared by Chat ("Message Claude Duet") and the file
// viewer ("Ask Claude for a change").
export default function Composer({
  value,
  onChangeText,
  onSend,
  placeholder = "Message Claude Duet",
  onPlus,
  onMic,
  micState = "idle",
  onVoice,
  disabled,
  autoFocus,
  style,
}) {
  const hasText = value.trim().length > 0;
  // React Native grows a multiline input by itself; react-native-web does not, so estimate there.
  const [nativeHeight, setNativeHeight] = useState(40);
  const webLines = value.split("\n").reduce((sum, line) => sum + Math.max(1, Math.ceil(line.length / 34)), 0);
  const inputHeight = Platform.OS === "web" ? 40 + (webLines - 1) * 22 : nativeHeight;
  const submit = () => {
    if (hasText && !disabled) onSend();
  };
  return (
    <View style={[styles.pill, style]}>
      <Pressable accessibilityLabel="Add" onPress={onPlus} hitSlop={8} style={styles.plus}>
        <Icon name="plus" size={22} color={colors.textDim} />
      </Pressable>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textFaint}
        style={[styles.input, { height: Math.min(120, Math.max(40, inputHeight)) }]}
        multiline
        numberOfLines={1}
        onContentSizeChange={(event) => setNativeHeight(event.nativeEvent.contentSize.height + 18)}
        autoFocus={autoFocus}
        blurOnSubmit={false}
        onSubmitEditing={submit}
        onKeyPress={(event) => {
          const native = event.nativeEvent;
          if (native.key === "Enter" && !native.shiftKey && Platform.OS === "web") {
            event.preventDefault?.();
            submit();
          }
        }}
      />
      {onMic ? (
        <Pressable
          accessibilityLabel={micState === "recording" ? "Stop dictation" : "Dictate"}
          onPress={onMic}
          hitSlop={8}
          style={[styles.mic, micState === "recording" && styles.micOn]}
        >
          {micState === "transcribing" ? (
            <ActivityIndicator size="small" color={colors.textDim} />
          ) : (
            <Icon name={micState === "recording" ? "square" : "mic"} size={micState === "recording" ? 14 : 20} color={micState === "recording" ? "#fff" : colors.textDim} />
          )}
        </Pressable>
      ) : null}
      {hasText || !onVoice ? (
        <Pressable
          accessibilityLabel="Send"
          onPress={submit}
          disabled={!hasText || disabled}
          style={[styles.action, { backgroundColor: hasText && !disabled ? "#f4f2ef" : colors.surfaceHigh }]}
        >
          {disabled && hasText ? <ActivityIndicator size="small" color="#111" /> : <Icon name="arrow-up" size={20} color={hasText && !disabled ? "#111" : colors.textFaint} />}
        </Pressable>
      ) : (
        <Pressable accessibilityLabel="Start voice conversation" onPress={onVoice} style={[styles.action, { backgroundColor: "#f4f2ef" }]}>
          <VoiceBars />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: "row",
    alignItems: "flex-end",
    backgroundColor: "#1d1d1f",
    borderRadius: 28,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderStrong,
    paddingHorizontal: 8,
    paddingVertical: 7,
    gap: 4,
    minHeight: 54,
  },
  plus: { width: 38, height: 40, alignItems: "center", justifyContent: "center" },
  input: { flex: 1, color: colors.text, fontSize: 16, maxHeight: 120, paddingTop: 9, paddingBottom: 9, minHeight: 40, ...Platform.select({ web: { outlineStyle: "none" } }) },
  mic: { width: 38, height: 40, alignItems: "center", justifyContent: "center", borderRadius: 20 },
  micOn: { backgroundColor: colors.danger, width: 36, height: 36, marginBottom: 2, marginRight: 2 },
  action: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
});
