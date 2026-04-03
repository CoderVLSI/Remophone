# RemoPhone

RemoPhone is now an Expo React Native starter with a WebSocket relay flow, mirrored-notification and call-event support, and a native-host plan for the phone you leave at home.

## What is included

- A single Expo screen for choosing `Home Phone` or `Remote Phone`
- Relay URL and pairing-code setup fields
- Live room join and presence updates over WebSocket
- Remote quick-action buttons that send real command messages
- Mirrored notification and call-event feeds in the remote UI
- Mirrored message-thread and photo-library sections in the dashboard
- Host-side simulator buttons so you can test the transport inside Expo Go
- A tiny Node relay server you can run on your own machine or server
- A native Android host plan in `docs/native-host-plan.md`

## What Expo Go is good for

Expo Go is a good fit for:

- Building the UI fast
- Testing the pairing flow on two phones
- Connecting both phones to the same backend
- Managing session state, auth, and remote command messages
- Testing live pairing and control-message transport
- Designing the remote dashboard for notifications and calls

## Important limitation

Expo Go cannot by itself provide true full-device remote control on Android.

Features that normally require native Android code or a custom Expo development build:

- Live screen capture of the host phone
- Background services that must stay alive for long periods
- Accessibility-based gesture injection
- Notification Listener access for other apps' notifications
- Telecom integration for reliable call state and actions
- SMS permissions and native sync for messages
- Media permissions and indexing for photo library sync
- Unattended device control

So the practical path is:

1. Build the product flow in Expo first.
2. Add a real backend using WebSocket or WebRTC signaling.
3. When you are ready for real screen sharing and control, move to a custom Expo dev build or native module.

## Run it

1. Install dependencies:

```bash
npm install
```

2. Start the relay server:

```bash
npm run relay
```

3. Start Expo:

```bash
npm start
```

4. Set the app's relay URL to your computer or server IP, for example `ws://192.168.1.10:8080`.

5. Scan the QR code in Expo Go on both Android phones.

6. Enter the same pairing code on both phones and connect.
7. On the host phone, use `Simulate Notification` and `Simulate Call` to test end-to-end mirroring in Expo Go.

## Relay protocol

The app and relay exchange JSON messages like these:

```json
{
  "type": "join",
  "payload": {
    "roomId": "HOME-2481",
    "role": "host",
    "deviceId": "device-ab12cd34",
    "keepAwake": true
  }
}
```

```json
{
  "type": "command",
  "payload": {
    "roomId": "HOME-2481",
    "fromRole": "remote",
    "command": "Home"
  }
}
```

```json
{
  "type": "status",
  "payload": {
    "roomId": "HOME-2481",
    "fromRole": "host",
    "text": "Home phone is online on Wi-Fi."
  }
}
```

```json
{
  "type": "notification",
  "payload": {
    "roomId": "HOME-2481",
    "id": "171201234-notification",
    "appName": "WhatsApp",
    "title": "2 new messages",
    "body": "Family Group: Dinner is at 8 PM.",
    "receivedAt": "8:10:32 PM"
  }
}
```

```json
{
  "type": "call",
  "payload": {
    "roomId": "HOME-2481",
    "id": "171201235-call",
    "state": "ringing",
    "contact": "Dad",
    "direction": "incoming",
    "receivedAt": "8:10:36 PM"
  }
}
```

```json
{
  "type": "message_thread",
  "payload": {
    "roomId": "HOME-2481",
    "id": "thread-42",
    "sender": "Mom",
    "preview": "Bring milk on the way back.",
    "time": "8:40:12 PM",
    "messages": ["Bring milk on the way back.", "Also check if bread is there."]
  }
}
```

```json
{
  "type": "photo_library",
  "payload": {
    "roomId": "HOME-2481",
    "albums": [
      { "id": "camera-live", "label": "Camera", "accent": "#8b5e3c", "count": 186 }
    ]
  }
}
```

## Suggested next build steps

- Add login and device pairing
- Store a home-phone device record in your backend
- Persist session history and trusted devices
- Forward host camera or screen media with WebRTC later
- Use WebRTC for low-latency video once you move beyond Expo Go
- Replace `src/native/hostBridge.js` with a real Android native module
- Build the host-only Android permissions flow for notifications, calls, and accessibility
- Add real SMS thread sync from the host APK
- Add real photo album sync from the host APK
