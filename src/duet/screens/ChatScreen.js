import React, { useEffect, useRef, useState } from "react";
import { Animated, Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Icon from "../components/Icon";
import Composer from "../components/Composer";
import { colors, truncate } from "../theme";
import { EVERYTHING } from "../seed";
import { useDuet } from "../store";

const ARTIFACT_REF = /\[\[artifact:([^\]]+)\]\]/g;

function Dots() {
  const values = useRef([0, 1, 2].map(() => new Animated.Value(0.3))).current;
  useEffect(() => {
    const loops = values.map((value, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 160),
          Animated.timing(value, { toValue: 1, duration: 380, useNativeDriver: true }),
          Animated.timing(value, { toValue: 0.3, duration: 380, useNativeDriver: true }),
        ]),
      ),
    );
    loops.forEach((loop) => loop.start());
    return () => loops.forEach((loop) => loop.stop());
  }, [values]);
  return (
    <View style={styles.dots} accessibilityLabel="Claude Duet is working">
      {values.map((value, i) => (
        <Animated.View key={i} style={[styles.dot, { opacity: value }]} />
      ))}
    </View>
  );
}

function MessageText({ text, artifacts, onOpenArtifact, style }) {
  const parts = [];
  let last = 0;
  let match;
  ARTIFACT_REF.lastIndex = 0;
  while ((match = ARTIFACT_REF.exec(text))) {
    if (match.index > last) parts.push({ text: text.slice(last, match.index) });
    parts.push({ artifactId: match[1] });
    last = match.index + match[0].length;
  }
  if (last < text.length) parts.push({ text: text.slice(last) });

  return (
    <Text style={style}>
      {parts.map((part, i) => {
        if (part.text !== undefined) return part.text;
        const artifact = artifacts.find((a) => a.id === part.artifactId);
        if (!artifact) return null;
        return (
          <Text key={i} onPress={() => onOpenArtifact(artifact.id)} style={styles.inlineChip}>
            {" "}
            <Icon name={artifact.kind === "deck" ? "monitor" : artifact.kind === "design" ? "pen-tool" : "file-text"} size={13} color={colors.textDim} />
            {` ${truncate(artifact.title, 28)} `}
          </Text>
        );
      })}
    </Text>
  );
}

function ChannelChip({ channel, onPress }) {
  return (
    <Pressable onPress={onPress} style={styles.channelChip} accessibilityRole="button" accessibilityLabel={`Open #${channel.name}`}>
      <Icon name={channel.icon || "hash"} size={13} color={colors.textDim} />
      <Text style={styles.channelChipText}>#{channel.name}</Text>
      <Icon name="chevron-right" size={13} color={colors.textFaint} />
    </Pressable>
  );
}

const SUGGESTIONS = [
  "Give me a morning brief",
  "Make a 5 slide deck about our launch",
  "Create a task to follow up on invoices",
];

export default function ChatScreen({ channelId, onOpenArtifact, onOpenChannel, onPlus, onVoice, bottomInset }) {
  const { state, busy, modelNotice, sendMessage, dictationState, startDictation, finishDictation, cancelDictation } = useDuet();
  const [draft, setDraft] = useState("");
  const [notice, setNotice] = useState(null);
  const scrollRef = useRef(null);

  const messages = channelId === EVERYTHING ? state.messages : state.messages.filter((m) => m.channel === channelId);
  const channelOf = (id) => state.channels.find((c) => c.id === id);
  const activeChannel = channelId === EVERYTHING ? null : channelOf(channelId);

  useEffect(() => () => {
    cancelDictation();
  }, [cancelDictation]);

  const send = (text) => {
    const value = (text ?? draft).trim();
    if (!value) return;
    setDraft("");
    setNotice(null);
    sendMessage(value, channelId);
  };

  const toggleDictation = async () => {
    setNotice(null);
    if (dictationState === "idle") {
      const { error } = await startDictation();
      if (error) setNotice(error);
    } else if (dictationState === "recording") {
      const { text, error } = await finishDictation();
      if (error) setNotice(error);
      else if (text) setDraft((current) => (current ? `${current} ${text}` : text));
    }
  };

  return (
    <View style={styles.root}>
      {activeChannel ? (
        <View style={styles.channelBanner}>
          <Icon name={activeChannel.icon || "hash"} size={14} color={colors.accent} />
          <Text style={styles.channelBannerText}>#{activeChannel.name}</Text>
          {activeChannel.description ? <Text numberOfLines={1} style={styles.channelBannerDesc}>{activeChannel.description}</Text> : null}
        </View>
      ) : null}

      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={styles.list}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
        keyboardShouldPersistTaps="handled"
      >
        {messages.length === 0 && !busy ? (
          <View style={styles.empty}>
            <Image source={require("../../../assets/logo.png")} style={styles.emptyLogo} />
            <Text style={styles.emptyTitle}>What can I get started for you?</Text>
            {SUGGESTIONS.map((suggestion) => (
              <Pressable key={suggestion} style={styles.suggestion} onPress={() => send(suggestion)}>
                <Text style={styles.suggestionText}>{suggestion}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        {messages.map((message) => {
          if (message.role === "user") {
            return (
              <View key={message.id} style={styles.userRow}>
                <View style={styles.userBubble}>
                  <Text style={styles.userText}>{message.text}</Text>
                </View>
              </View>
            );
          }
          const channel = message.channel ? channelOf(message.channel) : null;
          return (
            <View key={message.id} style={styles.assistantRow}>
              {channelId === EVERYTHING && channel ? <ChannelChip channel={channel} onPress={() => onOpenChannel(channel.id)} /> : null}
              <MessageText
                text={message.text}
                artifacts={state.artifacts}
                onOpenArtifact={onOpenArtifact}
                style={[styles.assistantText, message.error && { color: colors.danger }]}
              />
            </View>
          );
        })}

        {busy ? (
          <View style={styles.assistantRow}>
            <Dots />
          </View>
        ) : null}
      </ScrollView>

      <Text style={styles.disclaimer}>Claude Duet is AI and can make mistakes.</Text>
      {modelNotice ? <Text style={styles.modelNotice}>{modelNotice}</Text> : null}
      {notice ? <Text style={styles.notice}>{notice}</Text> : null}
      <View style={{ paddingHorizontal: 12, paddingBottom: bottomInset }}>
        <Composer
          value={draft}
          onChangeText={setDraft}
          onSend={() => send()}
          onPlus={onPlus}
          onMic={toggleDictation}
          micState={dictationState}
          onVoice={onVoice}
          disabled={busy}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  channelBanner: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 20, paddingVertical: 6 },
  channelBannerText: { color: colors.text, fontSize: 14, fontWeight: "600" },
  channelBannerDesc: { color: colors.textFaint, fontSize: 12.5, flex: 1 },
  list: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12, gap: 14, flexGrow: 1, justifyContent: "flex-end" },
  userRow: { alignItems: "flex-end" },
  userBubble: { maxWidth: "82%", backgroundColor: colors.bubble, borderRadius: 20, paddingHorizontal: 15, paddingVertical: 11 },
  userText: { color: colors.bubbleText, fontSize: 15.5, lineHeight: 22 },
  assistantRow: { alignItems: "flex-start", gap: 6, maxWidth: "94%" },
  assistantText: { color: "#e9e7e3", fontSize: 15.5, lineHeight: 22 },
  channelChip: { flexDirection: "row", alignItems: "center", gap: 5, paddingVertical: 2 },
  channelChipText: { color: colors.textDim, fontSize: 12.5 },
  inlineChip: { backgroundColor: colors.surfaceHigh, color: colors.text, fontSize: 14, borderRadius: 8, overflow: "hidden" },
  disclaimer: { color: colors.textFaint, fontSize: 11.5, textAlign: "center", paddingVertical: 8 },
  modelNotice: { color: colors.textFaint, fontSize: 11.5, textAlign: "center", paddingHorizontal: 20, paddingBottom: 6 },
  notice: { color: colors.danger, fontSize: 12.5, textAlign: "center", paddingHorizontal: 20, paddingBottom: 6 },
  dots: { flexDirection: "row", gap: 6, paddingVertical: 10 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent },
  empty: { alignItems: "center", gap: 12, paddingBottom: 20 },
  emptyLogo: { width: 64, height: 64, borderRadius: 18 },
  emptyTitle: { color: colors.text, fontSize: 20, fontWeight: "600", marginBottom: 8 },
  suggestion: { borderWidth: StyleSheet.hairlineWidth, borderColor: colors.borderStrong, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 11, backgroundColor: colors.surface },
  suggestionText: { color: colors.textDim, fontSize: 14 },
});
