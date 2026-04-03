import React, { useEffect, useRef, useState } from "react";
import {
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { StatusBar as ExpoStatusBar } from "expo-status-bar";
import { createRelayMessage, parseRelayMessage } from "./src/relay/protocol";
import {
  getHostNativeCapabilities,
  isNativeHostAvailable,
  startHostMonitoring,
  stopHostMonitoring,
} from "./src/native/hostBridge";
import { initialMessageThreads, initialPhotoAlbums } from "./src/data/demoData";

const roles = [
  {
    key: "host",
    title: "Home Phone",
    description: "Leave this phone at home on Wi-Fi and keep it charging.",
  },
  {
    key: "remote",
    title: "Remote Phone",
    description: "Use this phone to view mirrored alerts and send commands.",
  },
];

const quickActions = [
  { key: "home", label: "Home" },
  { key: "recents", label: "Recents" },
  { key: "notify", label: "Notifications" },
  { key: "ping", label: "Ring Phone" },
  { key: "status", label: "Refresh Status" },
];

const dashboardTabs = ["Notifications", "Messages", "Calls", "Photos", "Device"];

const makeDeviceId = () => `device-${Math.random().toString(36).slice(2, 10)}`;

export default function App() {
  const socketRef = useRef(null);
  const reconnectTimerRef = useRef(null);
  const manualDisconnectRef = useRef(false);
  const deviceIdRef = useRef(makeDeviceId());

  const [role, setRole] = useState("remote");
  const [activeTab, setActiveTab] = useState("Messages");
  const [relayUrl, setRelayUrl] = useState("ws://192.168.1.10:8080");
  const [pairingCode, setPairingCode] = useState("HOME-2481");
  const [keepAwake, setKeepAwake] = useState(true);
  const [autoReconnect, setAutoReconnect] = useState(true);
  const [sessionState, setSessionState] = useState("Idle");
  const [isConnected, setIsConnected] = useState(false);
  const [peerRole, setPeerRole] = useState("Not connected");
  const [lastIncomingCommand, setLastIncomingCommand] = useState("No command received");
  const [lastCallState, setLastCallState] = useState("No call activity");
  const [messageThreads, setMessageThreads] = useState(initialMessageThreads);
  const [photoAlbums, setPhotoAlbums] = useState(initialPhotoAlbums);
  const [selectedThreadId, setSelectedThreadId] = useState(initialMessageThreads[0].id);
  const [notificationFeed, setNotificationFeed] = useState([
    {
      id: "seed-note",
      appName: "RemoPhone",
      title: "Waiting for host phone",
      body: "Once the home phone publishes notifications, they will appear here.",
      receivedAt: "Not yet connected",
    },
  ]);
  const [callFeed, setCallFeed] = useState([
    {
      id: "seed-call",
      state: "idle",
      contact: "No active calls",
      direction: "system",
      receivedAt: "Not yet connected",
    },
  ]);
  const [capabilities, setCapabilities] = useState(getHostNativeCapabilities());
  const [activityLog, setActivityLog] = useState([
    "Open the app on both phones and connect them to the same relay URL.",
  ]);

  const appendLog = (message) => {
    setActivityLog((current) => [message, ...current].slice(0, 10));
  };

  const prependNotification = (entry) => {
    setNotificationFeed((current) => [entry, ...current].slice(0, 6));
  };

  const prependCall = (entry) => {
    setCallFeed((current) => [entry, ...current].slice(0, 6));
  };

  const upsertMessageThread = (entry) => {
    setMessageThreads((current) => {
      const next = current.filter((thread) => thread.id !== entry.id);
      return [entry, ...next].slice(0, 8);
    });
  };

  const updatePhotoAlbums = (entries) => {
    setPhotoAlbums(entries.slice(0, 8));
  };

  const cleanupSocket = () => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    if (socketRef.current) {
      socketRef.current.onopen = null;
      socketRef.current.onmessage = null;
      socketRef.current.onerror = null;
      socketRef.current.onclose = null;
      socketRef.current.close();
      socketRef.current = null;
    }
  };

  const sendMessage = (message) => {
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
      appendLog("Relay is not connected yet.");
      return false;
    }
    socketRef.current.send(JSON.stringify(message));
    return true;
  };

  const publishCapabilities = () => {
    const nextCapabilities = getHostNativeCapabilities();
    setCapabilities(nextCapabilities);

    const delivered = sendMessage(
      createRelayMessage("capabilities", {
        roomId: pairingCode.trim().toUpperCase(),
        fromRole: role,
        capabilities: nextCapabilities,
      })
    );

    if (delivered) {
      appendLog("Published host capabilities to the paired phone.");
    }
  };

  const joinRelay = () => {
    if (!relayUrl.trim() || !pairingCode.trim()) {
      setSessionState("Relay URL and pairing code are required");
      appendLog("Enter both the relay URL and the pairing code before connecting.");
      return;
    }

    manualDisconnectRef.current = false;
    cleanupSocket();
    setSessionState(role === "host" ? "Connecting host..." : "Connecting remote...");
    setPeerRole("Looking for peer");

    const socket = new WebSocket(relayUrl.trim());
    socketRef.current = socket;

    socket.onopen = () => {
      setIsConnected(true);
      setSessionState(role === "host" ? "Waiting for remote phone" : "Waiting for home phone");
      appendLog(`Connected to relay ${relayUrl.trim()}. Joining room ${pairingCode.trim()}.`);
      sendMessage(
        createRelayMessage("join", {
          roomId: pairingCode.trim().toUpperCase(),
          role,
          deviceId: deviceIdRef.current,
          keepAwake,
        })
      );

      if (role === "host") {
        startHostMonitoring(() => {
          appendLog("Native host monitor is only a stub in Expo Go right now.");
        });
        publishCapabilities();
      }
    };

    socket.onmessage = (event) => {
      const message = parseRelayMessage(event.data);
      if (!message) {
        appendLog("Received an invalid relay message.");
        return;
      }

      if (message.type === "joined") {
        setSessionState(`Joined as ${message.payload.role}`);
        appendLog(`Relay accepted this ${message.payload.role} device.`);
        return;
      }

      if (message.type === "presence") {
        const peer = message.payload.peers.find((item) => item.role !== role);
        setPeerRole(peer ? peer.role : "Not connected");
        setSessionState(peer ? `Linked with ${peer.role}` : "Waiting for other phone");
        appendLog(
          peer
            ? `${peer.role} is now in room ${message.payload.roomId}.`
            : `Room ${message.payload.roomId} currently has only this device.`
        );
        return;
      }

      if (message.type === "command") {
        setLastIncomingCommand(message.payload.command);
        appendLog(`Received command ${message.payload.command} from ${message.payload.fromRole}.`);
        if (role === "host") {
          setSessionState(`Command received: ${message.payload.command}`);
        }
        return;
      }

      if (message.type === "status") {
        appendLog(`${message.payload.fromRole} status: ${message.payload.text}`);
        return;
      }

      if (message.type === "notification") {
        prependNotification(message.payload);
        setActiveTab("Notifications");
        appendLog(`Mirrored notification from ${message.payload.appName}: ${message.payload.title}`);
        return;
      }

      if (message.type === "call") {
        setLastCallState(`${message.payload.state} ${message.payload.contact}`);
        prependCall(message.payload);
        setActiveTab("Calls");
        appendLog(`Call update: ${message.payload.state} ${message.payload.contact}`);
        return;
      }

      if (message.type === "message_thread") {
        upsertMessageThread(message.payload);
        setSelectedThreadId(message.payload.id);
        setActiveTab("Messages");
        appendLog(`Mirrored thread from ${message.payload.sender}.`);
        return;
      }

      if (message.type === "photo_library") {
        updatePhotoAlbums(message.payload.albums || []);
        setActiveTab("Photos");
        appendLog("Mirrored photo library summary from the home phone.");
        return;
      }

      if (message.type === "capabilities") {
        setCapabilities(message.payload.capabilities);
        appendLog("Received host capability update.");
        return;
      }

      if (message.type === "error") {
        setSessionState(`Relay error: ${message.payload.message}`);
        appendLog(`Relay error: ${message.payload.message}`);
      }
    };

    socket.onerror = () => {
      setSessionState("Connection error");
      appendLog("The relay connection failed. Check the URL and server.");
    };

    socket.onclose = () => {
      setIsConnected(false);
      setPeerRole("Not connected");
      setSessionState("Disconnected");
      stopHostMonitoring();
      appendLog("Disconnected from relay.");
      if (autoReconnect && !manualDisconnectRef.current) {
        reconnectTimerRef.current = setTimeout(() => {
          appendLog("Trying to reconnect...");
          joinRelay();
        }, 2500);
      }
    };
  };

  const disconnectRelay = () => {
    manualDisconnectRef.current = true;
    stopHostMonitoring();
    cleanupSocket();
    setIsConnected(false);
    setPeerRole("Not connected");
    setSessionState("Disconnected");
    appendLog("Disconnected manually.");
  };

  const triggerAction = (label) => {
    const delivered = sendMessage(
      createRelayMessage("command", {
        roomId: pairingCode.trim().toUpperCase(),
        fromRole: role,
        command: label,
      })
    );

    if (delivered) {
      setSessionState("Command sent");
      appendLog(`Sent command ${label} to room ${pairingCode.trim().toUpperCase()}.`);
    }
  };

  const sendStatusPing = () => {
    const delivered = sendMessage(
      createRelayMessage("status", {
        roomId: pairingCode.trim().toUpperCase(),
        fromRole: role,
        text: role === "host" ? "Home phone is online on Wi-Fi." : "Remote phone is checking in.",
      })
    );
    if (delivered) {
      appendLog("Status message sent.");
    }
  };

  const simulateNotification = () => {
    const notification = {
      id: `${Date.now()}-notification`,
      appName: "WhatsApp",
      title: "2 new messages",
      body: "Family Group: Dinner is at 8 PM.",
      receivedAt: new Date().toLocaleTimeString(),
    };

    prependNotification(notification);
    const delivered = sendMessage(
      createRelayMessage("notification", {
        roomId: pairingCode.trim().toUpperCase(),
        ...notification,
      })
    );

    if (delivered) {
      appendLog("Simulated a mirrored notification from the home phone.");
    } else {
      appendLog("Notification was added locally, but the relay is offline.");
    }
  };

  const simulateCall = () => {
    const callEvent = {
      id: `${Date.now()}-call`,
      state: "ringing",
      contact: "Dad",
      direction: "incoming",
      receivedAt: new Date().toLocaleTimeString(),
    };

    setLastCallState(`${callEvent.state} ${callEvent.contact}`);
    prependCall(callEvent);
    const delivered = sendMessage(
      createRelayMessage("call", {
        roomId: pairingCode.trim().toUpperCase(),
        ...callEvent,
      })
    );

    if (delivered) {
      appendLog("Simulated an incoming call update from the home phone.");
    } else {
      appendLog("Call update was added locally, but the relay is offline.");
    }
  };

  const simulateMessageThread = () => {
    const thread = {
      id: `thread-${Date.now()}`,
      sender: "Mom",
      preview: "Bring milk on the way back.",
      time: new Date().toLocaleTimeString(),
      messages: ["Bring milk on the way back.", "Also check if bread is there."],
    };

    upsertMessageThread(thread);
    setSelectedThreadId(thread.id);
    const delivered = sendMessage(
      createRelayMessage("message_thread", {
        roomId: pairingCode.trim().toUpperCase(),
        ...thread,
      })
    );

    if (delivered) {
      appendLog("Simulated a mirrored message thread from the home phone.");
    } else {
      appendLog("Message thread was added locally, but the relay is offline.");
    }
  };

  const simulatePhotoLibrary = () => {
    const albums = [
      { id: "camera-live", label: "Camera", accent: "#8b5e3c", count: 186 },
      { id: "family-live", label: "Family", accent: "#376d58", count: 42 },
      { id: "screens-live", label: "Screenshots", accent: "#5c4d8d", count: 51 },
      { id: "docs-live", label: "Documents", accent: "#a04f45", count: 13 },
    ];

    updatePhotoAlbums(albums);
    const delivered = sendMessage(
      createRelayMessage("photo_library", {
        roomId: pairingCode.trim().toUpperCase(),
        albums,
      })
    );

    if (delivered) {
      appendLog("Simulated a mirrored photo library summary from the home phone.");
    } else {
      appendLog("Photo library was updated locally, but the relay is offline.");
    }
  };

  const openPermissionsGuide = () => {
    appendLog(
      role === "host"
        ? "For real notification and call mirroring, the home phone needs a native Android build with notification-listener and telecom access."
        : "The remote phone can already receive mirrored events here. Full host-side device access still needs native Android code."
    );
    setSessionState("Permission setup required");
  };

  useEffect(() => {
    setCapabilities(getHostNativeCapabilities());
  }, [role]);

  useEffect(() => () => {
    stopHostMonitoring();
    cleanupSocket();
  }, []);

  const selectedThread =
    messageThreads.find((thread) => thread.id === selectedThreadId) || messageThreads[0] || initialMessageThreads[0];
  const deviceStats = [
    { label: "Phone", value: role === "host" ? "Home Phone" : "OnePlus Nord 4" },
    { label: "Battery", value: keepAwake ? "72%" : "58%" },
    { label: "Wi-Fi", value: isConnected ? "Connected" : "Offline" },
    { label: "Peer", value: peerRole },
    { label: "Last command", value: lastIncomingCommand },
    { label: "Last call", value: lastCallState },
  ];

  const renderDashboardContent = () => {
    if (activeTab === "Notifications") {
      return (
        <View style={styles.contentPanel}>
          <Text style={styles.contentTitle}>Notifications</Text>
          {notificationFeed.map((item) => (
            <View key={item.id} style={styles.feedCard}>
              <Text style={styles.feedTitle}>
                {item.appName} · {item.title}
              </Text>
              <Text style={styles.feedBody}>{item.body}</Text>
              <Text style={styles.feedMeta}>{item.receivedAt}</Text>
            </View>
          ))}
        </View>
      );
    }

    if (activeTab === "Messages") {
      return (
        <View style={styles.contentPanel}>
          <Text style={styles.contentTitle}>Messages</Text>
          <View style={styles.messagesLayout}>
            <View style={styles.threadList}>
              {messageThreads.map((thread) => {
                const selected = thread.id === selectedThreadId;
                return (
                  <TouchableOpacity
                    key={thread.id}
                    activeOpacity={0.85}
                    style={[styles.threadCard, selected && styles.threadCardSelected]}
                    onPress={() => setSelectedThreadId(thread.id)}
                  >
                    <Text style={[styles.threadSender, selected && styles.threadSenderSelected]}>{thread.sender}</Text>
                    <Text style={[styles.threadPreview, selected && styles.threadPreviewSelected]}>
                      {thread.preview}
                    </Text>
                    <Text style={[styles.threadTime, selected && styles.threadTimeSelected]}>{thread.time}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <View style={styles.messageDetail}>
              <Text style={styles.messageTitle}>{selectedThread.sender}</Text>
              {selectedThread.messages.map((message) => (
                <View key={message} style={styles.chatBubble}>
                  <Text style={styles.chatText}>{message}</Text>
                </View>
              ))}
              <View style={styles.composeBar}>
                <Text style={styles.composeText}>Send a message</Text>
              </View>
            </View>
          </View>
        </View>
      );
    }

    if (activeTab === "Calls") {
      return (
        <View style={styles.contentPanel}>
          <Text style={styles.contentTitle}>Calls</Text>
          {callFeed.map((item) => (
            <View key={item.id} style={styles.feedCard}>
              <Text style={styles.feedTitle}>
                {item.state} · {item.contact}
              </Text>
              <Text style={styles.feedBody}>Direction: {item.direction}</Text>
              <Text style={styles.feedMeta}>{item.receivedAt}</Text>
            </View>
          ))}
        </View>
      );
    }

    if (activeTab === "Photos") {
      return (
        <View style={styles.contentPanel}>
          <Text style={styles.contentTitle}>Photos</Text>
          <View style={styles.photoGrid}>
            {photoAlbums.map((photo) => (
              <View key={photo.id} style={[styles.photoTile, { backgroundColor: photo.accent }]}>
                <Text style={styles.photoLabel}>{photo.label}</Text>
                <Text style={styles.photoMeta}>{photo.count} items</Text>
              </View>
            ))}
          </View>
        </View>
      );
    }

    return (
      <View style={styles.contentPanel}>
        <Text style={styles.contentTitle}>Device</Text>
        <View style={styles.deviceGrid}>
          {deviceStats.map((item) => (
            <View key={item.label} style={styles.deviceCard}>
              <Text style={styles.deviceLabel}>{item.label}</Text>
              <Text style={styles.deviceValue}>{item.value}</Text>
            </View>
          ))}
        </View>
      </View>
    );
  };

  const isHost = role === "host";

  return (
    <SafeAreaView style={styles.safeArea}>
      <ExpoStatusBar style="dark" />
      <StatusBar barStyle="dark-content" />
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Text style={styles.brand}>RemoPhone</Text>
          <Text style={styles.headerSub}>Android phone-to-phone link</Text>
        </View>

        <View style={styles.roleRow}>
          {roles.map((item) => {
            const selected = item.key === role;
            return (
              <TouchableOpacity
                key={item.key}
                activeOpacity={0.9}
                onPress={() => setRole(item.key)}
                style={[styles.roleCard, selected && styles.roleCardSelected]}
              >
                <Text style={[styles.roleTitle, selected && styles.roleTitleSelected]}>{item.title}</Text>
                <Text style={[styles.roleDescription, selected && styles.roleDescriptionSelected]}>
                  {item.description}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.dashboardShell}>
          <View style={styles.sidebar}>
            <Text style={styles.phoneName}>{isHost ? "Home Phone" : "OnePlus Nord 4"}</Text>
            <Text style={styles.phoneSub}>{isConnected ? "Connected to relay" : "Waiting for connection"}</Text>

            <View style={styles.connectionBadge}>
              <Text style={styles.connectionBadgeText}>{sessionState}</Text>
            </View>

            <View style={styles.statsRow}>
              <Text style={styles.smallStat}>Battery 72%</Text>
              <Text style={styles.smallStat}>{isConnected ? "Wi-Fi On" : "Wi-Fi Off"}</Text>
            </View>

            <View style={styles.quickGrid}>
              {quickActions.slice(0, 4).map((action) => (
                <TouchableOpacity
                  key={action.key}
                  style={styles.quickButton}
                  activeOpacity={0.85}
                  onPress={() => triggerAction(action.label)}
                >
                  <Text style={styles.quickButtonText}>{action.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.sidebarTitle}>Notifications</Text>
            {notificationFeed.slice(0, 3).map((item) => (
              <View key={item.id} style={styles.sidebarCard}>
                <Text style={styles.sidebarCardTitle}>{item.appName}</Text>
                <Text style={styles.sidebarCardBody}>{item.title}</Text>
              </View>
            ))}
          </View>

          <View style={styles.mainPanel}>
            <View style={styles.toolbar}>
              {dashboardTabs.map((tab) => {
                const selected = tab === activeTab;
                return (
                  <TouchableOpacity
                    key={tab}
                    activeOpacity={0.85}
                    onPress={() => setActiveTab(tab)}
                    style={[styles.tabButton, selected && styles.tabButtonSelected]}
                  >
                    <Text style={[styles.tabText, selected && styles.tabTextSelected]}>{tab}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {renderDashboardContent()}
          </View>
        </View>

        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Connection</Text>
          <Text style={styles.label}>Relay URL</Text>
          <TextInput
            style={styles.input}
            value={relayUrl}
            onChangeText={setRelayUrl}
            autoCapitalize="none"
            placeholder="ws://192.168.1.10:8080"
            placeholderTextColor="#7f7a71"
          />

          <Text style={styles.label}>Pairing code</Text>
          <TextInput
            style={styles.input}
            value={pairingCode}
            onChangeText={setPairingCode}
            autoCapitalize="characters"
            placeholder="HOME-2481"
            placeholderTextColor="#7f7a71"
          />

          <View style={styles.switchRow}>
            <View>
              <Text style={styles.switchTitle}>Keep screen awake</Text>
              <Text style={styles.switchHint}>Useful for the home phone left plugged in.</Text>
            </View>
            <Switch value={keepAwake} onValueChange={setKeepAwake} trackColor={{ true: "#2f6b52" }} />
          </View>

          <View style={styles.switchRow}>
            <View>
              <Text style={styles.switchTitle}>Auto reconnect</Text>
              <Text style={styles.switchHint}>Reconnect if Wi-Fi drops briefly.</Text>
            </View>
            <Switch value={autoReconnect} onValueChange={setAutoReconnect} trackColor={{ true: "#2f6b52" }} />
          </View>

          <View style={styles.buttonRow}>
            <TouchableOpacity style={styles.primaryButton} activeOpacity={0.9} onPress={joinRelay}>
              <Text style={styles.primaryButtonText}>
                {isConnected ? "Reconnect" : isHost ? "Start Hosting" : "Connect Remote"}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryButton} activeOpacity={0.9} onPress={disconnectRelay}>
              <Text style={styles.secondaryButtonText}>Disconnect</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.buttonRow}>
            <TouchableOpacity style={styles.secondaryWideButton} activeOpacity={0.9} onPress={sendStatusPing}>
              <Text style={styles.secondaryButtonText}>Send Status</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryWideButton} activeOpacity={0.9} onPress={openPermissionsGuide}>
              <Text style={styles.secondaryButtonText}>Permissions</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.statusStack}>
            <View style={styles.statusPill}>
              <Text style={styles.statusLabel}>Status</Text>
              <Text style={styles.statusValue}>{sessionState}</Text>
            </View>
            <View style={styles.statusPill}>
              <Text style={styles.statusLabel}>Peer</Text>
              <Text style={styles.statusValue}>{peerRole}</Text>
            </View>
            <View style={styles.statusPill}>
              <Text style={styles.statusLabel}>Socket</Text>
              <Text style={styles.statusValue}>{isConnected ? "Connected" : "Offline"}</Text>
            </View>
          </View>
        </View>

        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Host Capabilities</Text>
          <View style={styles.list}>
            {[
              `Mode: ${isNativeHostAvailable() ? "Custom native host available" : "Expo stub only"}`,
              `Notification mirroring: ${capabilities.notifications ? "ready" : "needs native build"}`,
              `Call state monitoring: ${capabilities.callState ? "ready" : "needs native build"}`,
              `Call actions: ${capabilities.callActions ? "ready" : "limited"}`,
              `Accessibility control: ${capabilities.accessibilityControl ? "ready" : "needs native build"}`,
              `Screen capture: ${capabilities.screenCapture ? "ready" : "needs native build"}`,
            ].map((item) => (
              <Text key={item} style={styles.listItem}>
                - {item}
              </Text>
            ))}
          </View>
          {isHost ? (
            <View style={styles.buttonRow}>
              <TouchableOpacity style={styles.secondaryWideButton} activeOpacity={0.9} onPress={publishCapabilities}>
                <Text style={styles.secondaryButtonText}>Publish Capabilities</Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </View>

        <View style={styles.panel}>
          <Text style={styles.panelTitle}>{isHost ? "Home Phone Simulator" : "Remote Controls"}</Text>
          {isHost ? (
            <>
              <View style={styles.list}>
                {[
                  "Keep this phone plugged in and disable battery optimizations for the app.",
                  "Use the same relay URL and pairing code on both phones.",
                  `Latest incoming command: ${lastIncomingCommand}`,
                  `Latest call state: ${lastCallState}`,
                ].map((item) => (
                  <Text key={item} style={styles.listItem}>
                    - {item}
                  </Text>
                ))}
              </View>
              <View style={styles.buttonRow}>
                <TouchableOpacity style={styles.secondaryWideButton} activeOpacity={0.9} onPress={simulateNotification}>
                  <Text style={styles.secondaryButtonText}>Simulate Notification</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.secondaryWideButton} activeOpacity={0.9} onPress={simulateCall}>
                  <Text style={styles.secondaryButtonText}>Simulate Call</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.buttonRow}>
                <TouchableOpacity style={styles.secondaryWideButton} activeOpacity={0.9} onPress={simulateMessageThread}>
                  <Text style={styles.secondaryButtonText}>Simulate Messages</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.secondaryWideButton} activeOpacity={0.9} onPress={simulatePhotoLibrary}>
                  <Text style={styles.secondaryButtonText}>Simulate Photos</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <View style={styles.actionGrid}>
              {quickActions.map((action) => (
                <TouchableOpacity
                  key={action.key}
                  style={styles.actionButton}
                  activeOpacity={0.9}
                  onPress={() => triggerAction(action.label)}
                >
                  <Text style={styles.actionText}>{action.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Mirrored Notifications</Text>
          <View style={styles.list}>
            {notificationFeed.map((item) => (
              <View key={item.id} style={styles.feedCard}>
                <Text style={styles.feedTitle}>
                  {item.appName} · {item.title}
                </Text>
                <Text style={styles.feedBody}>{item.body}</Text>
                <Text style={styles.feedMeta}>{item.receivedAt}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Call Activity</Text>
          <View style={styles.list}>
            {callFeed.map((item) => (
              <View key={item.id} style={styles.feedCard}>
                <Text style={styles.feedTitle}>
                  {item.state} · {item.contact}
                </Text>
                <Text style={styles.feedBody}>Direction: {item.direction}</Text>
                <Text style={styles.feedMeta}>{item.receivedAt}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Recent Activity</Text>
          <View style={styles.list}>
            {activityLog.map((item, index) => (
              <Text key={`${item}-${index}`} style={styles.logItem}>
                {item}
              </Text>
            ))}
          </View>
        </View>

        <View style={styles.warningPanel}>
          <Text style={styles.warningTitle}>Important limitation</Text>
          <Text style={styles.warningText}>
            This version now supports live notification and call event transport through the relay. The home phone still
            cannot silently read system notifications, detect all calls, answer calls, or inject full-device controls in
            Expo Go. Those parts require a custom Android host build with Notification Listener, Telecom integration,
            Accessibility, foreground services, and battery-optimization exemptions.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#dce7ea",
  },
  container: {
    padding: 16,
    paddingBottom: 36,
    gap: 16,
  },
  header: {
    paddingHorizontal: 6,
  },
  brand: {
    color: "#173b2c",
    fontSize: 34,
    fontWeight: "800",
  },
  headerSub: {
    color: "#4e6763",
    fontSize: 15,
    marginTop: 4,
  },
  roleRow: {
    flexDirection: "row",
    gap: 10,
  },
  roleCard: {
    flex: 1,
    backgroundColor: "#f7f5ef",
    borderRadius: 22,
    padding: 16,
  },
  roleCardSelected: {
    backgroundColor: "#2b6da6",
  },
  roleTitle: {
    color: "#173b2c",
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 8,
  },
  roleTitleSelected: {
    color: "#f7fbff",
  },
  roleDescription: {
    color: "#52615f",
    fontSize: 13,
    lineHeight: 19,
  },
  roleDescriptionSelected: {
    color: "#e6f1fa",
  },
  dashboardShell: {
    backgroundColor: "#f4f6f8",
    borderRadius: 28,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#cad7dd",
  },
  sidebar: {
    backgroundColor: "#eef2f2",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#d2dade",
  },
  phoneName: {
    color: "#1a2326",
    fontSize: 24,
    fontWeight: "700",
  },
  phoneSub: {
    color: "#627176",
    fontSize: 14,
    marginTop: 4,
  },
  connectionBadge: {
    alignSelf: "flex-start",
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: "#d9efe0",
  },
  connectionBadgeText: {
    color: "#1a5b33",
    fontSize: 13,
    fontWeight: "700",
  },
  statsRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 12,
  },
  smallStat: {
    color: "#4f6162",
    fontSize: 13,
    backgroundColor: "#ffffff",
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 12,
  },
  quickGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 14,
  },
  quickButton: {
    backgroundColor: "#2b6da6",
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 14,
    minWidth: "47%",
    alignItems: "center",
  },
  quickButtonText: {
    color: "#f5faff",
    fontSize: 13,
    fontWeight: "700",
  },
  sidebarTitle: {
    color: "#1a2326",
    fontSize: 22,
    fontWeight: "700",
    marginTop: 18,
    marginBottom: 12,
  },
  sidebarCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 12,
    marginBottom: 10,
  },
  sidebarCardTitle: {
    color: "#1f2b2e",
    fontSize: 14,
    fontWeight: "700",
  },
  sidebarCardBody: {
    color: "#6c7579",
    fontSize: 13,
    marginTop: 4,
  },
  mainPanel: {
    padding: 16,
    backgroundColor: "#fbfbfc",
  },
  toolbar: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 14,
  },
  tabButton: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: "#e8eef2",
  },
  tabButtonSelected: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#cfdbe1",
  },
  tabText: {
    color: "#5b686d",
    fontSize: 14,
    fontWeight: "600",
  },
  tabTextSelected: {
    color: "#1a2326",
  },
  contentPanel: {
    gap: 10,
  },
  contentTitle: {
    color: "#1a2326",
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 4,
  },
  panel: {
    backgroundColor: "#f7f5ef",
    borderRadius: 24,
    padding: 18,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
  },
  panelTitle: {
    color: "#173b2c",
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 14,
  },
  label: {
    color: "#355043",
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 8,
  },
  input: {
    backgroundColor: "#efe5d7",
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: "#182a20",
    marginBottom: 14,
  },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
    gap: 14,
  },
  switchTitle: {
    color: "#173b2c",
    fontSize: 16,
    fontWeight: "600",
  },
  switchHint: {
    color: "#6a6f67",
    fontSize: 13,
    marginTop: 2,
  },
  buttonRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 8,
  },
  primaryButton: {
    flex: 1,
    backgroundColor: "#173b2c",
    borderRadius: 18,
    paddingVertical: 15,
    alignItems: "center",
  },
  primaryButtonText: {
    color: "#f8efde",
    fontSize: 15,
    fontWeight: "700",
  },
  secondaryButton: {
    paddingHorizontal: 18,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#173b2c",
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryWideButton: {
    flex: 1,
    paddingHorizontal: 18,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#173b2c",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 15,
  },
  secondaryButtonText: {
    color: "#173b2c",
    fontSize: 15,
    fontWeight: "700",
  },
  statusStack: {
    gap: 10,
    marginTop: 16,
  },
  statusPill: {
    backgroundColor: "#ece5d8",
    borderRadius: 18,
    padding: 14,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  statusLabel: {
    color: "#5a655f",
    fontSize: 14,
    fontWeight: "600",
  },
  statusValue: {
    color: "#173b2c",
    fontSize: 14,
    fontWeight: "700",
    flexShrink: 1,
    textAlign: "right",
  },
  list: {
    gap: 10,
  },
  listItem: {
    color: "#33443b",
    fontSize: 15,
    lineHeight: 22,
  },
  actionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  actionButton: {
    width: "48%",
    backgroundColor: "#efe5d7",
    borderRadius: 20,
    paddingVertical: 18,
    alignItems: "center",
  },
  actionText: {
    color: "#173b2c",
    fontSize: 15,
    fontWeight: "700",
  },
  feedCard: {
    backgroundColor: "#f5ede2",
    borderRadius: 18,
    padding: 14,
  },
  feedTitle: {
    color: "#173b2c",
    fontSize: 15,
    fontWeight: "700",
  },
  feedBody: {
    color: "#4f5852",
    fontSize: 14,
    lineHeight: 20,
    marginTop: 6,
  },
  feedMeta: {
    color: "#746f66",
    fontSize: 12,
    marginTop: 8,
  },
  messagesLayout: {
    gap: 12,
  },
  threadList: {
    gap: 10,
  },
  threadCard: {
    backgroundColor: "#eef2f5",
    borderRadius: 16,
    padding: 14,
  },
  threadCardSelected: {
    backgroundColor: "#dde8f3",
    borderWidth: 1,
    borderColor: "#c3d5e4",
  },
  threadSender: {
    color: "#1c2528",
    fontSize: 15,
    fontWeight: "700",
  },
  threadSenderSelected: {
    color: "#173b2c",
  },
  threadPreview: {
    color: "#566267",
    fontSize: 13,
    marginTop: 5,
  },
  threadPreviewSelected: {
    color: "#38535a",
  },
  threadTime: {
    color: "#7a8589",
    fontSize: 12,
    marginTop: 6,
  },
  threadTimeSelected: {
    color: "#4e6971",
  },
  messageDetail: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "#e0e6ea",
    gap: 10,
  },
  messageTitle: {
    color: "#1a2326",
    fontSize: 18,
    fontWeight: "700",
  },
  chatBubble: {
    backgroundColor: "#f0f2f4",
    borderRadius: 14,
    padding: 12,
  },
  chatText: {
    color: "#364347",
    fontSize: 14,
    lineHeight: 20,
  },
  composeBar: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: "#d7dfe4",
    borderRadius: 14,
    padding: 12,
    backgroundColor: "#fafbfc",
  },
  composeText: {
    color: "#889398",
    fontSize: 14,
  },
  photoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  photoTile: {
    width: "47%",
    minHeight: 110,
    borderRadius: 18,
    justifyContent: "flex-end",
    padding: 14,
  },
  photoLabel: {
    color: "#f8fbff",
    fontSize: 16,
    fontWeight: "700",
  },
  photoMeta: {
    color: "#eef5fb",
    fontSize: 12,
    marginTop: 6,
  },
  deviceGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  deviceCard: {
    width: "47%",
    backgroundColor: "#eef2f5",
    borderRadius: 16,
    padding: 14,
  },
  deviceLabel: {
    color: "#657277",
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  deviceValue: {
    color: "#1f2b2e",
    fontSize: 17,
    fontWeight: "700",
    marginTop: 6,
  },
  logItem: {
    color: "#4f5852",
    fontSize: 14,
    lineHeight: 20,
    backgroundColor: "#f1ece4",
    borderRadius: 16,
    padding: 12,
  },
  warningPanel: {
    backgroundColor: "#2c251b",
    borderRadius: 28,
    padding: 18,
  },
  warningTitle: {
    color: "#fff1df",
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 10,
  },
  warningText: {
    color: "#e7d6bf",
    fontSize: 15,
    lineHeight: 23,
  },
});
