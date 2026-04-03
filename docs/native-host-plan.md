# Native Host Plan

This document describes the Android-native path required if you want to leave the original phone at home, connected to Wi-Fi, and remotely receive meaningful notifications and call-state updates.

## What Expo Go can do today

- Pair two phones
- Connect both phones to the same relay server
- Mirror events that are already available to JavaScript
- Show notification and call feeds in the remote UI

## What Expo Go cannot do on its own

- Read system notifications in the background
- Monitor all phone-call state changes reliably
- Read and sync SMS/message threads
- Index and share photo-library summaries
- Answer or reject calls
- Start long-running Android foreground services
- Inject gestures into the device UI
- Capture the full screen for remote viewing

## Native Android pieces you need

1. Notification Listener Service
   - Required to read posted notifications from other apps
   - Needs user approval in Android settings
   - Should forward sanitized notification payloads to the relay

2. Telecom and call-state integration
   - Use `TelephonyManager` for state changes
   - Use `CallScreeningService` or related telecom APIs where supported
   - Answering or rejecting calls is device- and permission-dependent

3. Foreground host service
   - Keeps the home phone connected to the relay
   - Runs while the phone is charging and on Wi-Fi
   - Must display a persistent notification

4. Accessibility service
   - Needed for gesture injection and limited device navigation
   - Also requires explicit user approval

5. MediaProjection
   - Required for remote screen viewing
   - Must be started with user consent

6. SMS and message-thread sync
   - Read local SMS or app-owned messages where permitted
   - Mirror thread summaries to the remote phone
   - Sending or replying needs explicit Android permission and careful UX

7. Media and photo indexing
   - Use Android media APIs to list albums and recent items
   - Start with album summaries, then add thumbnails later

## Suggested production architecture

- Expo app:
  - shared UI
  - pairing flow
  - remote dashboard
  - account/auth screens

- Custom Android host module:
  - notification listener
  - call-state watcher
  - SMS/message sync
  - photo/media indexer
  - foreground connection service
  - optional accessibility and screen-capture support

- Relay/backend:
  - authenticated WebSocket or WebRTC signaling
  - trusted-device registry
  - encrypted event transport
  - offline event queue

## Realistic unattended-home-phone checklist

- Keep the phone plugged in
- Disable battery optimization for the app
- Keep Wi-Fi stable
- Grant notification listener permission
- Grant any required telecom permissions
- Grant SMS permissions if you want message sync
- Grant media/photo access if you want gallery sync
- If you want device control, also grant accessibility and screen capture
- Accept that some OEM Android builds will still kill or limit background behavior
