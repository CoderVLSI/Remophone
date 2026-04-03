const expoStubCapabilities = {
  notifications: false,
  callState: false,
  callActions: false,
  smsSync: false,
  photoLibrary: false,
  accessibilityControl: false,
  screenCapture: false,
  backgroundHostService: false,
};

let monitorActive = false;

export function isNativeHostAvailable() {
  return false;
}

export function getHostNativeCapabilities() {
  return expoStubCapabilities;
}

export function startHostMonitoring(onEvent) {
  monitorActive = true;
  if (typeof onEvent === "function") {
    onEvent({
      type: "host-monitor",
      payload: {
        mode: "expo-stub",
        message:
          "Native host monitoring is not available in Expo Go. Replace this bridge with an Android module in a custom build.",
      },
    });
  }
}

export function stopHostMonitoring() {
  monitorActive = false;
}

export function getMonitorState() {
  return monitorActive;
}

export function getNativeHostModulesPlan() {
  return {
    notificationListener: "Needed for mirroring notifications from other apps. See native/android-host/.",
    telecomWatcher: "Needed for call state and limited call actions.",
    smsSync: "Needed for message thread sync and sending SMS from the remote phone.",
    mediaIndexer: "Needed for photo library summaries and later media previews.",
    foregroundRelayService: "Needed to keep the home phone online while charging on Wi-Fi.",
  };
}
