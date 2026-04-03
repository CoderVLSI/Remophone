package com.remophone.host.notifications

object NotificationRelayBridge {
    private var roomId: String = "HOME-2481"

    fun configureRoom(id: String) {
        roomId = id
    }

    fun currentRoomId(): String = roomId

    fun onServiceReady() {
        // Wire this into your foreground relay service or Expo module event emitter.
    }

    fun publishNotification(payload: NotificationMirrorPayload) {
        // Replace this stub with:
        // 1. WebSocket relay send from the host foreground service, or
        // 2. Native module event bridge back into React Native.
    }

    fun publishRemoval(notificationKey: String) {
        // Optional: forward notification dismiss/remove events to the remote phone.
    }
}
