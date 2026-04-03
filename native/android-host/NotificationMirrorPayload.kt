package com.remophone.host.notifications

data class NotificationMirrorPayload(
    val roomId: String,
    val appName: String,
    val title: String,
    val body: String,
    val receivedAt: String,
    val packageName: String,
    val notificationKey: String,
)
