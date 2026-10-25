import React, { useEffect, useState } from "react";
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import Sheet, { SheetButton } from "../components/Sheet";
import Icon, { CHANNEL_ICONS } from "../components/Icon";
import { KIND_META } from "../components/ArtifactCard";
import { colors } from "../theme";
import { VOICES } from "../gemini/config";
import { checkApiKey } from "../gemini/rest";
import { CONNECTORS, GEMINI_KEY_URL } from "../connectors";
import ConnectorLogo from "../components/ConnectorLogo";
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

const splitModels = (text) => String(text || "").split(/[,\n]/).map((name) => name.trim()).filter(Boolean);

function SectionLabel({ children }) {
  return <Text style={styles.section}>{children}</Text>;
}

function ConnectorsList() {
  const groups = [...new Set(CONNECTORS.map((c) => c.group))];
  return (
    <View style={{ gap: 14 }}>
      <Text style={styles.hint}>
        Connectors let Claude Duet read and act in your other apps, always asking before it sends, pays or deletes. They aren't
        wired up in this build yet, so nothing here connects to a real account.
      </Text>
      {groups.map((group) => (
        <View key={group} style={{ gap: 8 }}>
          <Text style={styles.groupLabel}>{group}</Text>
          {CONNECTORS.filter((c) => c.group === group).map((connector) => (
            <View key={connector.id} style={styles.connector}>
              <ConnectorLogo id={connector.id} size={40} />
              <View style={{ flex: 1 }}>
                <Text style={styles.connectorName}>{connector.name}</Text>
                <Text numberOfLines={2} style={styles.connectorBlurb}>{connector.blurb}</Text>
              </View>
              <View style={styles.soon}>
                <Text style={styles.soonText}>Soon</Text>
              </View>
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

export function SettingsSheet({ visible, onClose }) {
  const { settings, updateSettings, resetDemo, clearAll } = useDuet();
  const [form, setForm] = useState({ ...settings, chatFallbacksText: (settings.chatFallbacks || []).join(", "), liveFallbacksText: (settings.liveFallbacks || []).join(", ") });
  const [confirmClear, setConfirmClear] = useState(false);
  const [keyCheck, setKeyCheck] = useState({ state: "idle", message: "" });

  useEffect(() => {
    if (visible) {
      setForm({ ...settings, chatFallbacksText: (settings.chatFallbacks || []).join(", "), liveFallbacksText: (settings.liveFallbacks || []).join(", ") });
      setConfirmClear(false);
      setKeyCheck({ state: "idle", message: "" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const set = (key) => (value) => setForm((f) => ({ ...f, [key]: value }));
  const save = async () => {
    await updateSettings({
      apiKey: form.apiKey.trim(),
      chatModel: form.chatModel.trim() || settings.chatModel,
      liveModel: form.liveModel.trim() || settings.liveModel,
      chatFallbacks: splitModels(form.chatFallbacksText),
      liveFallbacks: splitModels(form.liveFallbacksText),
      voice: form.voice,
      userName: form.userName.trim() || settings.userName,
    });
    onClose();
  };
  const testKey = async () => {
    setKeyCheck({ state: "checking", message: "" });
    try {
      await checkApiKey({ apiKey: form.apiKey.trim() });
      setKeyCheck({ state: "ok", message: "Key works." });
    } catch (error) {
      setKeyCheck({ state: "error", message: error.message || String(error) });
    }
  };

  return (
    <Sheet visible={visible} onClose={onClose} title="Settings" maxHeight="92%">
      <SectionLabel>Profile</SectionLabel>
      <Field label="Your name" value={form.userName} onChangeText={set("userName")} autoCapitalize="words" />

      <SectionLabel>Gemini</SectionLabel>
      <Field
        label="API key"
        value={form.apiKey}
        onChangeText={(value) => {
          set("apiKey")(value);
          if (keyCheck.state !== "idle") setKeyCheck({ state: "idle", message: "" });
        }}
        placeholder="AIza…"
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
      />
      <View style={styles.keyRow}>
        <Pressable accessibilityRole="link" onPress={() => Linking.openURL(GEMINI_KEY_URL)} style={styles.linkButton}>
          <Icon name="external-link" size={15} color={colors.accent} />
          <Text style={styles.linkText}>Get a Gemini API key</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={testKey} disabled={keyCheck.state === "checking"} style={styles.testButton}>
          {keyCheck.state === "checking" ? <ActivityIndicator size="small" color={colors.text} /> : <Text style={styles.testText}>Test key</Text>}
        </Pressable>
      </View>
      {keyCheck.state === "ok" ? <Text style={[styles.status, { color: colors.success }]}>{keyCheck.message}</Text> : null}
      {keyCheck.state === "error" ? <Text style={[styles.status, { color: colors.danger }]}>{keyCheck.message}</Text> : null}
      <Text style={styles.hint}>
        Opens Google AI Studio, where you create a key for free. The key stays on this device (Keychain/Keystore on phones). A key
        inside an app can still be extracted, so use a restricted, low-quota key.
      </Text>
      <Field label="Chat model" value={form.chatModel} onChangeText={set("chatModel")} autoCapitalize="none" autoCorrect={false} hint="Used for chat, files and dictation." />
      <Field label="Live (voice) model" value={form.liveModel} onChangeText={set("liveModel")} autoCapitalize="none" autoCorrect={false} hint="Used for the voice button, over the Gemini Live API." />
      <Field
        label="Fallback chat models"
        value={form.chatFallbacksText}
        onChangeText={set("chatFallbacksText")}
        autoCapitalize="none"
        autoCorrect={false}
        hint="Comma separated, tried in order if the chat model is missing, retired, rate limited or overloaded. A bad API key doesn't trigger them."
      />
      <Field
        label="Fallback voice models"
        value={form.liveFallbacksText}
        onChangeText={set("liveFallbacksText")}
        autoCapitalize="none"
        autoCorrect={false}
        hint="Same idea for the voice button. Older Live models are being retired, so check these still exist."
      />
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

      <SectionLabel>Connectors</SectionLabel>
      <ConnectorsList />

      <SectionLabel>Data</SectionLabel>
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
  section: { color: colors.text, fontSize: 13, fontWeight: "700", letterSpacing: 0.6, textTransform: "uppercase", marginTop: 10 },
  groupLabel: { color: colors.textFaint, fontSize: 12, fontWeight: "600" },
  connector: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: colors.surfaceRaised, borderRadius: 14, padding: 10 },
  connectorName: { color: colors.text, fontSize: 15, fontWeight: "600" },
  connectorBlurb: { color: colors.textDim, fontSize: 12.5, lineHeight: 17, marginTop: 1 },
  soon: { backgroundColor: colors.surfaceHigh, borderRadius: 10, paddingHorizontal: 9, paddingVertical: 4 },
  soonText: { color: colors.textDim, fontSize: 11.5, fontWeight: "600" },
  keyRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  linkButton: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 8 },
  linkText: { color: colors.accent, fontSize: 14, fontWeight: "600" },
  testButton: { minWidth: 88, height: 38, borderRadius: 12, backgroundColor: colors.surfaceHigh, alignItems: "center", justifyContent: "center", paddingHorizontal: 14 },
  testText: { color: colors.text, fontSize: 14, fontWeight: "600" },
  status: { fontSize: 13, lineHeight: 18 },
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
