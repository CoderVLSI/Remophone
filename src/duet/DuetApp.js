import React, { useEffect, useState } from "react";
import { ActivityIndicator, Keyboard, Platform, StyleSheet, View, useWindowDimensions } from "react-native";
import { StatusBar } from "expo-status-bar";
import { DuetProvider, useDuet } from "./store";
import { EVERYTHING } from "./seed";
import { TabBar, TopBar } from "./components/Chrome";
import { colors, TAB_BAR_HEIGHT } from "./theme";
import ChatScreen from "./screens/ChatScreen";
import TasksScreen from "./screens/TasksScreen";
import MakeScreen from "./screens/MakeScreen";
import SeeAllScreen from "./screens/SeeAllScreen";
import ViewerScreen from "./screens/ViewerScreen";
import DrawerPanel from "./screens/DrawerPanel";
import VoiceOverlay from "./screens/VoiceOverlay";
import { NewChannelSheet, NewFileSheet, SettingsSheet } from "./screens/Sheets";
import Sheet, { SheetRow } from "./components/Sheet";

function useKeyboardVisible() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (Platform.OS === "web") return undefined;
    const show = Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow", () => setVisible(true));
    const hide = Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide", () => setVisible(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return visible;
}

function Shell() {
  const { state, settings, hydrated, togglePin, deleteArtifact } = useDuet();
  const [tab, setTab] = useState("chat");
  const [channel, setChannel] = useState(EVERYTHING);
  const [drawer, setDrawer] = useState(false);
  const [viewer, setViewer] = useState(null);
  const [seeAll, setSeeAll] = useState(null);
  const [sheet, setSheet] = useState(null); // 'settings' | 'channel' | 'file'
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [cardMenu, setCardMenu] = useState(null);
  const keyboard = useKeyboardVisible();

  const pending = state.tasks.filter((t) => t.status === "needs_approval").length;
  const openChannel = (id) => {
    setChannel(id);
    setTab("chat");
    setDrawer(false);
  };

  if (!hydrated) {
    return (
      <View style={[styles.fill, { alignItems: "center", justifyContent: "center" }]}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  const showTabs = !keyboard;
  return (
    <View style={styles.fill}>
      <TopBar name={settings.userName} onMenu={() => setDrawer(true)} onAvatar={() => setSheet("settings")} />

      <View style={styles.fill}>
        {tab === "chat" ? (
          <ChatScreen
            channelId={channel}
            onOpenArtifact={setViewer}
            onOpenChannel={openChannel}
            onPlus={() => setSheet("file")}
            onVoice={() => setVoiceOpen(true)}
            bottomInset={showTabs ? TAB_BAR_HEIGHT + 22 : 10}
          />
        ) : null}
        {tab === "tasks" ? <TasksScreen /> : null}
        {tab === "make" ? (
          <MakeScreen onOpenArtifact={setViewer} onSeeAll={setSeeAll} onNew={() => setSheet("file")} onCardMenu={setCardMenu} />
        ) : null}
      </View>

      {showTabs ? <TabBar active={tab} onChange={setTab} badge={pending} /> : null}

      {seeAll ? <SeeAllScreen kind={seeAll} onClose={() => setSeeAll(null)} onOpenArtifact={setViewer} onCardMenu={setCardMenu} /> : null}
      {viewer ? <ViewerScreen artifactId={viewer} onClose={() => setViewer(null)} /> : null}

      <DrawerPanel
        open={drawer}
        activeChannel={channel}
        onSelect={openChannel}
        onNewChannel={() => {
          setDrawer(false);
          setSheet("channel");
        }}
        onSettings={() => {
          setDrawer(false);
          setSheet("settings");
        }}
        onClose={() => setDrawer(false)}
      />

      <SettingsSheet visible={sheet === "settings"} onClose={() => setSheet(null)} />
      <NewChannelSheet visible={sheet === "channel"} onClose={() => setSheet(null)} onCreated={openChannel} />
      <NewFileSheet
        visible={sheet === "file"}
        onClose={() => setSheet(null)}
        onCreated={() => {
          setTab("make");
        }}
      />
      <VoiceOverlay visible={voiceOpen} channelId={channel} onClose={() => setVoiceOpen(false)} />

      <Sheet visible={!!cardMenu} onClose={() => setCardMenu(null)} title={cardMenu?.title}>
        <SheetRow
          icon="bookmark"
          label={cardMenu?.pinned ? "Unpin" : "Pin to Make"}
          onPress={() => {
            togglePin(cardMenu.id);
            setCardMenu(null);
          }}
        />
        <SheetRow
          icon="trash-2"
          danger
          label="Delete"
          onPress={() => {
            deleteArtifact(cardMenu.id);
            setCardMenu(null);
          }}
        />
      </Sheet>
    </View>
  );
}

export default function DuetApp() {
  const { width, height } = useWindowDimensions();
  // On wide web windows, render inside a phone-sized column like the reference screenshots.
  const framed = Platform.OS === "web" && width > 520;
  return (
    <View style={[styles.outer, framed && styles.outerFramed]}>
      <View style={[styles.phone, framed && { width: 390, height: Math.min(height - 32, 844), borderRadius: 38, borderWidth: 1, borderColor: "#2a2a2d", overflow: "hidden" }]}>
        <StatusBar style="light" />
        <DuetProvider>
          <Shell />
        </DuetProvider>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.bg },
  outer: { flex: 1, backgroundColor: colors.bg },
  outerFramed: { backgroundColor: "#f8f5ee", alignItems: "center", justifyContent: "center" },
  phone: { flex: 1, width: "100%", backgroundColor: colors.bg },
});
