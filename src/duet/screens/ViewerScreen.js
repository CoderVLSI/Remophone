import React, { useEffect, useState } from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import Icon from "../components/Icon";
import Composer from "../components/Composer";
import Sheet, { SheetRow } from "../components/Sheet";
import { RoundButton, TOP_INSET } from "../components/Chrome";
import { DocView, FRAME_H, FRAME_W, FrameView, SLIDE_H, SLIDE_W, SlideView } from "../components/ArtifactViews";
import { colors, truncate } from "../theme";
import { useDuet } from "../store";
import { exportArtifact, exportPptx } from "../exportArtifact";

const BLANK_FRAME = {
  name: "New frame",
  description: "",
  palette: ["#111214", "#e5532c", "#f4f2ef", "#2a2a2d"],
  elements: [{ type: "heading", text: "New frame" }],
};

function Pill({ children, style }) {
  return <View style={[styles.pill, style]}>{children}</View>;
}

function PillButton({ children, onPress, label, style }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} hitSlop={6} style={[styles.pillButton, style]}>
      {children}
    </Pressable>
  );
}

export default function ViewerScreen({ artifactId, onClose }) {
  const { state, editArtifact, togglePin, deleteArtifact, updateArtifactContent } = useDuet();
  const artifact = state.artifacts.find((a) => a.id === artifactId);
  const { width: winW, height: winH } = useWindowDimensions();

  const [index, setIndex] = useState(0);
  const [zoom, setZoom] = useState("fit");
  const [canvas, setCanvas] = useState({ w: 0, h: 0 });
  const [showNotes, setShowNotes] = useState(false);
  const [present, setPresent] = useState(false);
  const [menu, setMenu] = useState(null);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [exporting, setExporting] = useState(false);

  const kind = artifact?.kind;
  const paged = kind === "deck" || kind === "design";
  const items = !artifact?.content ? [] : kind === "deck" ? artifact.content.slides || [] : kind === "design" ? artifact.content.frames || [] : [];
  const total = items.length;
  const base = kind === "design" ? { w: FRAME_W, h: FRAME_H } : { w: SLIDE_W, h: SLIDE_H };

  useEffect(() => {
    if (index > Math.max(0, total - 1)) setIndex(Math.max(0, total - 1));
  }, [total, index]);

  if (!artifact) return null;

  const fitZoom = canvas.w ? Math.max(0.05, Math.min((canvas.w - 32) / base.w, (canvas.h - 32) / base.h)) : 0.2;
  const zoomValue = zoom === "fit" ? fitZoom : zoom;
  const working = artifact.status === "generating" || artifact.editing;
  const current = items[index];

  const replaceItems = (next) => {
    const content = kind === "deck" ? { ...artifact.content, slides: next } : { ...artifact.content, frames: next };
    updateArtifactContent(artifact.id, content);
  };
  const addBlank = () => {
    const blank = kind === "deck" ? { layout: "bullets", title: "New slide", bullets: [] } : { ...BLANK_FRAME };
    const next = [...items.slice(0, index + 1), blank, ...items.slice(index + 1)];
    replaceItems(next);
    setIndex(index + 1);
    setMenu(null);
  };
  const duplicate = () => {
    if (!current) return;
    const next = [...items.slice(0, index + 1), JSON.parse(JSON.stringify(current)), ...items.slice(index + 1)];
    replaceItems(next);
    setIndex(index + 1);
    setMenu(null);
  };
  const removeCurrent = () => {
    if (total <= 1) return;
    replaceItems(items.filter((_, i) => i !== index));
    setIndex(Math.max(0, index - 1));
    setMenu(null);
  };

  const submitEdit = async () => {
    const instruction = draft.trim();
    if (!instruction || working) return;
    setDraft("");
    setError(null);
    const result = await editArtifact(artifact.id, instruction);
    if (result?.error) setError(result.error);
  };

  const runExport = async (format) => {
    setMenu(null);
    setError(null);
    setExporting(true);
    try {
      if (format === "pptx") await exportPptx(artifact);
      else await exportArtifact(artifact);
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setExporting(false);
    }
  };

  const renderItem = (item, widthPx) =>
    kind === "deck" ? <SlideView slide={item} width={widthPx} /> : <FrameView frame={item} width={widthPx} />;

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: TOP_INSET }]}>
        <RoundButton icon="x" onPress={onClose} label="Close" />
        <Text numberOfLines={1} style={styles.title}>{truncate(artifact.title, 30)}</Text>
        <RoundButton icon="more-horizontal" onPress={() => setMenu("more")} label="More" />
      </View>

      <View style={styles.toolbar}>
        {paged ? (
          <Pill>
            <PillButton label="Add" onPress={() => setMenu("add")} style={{ paddingHorizontal: 12 }}>
              <Icon name="plus" size={18} color={colors.textDim} />
              <Icon name="chevron-down" size={12} color={colors.textFaint} />
            </PillButton>
          </Pill>
        ) : (
          <View />
        )}
        <Pill>
          <PillButton label="Export" onPress={() => (kind === "deck" ? setMenu("export") : runExport("md"))}>
            <Icon name="download" size={17} color={colors.textDim} />
          </PillButton>
          {paged ? (
            <>
              <PillButton label="Present" onPress={() => total && setPresent(true)}>
                <Icon name="play" size={17} color={colors.textDim} />
              </PillButton>
              <PillButton label="Fit to screen" onPress={() => setZoom("fit")}>
                <Icon name="smartphone" size={17} color={colors.textDim} />
              </PillButton>
              <PillButton label="Zoom" onPress={() => setMenu("zoom")} style={{ paddingHorizontal: 8 }}>
                <Text style={styles.zoomText}>{Math.round(zoomValue * 100)}%</Text>
                <Icon name="chevron-down" size={12} color={colors.textFaint} />
              </PillButton>
            </>
          ) : null}
        </Pill>
      </View>

      <View style={styles.canvasWrap} onLayout={(event) => setCanvas({ w: event.nativeEvent.layout.width, h: event.nativeEvent.layout.height })}>
        {paged ? (
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ minWidth: canvas.w, minHeight: canvas.h, alignItems: "center", justifyContent: "center", padding: 16 }}
            horizontal={false}
          >
            <ScrollView horizontal contentContainerStyle={{ minWidth: canvas.w - 32, alignItems: "center", justifyContent: "center" }} showsHorizontalScrollIndicator={false}>
              {current ? <View style={styles.slideShadow}>{renderItem(current, base.w * zoomValue)}</View> : null}
            </ScrollView>
          </ScrollView>
        ) : artifact.content ? (
          <ScrollView contentContainerStyle={{ padding: 22, paddingBottom: 30 }}>
            <DocView content={artifact.content} />
          </ScrollView>
        ) : null}
        {working || exporting ? (
          <View style={styles.working}>
            <ActivityIndicator color={colors.accent} />
            <Text style={styles.workingText}>{exporting ? "Preparing your file…" : artifact.editing ? "Claude Duet is editing…" : "Creating…"}</Text>
          </View>
        ) : null}
        {artifact.status === "error" ? (
          <View style={styles.working}>
            <Icon name="alert-circle" size={22} color={colors.danger} />
            <Text style={[styles.workingText, { color: colors.danger }]}>{artifact.error || "Something went wrong."}</Text>
          </View>
        ) : null}
      </View>

      {paged && showNotes && current?.notes ? (
        <View style={styles.notes}>
          <Text style={styles.notesLabel}>Speaker notes</Text>
          <Text style={styles.notesText}>{current.notes}</Text>
        </View>
      ) : null}
      {paged && showNotes && !current?.notes ? (
        <View style={styles.notes}>
          <Text style={styles.notesText}>No speaker notes for this {kind === "deck" ? "slide" : "frame"}.</Text>
        </View>
      ) : null}

      {paged ? (
        <View style={styles.pagerWrap}>
          <Pill style={{ paddingHorizontal: 4 }}>
            <PillButton label="Previous" onPress={() => setIndex(Math.max(0, index - 1))}>
              <Icon name="chevron-left" size={18} color={index === 0 ? colors.textFaint : colors.text} />
            </PillButton>
            <Text style={styles.pageText}>{total ? `${index + 1}/${total}` : "0/0"}</Text>
            <PillButton label="Next" onPress={() => setIndex(Math.min(total - 1, index + 1))}>
              <Icon name="chevron-right" size={18} color={index >= total - 1 ? colors.textFaint : colors.text} />
            </PillButton>
            <View style={styles.divider} />
            <PillButton label="Speaker notes" onPress={() => setShowNotes((v) => !v)}>
              <Icon name="book-open" size={17} color={showNotes ? colors.accent : colors.textDim} />
            </PillButton>
            <PillButton label="Present" onPress={() => total && setPresent(true)}>
              <Icon name="monitor" size={17} color={colors.textDim} />
            </PillButton>
          </Pill>
        </View>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}
      <View style={styles.composer}>
        <Composer
          value={draft}
          onChangeText={setDraft}
          onSend={submitEdit}
          placeholder="Ask Claude for a change"
          onPlus={paged ? () => setMenu("add") : undefined}
          disabled={working}
        />
      </View>

      <Sheet visible={menu === "more"} onClose={() => { setMenu(null); setConfirmDelete(false); }} title={truncate(artifact.title, 34)}>
        <SheetRow icon="bookmark" label={artifact.pinned ? "Unpin" : "Pin to Make"} onPress={() => { togglePin(artifact.id); setMenu(null); }} />
        {kind === "deck" ? <SheetRow icon="monitor" label="Export as PowerPoint (.pptx)" onPress={() => runExport("pptx")} /> : null}
        <SheetRow icon="download" label="Export as Markdown" onPress={() => runExport("md")} />
        <SheetRow
          icon="trash-2"
          danger
          label={confirmDelete ? "Tap again to delete" : "Delete"}
          onPress={() => {
            if (!confirmDelete) setConfirmDelete(true);
            else {
              setMenu(null);
              onClose();
              deleteArtifact(artifact.id);
            }
          }}
        />
      </Sheet>

      <Sheet visible={menu === "add"} onClose={() => setMenu(null)} title="Add">
        <SheetRow icon="plus-square" label={kind === "deck" ? "Blank slide after this one" : "Blank frame after this one"} onPress={addBlank} />
        <SheetRow icon="copy" label="Duplicate" onPress={duplicate} />
        <SheetRow icon="trash" danger label={kind === "deck" ? "Delete this slide" : "Delete this frame"} onPress={removeCurrent} />
      </Sheet>

      <Sheet visible={menu === "export"} onClose={() => setMenu(null)} title="Export">
        <SheetRow icon="monitor" label="PowerPoint (.pptx)" detail="Opens in PowerPoint, Keynote, Slides" onPress={() => runExport("pptx")} />
        <SheetRow icon="file-text" label="Markdown outline (.md)" onPress={() => runExport("md")} />
      </Sheet>

      <Sheet visible={menu === "zoom"} onClose={() => setMenu(null)} title="Zoom">
        {[["fit", "Fit to screen"], [0.5, "50%"], [1, "100%"]].map(([value, label]) => (
          <SheetRow key={String(value)} icon={zoom === value ? "check" : "search"} label={label} onPress={() => { setZoom(value); setMenu(null); }} />
        ))}
      </Sheet>

      <Modal visible={present} animationType="fade" onRequestClose={() => setPresent(false)} supportedOrientations={["portrait", "landscape"]}>
        <View style={styles.present}>
          {current ? (
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
              {renderItem(current, Math.min(winW - 24, ((winH - 140) * base.w) / base.h))}
            </View>
          ) : null}
          <Pressable style={[StyleSheet.absoluteFill, { flexDirection: "row" }]} accessibilityLabel="Navigate slides">
            <Pressable style={{ flex: 1 }} onPress={() => setIndex(Math.max(0, index - 1))} />
            <Pressable style={{ flex: 1 }} onPress={() => (index >= total - 1 ? setPresent(false) : setIndex(index + 1))} />
          </Pressable>
          <View style={[styles.presentBar, { top: TOP_INSET }]}>
            <RoundButton icon="x" onPress={() => setPresent(false)} label="Exit presentation" />
            <Text style={styles.pageText}>{index + 1}/{total}</Text>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { ...StyleSheet.absoluteFillObject, backgroundColor: colors.bg },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 14, paddingBottom: 8, gap: 10 },
  title: { flex: 1, color: colors.text, fontSize: 15, fontWeight: "700", textAlign: "center" },
  toolbar: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 14, paddingVertical: 6 },
  pill: { flexDirection: "row", alignItems: "center", backgroundColor: "#141415", borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, paddingHorizontal: 2 },
  pillButton: { flexDirection: "row", alignItems: "center", gap: 4, height: 36, paddingHorizontal: 9 },
  zoomText: { color: colors.textDim, fontSize: 13 },
  canvasWrap: { flex: 1, backgroundColor: "#0a0a0b", marginHorizontal: 0 },
  slideShadow: { shadowColor: "#000", shadowOpacity: 0.6, shadowRadius: 16, shadowOffset: { width: 0, height: 6 } },
  working: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.6)", alignItems: "center", justifyContent: "center", gap: 10, padding: 24 },
  workingText: { color: colors.text, fontSize: 14, textAlign: "center" },
  notes: { backgroundColor: colors.surface, paddingHorizontal: 18, paddingVertical: 10, gap: 2, borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  notesLabel: { color: colors.textFaint, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.6 },
  notesText: { color: colors.textDim, fontSize: 14, lineHeight: 20 },
  pagerWrap: { alignItems: "center", paddingVertical: 10 },
  pageText: { color: colors.text, fontSize: 13, minWidth: 44, textAlign: "center" },
  divider: { width: StyleSheet.hairlineWidth, height: 20, backgroundColor: colors.borderStrong, marginHorizontal: 2 },
  error: { color: colors.danger, fontSize: 12.5, textAlign: "center", paddingHorizontal: 20, paddingBottom: 6 },
  composer: { paddingHorizontal: 12, paddingBottom: 14, paddingTop: 2 },
  present: { flex: 1, backgroundColor: "#000" },
  presentBar: { position: "absolute", left: 14, right: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
});
