package com.remophone.host.notifications

import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

class RemoNotificationListenerService : NotificationListenerService() {

    override fun onListenerConnected() {
        super.onListenerConnected()
        NotificationRelayBridge.onServiceReady()
    }

    override fun onNotificationPosted(sbn: StatusBarNotification) {
        val extras = sbn.notification.extras
        val title = extras.getCharSequence("android.title")?.toString().orEmpty()
        val body = extras.getCharSequence("android.text")?.toString().orEmpty()

        val payload = NotificationMirrorPayload(
            roomId = NotificationRelayBridge.currentRoomId(),
            appName = resolveAppName(sbn),
            title = title.ifBlank { "New notification" },
            body = body.ifBlank { "Open the host phone for full details." },
            receivedAt = timeStamp(),
            packageName = sbn.packageName,
            notificationKey = sbn.key,
        )

        NotificationRelayBridge.publishNotification(payload)
    }

    override fun onNotificationRemoved(sbn: StatusBarNotification) {
        NotificationRelayBridge.publishRemoval(sbn.key)
    }

    private fun resolveAppName(sbn: StatusBarNotification): String {
        val manager = packageManager
        val appInfo = manager.getApplicationInfo(sbn.packageName, 0)
        return manager.getApplicationLabel(appInfo).toString()
    }

    private fun timeStamp(): String {
        return SimpleDateFormat("h:mm:ss a", Locale.getDefault()).format(Date())
    }
}
