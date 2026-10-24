import React, { useEffect, useRef } from "react";
import { Animated, Easing, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import Icon from "../components/Icon";
import { WaveMark } from "../components/Logo";
import { TOP_INSET } from "../components/Chrome";
import { colors } from "../theme";
import { useDuet } from "../store";

const STATUS_TEXT = {
  idle: "",
  connecting: "Connecting to Gemini Live…",
  listening: "Listening",
  speaking: "Claude Duet is speaking",
  working: "Working on it…",
  error: "Voice stopped",
};

export default function VoiceOverlay({ visible, channelId, onClose }) {
  const { voice, startVoice, stopVoice, setVoiceMuted } = useDuet();
  const pulse = useRef(new Animated.Value(0)).current;
  const level = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) startVoice(channelId);
    return () => {
      stopVoice();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1400, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 1400, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    if (visible) loop.start();
    return () => loop.stop();
  }, [visible, pulse]);

  useEffect(() => {
    Animated.timing(level, { toValue: voice.muted ? 0 : voice.level, duration: 90, useNativeDriver: true }).start();
  }, [voice.level, voice.muted, level]);

  const orbScale = Animated.add(1, Animated.add(Animated.multiply(pulse, 0.05), Animated.multiply(level, 0.35)));
  const haloScale = Animated.add(1.15, Animated.add(Animated.multiply(pulse, 0.1), Animated.multiply(level, 0.7)));
  const failed = voice.status === "error";

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.root}>
        <View style={[styles.top, { paddingTop: TOP_INSET + 6 }]}>
          <Text style={styles.status}>{failed ? "Voice stopped" : STATUS_TEXT[voice.status]}</Text>
        </View>

        <View style={styles.center}>
          <Animated.View style={[styles.halo, { transform: [{ scale: haloScale }], opacity: voice.status === "speaking" ? 0.5 : 0.28 }]} />
          <Animated.View style={[styles.orb, { transform: [{ scale: orbScale }] }]}>
            <WaveMark size={64} />
          </Animated.View>
        </View>

        <View style={styles.captions}>
          {failed ? <Text style={styles.error}>{voice.error}</Text> : null}
          {voice.userText ? <Text style={styles.userText}>{voice.userText}</Text> : null}
          {voice.assistantText ? <Text style={styles.assistantText}>{voice.assistantText}</Text> : null}
          {!failed && !voice.userText && !voice.assistantText && voice.status === "listening" ? (
            <Text style={styles.hint}>Try “make a short deck about my week” or “add a task to follow up on invoices”.</Text>
          ) : null}
        </View>

        <View style={styles.controls}>
          {failed ? (
            <Pressable accessibilityRole="button" onPress={() => startVoice(channelId)} style={[styles.control, { backgroundColor: colors.surfaceHigh }]}>
              <Icon name="refresh-cw" size={22} />
            </Pressable>
          ) : (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={voice.muted ? "Unmute" : "Mute"}
              onPress={() => setVoiceMuted(!voice.muted)}
              style={[styles.control, { backgroundColor: voice.muted ? "#f4f2ef" : colors.surfaceHigh }]}
            >
              <Icon name={voice.muted ? "mic-off" : "mic"} size={22} color={voice.muted ? "#111" : colors.text} />
            </Pressable>
          )}
          <Pressable accessibilityRole="button" accessibilityLabel="End voice conversation" onPress={onClose} style={[styles.control, { backgroundColor: colors.danger }]}>
            <Icon name="x" size={24} color="#fff" />
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  top: { alignItems: "center", paddingBottom: 8 },
  status: { color: colors.textDim, fontSize: 14, fontWeight: "500" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  halo: { position: "absolute", width: 170, height: 170, borderRadius: 85, backgroundColor: colors.accent },
  orb: { width: 150, height: 150, borderRadius: 75, backgroundColor: "#1a100c", borderWidth: 1.5, borderColor: colors.accentDeep, alignItems: "center", justifyContent: "center" },
  captions: { minHeight: 140, paddingHorizontal: 28, gap: 10, alignItems: "center", justifyContent: "flex-end" },
  userText: { color: colors.textDim, fontSize: 16, textAlign: "center", lineHeight: 22 },
  assistantText: { color: colors.text, fontSize: 18, textAlign: "center", lineHeight: 25 },
  hint: { color: colors.textFaint, fontSize: 14, textAlign: "center", lineHeight: 20 },
  error: { color: colors.danger, fontSize: 14, textAlign: "center", lineHeight: 20 },
  controls: { flexDirection: "row", justifyContent: "center", gap: 28, paddingVertical: 34 },
  control: { width: 64, height: 64, borderRadius: 32, alignItems: "center", justifyContent: "center" },
});
