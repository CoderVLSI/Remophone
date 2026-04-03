# Android Host Quick Start

This folder is a native scaffold for the `Home Phone` APK.

## Files

- `RemoNotificationListenerService.kt`
  - Android notification-listener service stub
  - captures posted notifications
  - builds a sanitized payload for relay transport

- `NotificationMirrorPayload.kt`
  - payload model for notification mirroring

- `NotificationRelayBridge.kt`
  - placeholder bridge where you connect the service to:
  - your foreground relay service
  - or a React Native native module / Expo module

## What to do next

1. Move these files into your Android app or Expo custom native module.
2. Register the notification listener service in Android manifest.
3. Ask the user to enable notification access in Android settings.
4. Replace `NotificationRelayBridge.publishNotification(...)` with a real relay send.
5. Forward the payload into the existing `notification` event shape used by the Expo dashboard.

## Expected event shape

The JavaScript side already expects:

```json
{
  "type": "notification",
  "payload": {
    "roomId": "HOME-2481",
    "appName": "WhatsApp",
    "title": "2 new messages",
    "body": "Family Group: Dinner is at 8 PM.",
    "receivedAt": "8:10:32 PM"
  }
}
```
