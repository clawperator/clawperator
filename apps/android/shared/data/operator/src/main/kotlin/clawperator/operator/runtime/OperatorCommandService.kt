package clawperator.operator.runtime

import action.crashtracking.LocalCrashLog
import action.log.Log
import android.app.ForegroundServiceStartNotAllowedException
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import clawperator.operator.runtime.OperatorCommandReceiver.Companion.ACTION_AGENT_COMMAND
import clawperator.operator.runtime.OperatorCommandReceiver.Companion.ACTION_LOG_UI
import clawperator.operator.runtime.OperatorCommandReceiver.Companion.ACTION_RUN_TASK

class OperatorCommandService : Service() {
    companion object {
        private const val NOTIFICATION_CHANNEL_ID = "operator_service_channel"
        private const val NOTIFICATION_ID = 1
    }

    private val commandReceiver = OperatorCommandReceiver()

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()

        // Register the debug broadcast receiver
        val filter =
            IntentFilter().apply {
                addAction(ACTION_RUN_TASK)
                addAction(ACTION_LOG_UI)
                addAction(ACTION_AGENT_COMMAND)
            }
        ContextCompat.registerReceiver(
            this,
            commandReceiver,
            filter,
            ContextCompat.RECEIVER_EXPORTED,
        )
        Log.d("[Operator-CommandService] Command receiver registered")
    }

    override fun onStartCommand(
        intent: Intent?,
        flags: Int,
        startId: Int,
    ): Int {
        val notification = createNotification()
        return try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC)
            } else {
                startForeground(NOTIFICATION_ID, notification)
            }
            // Detach from foreground immediately; keep the notification but avoid long-running FGS timeouts.
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                stopForeground(STOP_FOREGROUND_DETACH)
            } else {
                @Suppress("DEPRECATION")
                stopForeground(false)
            }
            stopSelf()
            START_NOT_STICKY
        } catch (e: ForegroundServiceStartNotAllowedException) {
            Log.e(e, "[Operator-CommandService] startForeground not allowed")
            LocalCrashLog.logWarning("[Operator-CommandService] startForeground not allowed", e)
            stopSelf()
            START_NOT_STICKY
        } catch (e: Exception) {
            Log.e(e, "[Operator-CommandService] startForeground failed")
            LocalCrashLog.logWarning("[Operator-CommandService] startForeground failed", e)
            stopSelf()
            START_NOT_STICKY
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        try {
            unregisterReceiver(commandReceiver)
            Log.d("[Operator-CommandService] Command receiver unregistered")
        } catch (e: Exception) {
            Log.e("[Operator-CommandService] Error unregistering receiver: ${e.message}")
        }
    }

    override fun onBind(intent: Intent?): IBinder? = null

    private fun createNotificationChannel() {
        val channel =
            NotificationChannel(
                NOTIFICATION_CHANNEL_ID,
                "[Clawperator] Operator",
                NotificationManager.IMPORTANCE_DEFAULT,
            ).apply {
                description = "Keeps the operator service running"
            }

        val notificationManager = getSystemService(NotificationManager::class.java)
        notificationManager.createNotificationChannel(channel)
    }

    private fun createNotification(): Notification {
        // Default action (Log UI) - triggered when tapping the notification
        val logUiIntent =
            Intent(this, OperatorCommandReceiver::class.java).apply {
                action = ACTION_LOG_UI
            }

        val logUiPendingIntent =
            PendingIntent.getBroadcast(
                this,
                0,
                logUiIntent,
                PendingIntent.FLAG_IMMUTABLE,
            )

        // Run Task action button
        val runTaskIntent =
            Intent(this, OperatorCommandReceiver::class.java).apply {
                action = ACTION_RUN_TASK
            }

        val runTaskPendingIntent =
            PendingIntent.getBroadcast(
                this,
                1,
                runTaskIntent,
                PendingIntent.FLAG_IMMUTABLE,
            )

        return NotificationCompat
            .Builder(this, NOTIFICATION_CHANNEL_ID)
            .setContentTitle("[Clawperator] Operator Service")
            .setContentText("Tap to log UI elements")
            .setSmallIcon(clawperator.resources.R.drawable.ic_notification)
            .setContentIntent(logUiPendingIntent) // Default action is Log UI
            .addAction(
                clawperator.resources.R.drawable.ic_notification,
                "Run Task",
                runTaskPendingIntent,
            ).addAction(
                clawperator.resources.R.drawable.ic_notification,
                "Log UI",
                logUiPendingIntent,
            ).build()
    }
}
