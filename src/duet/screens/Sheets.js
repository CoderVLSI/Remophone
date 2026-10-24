import React, { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import Sheet, { SheetButton } from "../components/Sheet";
import Icon, { CHANNEL_ICONS } from "../components/Icon";
import { KIND_META } from "../components/ArtifactCard";
import { colors } from "../theme";
import { VOICES } from "../gemini/config";
import { useDuet } from "../store";

function Field({ label, hint, ...props }) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput {...props} placeholderTextColor={colors.textFaint} style={[styles.input, props.multiline && { minHeight: 90, textAlignVertical: "top" }]} />
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

export function SettingsSheet({ visible, onClose }) {
  const { settings, updateSettings, resetDemo, clearAll } = useDuet();
  const [form, setForm] = useState(settings);
  const [confirmClear, setConfirmClear] = useState(false);

  useEffect(() => {
    if (visible) {
      setForm(settings);
      setConfirmClear(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const set = (key) => (value) => setForm((f) => ({ ...f, [key]: value }));
  const save = async () => {
    await updateSettings({
      apiKey: form.apiKey.trim(),
      chatModel: form.chatModel.trim() || settings.chatModel,
      liveModel: form.liveModel.trim() || settings.liveModel,
      voice: form.voice,
      userName: form.userName.trim() || settings.userName,
    });
    onClose();
  };

  return (
    <Sheet visible={visible} onClose={onClose} title="Settings">
      <Field label="Your name" value={form.userName} onChangeText={set("userName")} autoCapitalize="words" />
      <Field
        label="Gemini API key"
        value={form.apiKey}
        onChangeText={set("apiKey")}
        placeholder="AIza…"
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
        hint="Stored on this device only (Keychain/Keystore on phones). A key inside an app can be extracted, so use a restricted, low-quota key for testing."
      />
      <Field label="Chat model" value={form.chatModel} onChangeText={set("chatModel")} autoCapitalize="none" autoCorrect={false} hint="Used for chat, files and dictation." />
      <Field label="Live (voice) model" value={form.liveModel} onChangeText={set("liveModel")} autoCapitalize="none" autoCorrect={false} hint="Used for the voice button, over the Gemini Live API." />
      <View style={{ gap: 8 }}>
        <Text style={styles.label}>Voice</Text>
        <View style={styles.chips}>
          {VOICES.map((voice) => (
            <Pressable key={voice} onPress={() => set("voice")(voice)} style={[styles.chip, form.voice === voice && styles.chipOn]}>
              <Text style={[styles.chipText, form.voice === voice && { color: "#fff" }]}>{voice}</Text>
            </Pressable>
          ))}
        </View>
      </View>
      <SheetButton label="Save" onPress={save} />
      <SheetButton label="Reset demo data" kind="secondary" onPress={() => { resetDemo(); onClose(); }} />
      <SheetButton
        label={confirmClear ? "Tap again to erase chats, tasks and files" : "Clear everything"}
        kind="danger"
        onPress={() => {
          if (!confirmClear) setConfirmClear(true);
          else {
            clearAll();
            onClose();
          }
        }}
      />
    </Sheet>
  );
}

export function NewChannelSheet({ visible, onClose, onCreated }) {
  const { addChannel } = useDuet();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [icon, setIcon] = useState("hash");

  useEffect(() => {
    if (visible) {
      setName("");
      setDescription("");
      setIcon("hash");
    }
  }, [visible]);

  const create = () => {
    const id = addChannel({ name, description, icon });
    if (id) {
      onCreated(id);
      onClose();
    }
  };

  return (
    <Sheet visible={visible} onClose={onClose} title="New channel">
      <Field label="Name" value={name} onChangeText={setName} placeholder="e.g. travel" autoCapitalize="none" autoFocus />
      <Field label="What is it for?" value={description} onChangeText={setDescription} placeholder="Optional" />
      <View style={styles.chips}>
        {CHANNEL_ICONS.map((glyph) => (
          <Pressable key={glyph} onPress={() => setIcon(glyph)} style={[styles.iconChip, icon === glyph && styles.chipOn]}>
            <Icon name={glyph} size={18} color={icon === glyph ? "#fff" : colors.textDim} />
          </Pressable>
        ))}
      </View>
      <SheetButton label="Create channel" onPress={create} disabled={!name.trim()} />
    </Sheet>
  );
}

export function NewFileSheet({ visible, onClose, onCreated }) {
  const { createArtifact, state } = useDuet();
  const [kind, setKind] = useState("deck");
  const [title, setTitle] = useState("");
  const [brief, setBrief] = useState("");

  useEffect(() => {
    if (visible) {
      setKind("deck");
      setTitle("");
      setBrief("");
    }
  }, [visible]);

  const create = () => {
    const fileTitle = title.trim() || brief.trim().slice(0, 40) || "Untitled";
    // Fire and forget: the new card appears in Make with a spinner while Gemini works.
    createArtifact({ kind, title: fileTitle, brief: brief.trim() || fileTitle, channel: state.channels[0]?.id || null }).then((result) => {
      if (result?.artifact_id) onCreated?.(result.artifact_id);
    });
    onClose();
  };

  return (
    <Sheet visible={visible} onClose={onClose} title="Make something">
      <View style={styles.chips}>
        {Object.entries(KIND_META).map(([key, meta]) => (
          <Pressable key={key} onPress={() => setKind(key)} style={[styles.kind, kind === key && { borderColor: meta.color, backgroundColor: "#1f1f21" }]}>
            <Icon name={meta.icon} size={18} color={meta.color} />
            <Text style={styles.kindText}>{meta.label}</Text>
          </Pressable>
        ))}
      </View>
      <Field label="Title" value={title} onChangeText={setTitle} placeholder="Optional" />
      <Field label="What should it say?" value={brief} onChangeText={setBrief} placeholder="Describe it in a sentence or two" multiline />
      <SheetButton label="Create with Gemini" onPress={create} disabled={!brief.trim() && !title.trim()} />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  label: { color: colors.textDim, fontSize: 12.5, fontWeight: "600" },
  input: { backgroundColor: colors.surfaceRaised, borderRadius: 12, color: colors.text, fontSize: 15.5, paddingHorizontal: 14, paddingVertical: 11, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.borderStrong },
  hint: { color: colors.textFaint, fontSize: 12, lineHeight: 16 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { paddingHorizontal: 14, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceRaised },
  chipOn: { backgroundColor: colors.accent },
  chipText: { color: colors.textDim, fontSize: 14, fontWeight: "500" },
  iconChip: { width: 42, height: 42, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceRaised },
  kind: { flex: 1, minWidth: 100, flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center", height: 48, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceRaised },
  kindText: { color: colors.text, fontSize: 13.5, fontWeight: "600" },
});
