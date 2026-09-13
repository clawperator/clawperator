package action.media

import action.notification.NotificationListenerService
import android.app.PendingIntent
import android.app.Notification
import android.content.ComponentName
import android.content.Context
import android.media.MediaMetadata
import android.media.session.MediaController
import android.media.session.MediaSession
import android.media.session.MediaSessionManager
import android.media.session.PlaybackState
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.provider.Settings
import kotlinx.coroutines.delay
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.util.UUID

class NotificationMediaException(val code: String, message: String, val dispatched: Boolean = false) : Exception(message)

/** All handles and platform controller calls are owned by the main thread. */
class NotificationMediaService(private val context: Context) {
    private data class Session(
        val id: String,
        val controller: MediaController,
        var destroyed: Boolean = false,
        var reportedState: PlaybackState? = null,
        var hasPlayerReport: Boolean = false,
        var reportSequence: Long = 0,
    )
    private data class AdvertisedAction(val listener: NotificationListenerService, val key: String, val revision: String, val postTime: Long, val index: Int, val action: Notification.Action)
    private val advertisedActions = object : LinkedHashMap<String, AdvertisedAction>() {
        override fun removeEldestEntry(eldest: MutableMap.MutableEntry<String, AdvertisedAction>?): Boolean = size > 2000
    }
    private fun notifications(listener: NotificationListenerService): Array<android.service.notification.StatusBarNotification> {
        try {
            return listener.activeNotifications
                ?: throw NotificationMediaException("NOTIFICATION_QUERY_FAILED", "Android did not return a notification snapshot.")
        } catch (error: SecurityException) {
            throw error
        } catch (error: RuntimeException) {
            throw NotificationMediaException("NOTIFICATION_QUERY_FAILED", "Android could not query active notifications.")
        }
    }

    private val sessions = mutableMapOf<MediaSession.Token, Session>()
    private val destroyedTokens = mutableSetOf<MediaSession.Token>()
    private val sessionManager = context.getSystemService(Context.MEDIA_SESSION_SERVICE) as MediaSessionManager

    private fun requireListener(): NotificationListenerService {
        val component = ComponentName(context, NotificationListenerService::class.java)
        val allowed = if (Build.VERSION.SDK_INT >= 27) {
            (context.getSystemService(Context.NOTIFICATION_SERVICE) as android.app.NotificationManager)
                .isNotificationListenerAccessGranted(component)
        } else {
            Settings.Secure.getString(context.contentResolver, "enabled_notification_listeners")
                ?.split(':')?.mapNotNull(ComponentName::unflattenFromString)?.contains(component) == true
        }
        if (!allowed) throw NotificationMediaException("NOTIFICATION_ACCESS_DENIED", "Enable notification access for the selected Operator.")
        return NotificationListenerService.connectedInstance
            ?: throw NotificationMediaException("NOTIFICATION_LISTENER_DISCONNECTED", "Notification listener is not connected; wait for Android to reconnect it.")
    }

    private fun activeSessions(): List<Session> {
        requireListener()
        val controllers = sessionManager.getActiveSessions(ComponentName(context, NotificationListenerService::class.java))
        val active = controllers.map { it.sessionToken }.toSet()
        // Inactive sessions still exist. Keep their handle and original reports until
        // onSessionDestroyed, but only return/target tokens currently reported active.
        destroyedTokens.retainAll(active)
        return controllers.filter { it.sessionToken !in destroyedTokens }.map { controller ->
            sessions.getOrPut(controller.sessionToken) {
                val session = Session(UUID.randomUUID().toString(), controller)
                val callback = object : MediaController.Callback() {
                    override fun onPlaybackStateChanged(state: PlaybackState?) {
                        session.reportSequence++
                        session.reportedState = state
                        session.hasPlayerReport = true
                    }
                    override fun onSessionDestroyed() {
                        session.destroyed = true
                        destroyedTokens.add(controller.sessionToken)
                        sessions.remove(controller.sessionToken)
                        controller.unregisterCallback(this)
                    }
                }
                controller.registerCallback(callback, Handler(Looper.getMainLooper()))
                session
            }
        }
    }

    private fun select(applicationId: String?, sessionId: String?): Session {
        val matches = activeSessions().filter {
            if (sessionId != null) it.id == sessionId else it.controller.packageName == applicationId
        }
        if (matches.isEmpty()) throw NotificationMediaException("MEDIA_SESSION_EXPIRED", "No matching active session. Discover current handles with media list.")
        if (matches.size != 1) throw NotificationMediaException("MEDIA_SESSION_AMBIGUOUS", "Multiple sessions match; select mediaSessionId from media list: ${matches.joinToString { it.id }}")
        return matches.single()
    }

    private fun ensurePinned(session: Session, dispatched: Boolean = false) {
        if (session.destroyed || activeSessions().none { it === session }) {
            throw NotificationMediaException("MEDIA_SESSION_EXPIRED", "Selected session is no longer active; a replacement session was not selected.", dispatched)
        }
    }

    private fun requiresInput(action: Notification.Action): Boolean =
        !action.remoteInputs.isNullOrEmpty() || (Build.VERSION.SDK_INT >= 26 && !action.dataOnlyRemoteInputs.isNullOrEmpty())

    private fun requiresAuthentication(action: Notification.Action): Boolean =
        Build.VERSION.SDK_INT >= 31 && action.isAuthenticationRequired

    private fun nullable(value: Any?): Any = value ?: JSONObject.NULL

    private fun currentState(session: Session): PlaybackState? =
        if (session.hasPlayerReport) session.reportedState else session.controller.playbackState

    private fun status(session: Session, maxTextChars: Int): JSONObject {
        val controller = session.controller
        // Android may extrapolate getPlaybackState() and replace its update time.
        // Only callback state carries the original player position/update pair.
        val state = currentState(session)
        val metadata = controller.metadata
        val observed = SystemClock.elapsedRealtime()
        val duration = metadata?.takeIf { it.containsKey(MediaMetadata.METADATA_KEY_DURATION) }
            ?.getLong(MediaMetadata.METADATA_KEY_DURATION)?.takeIf { it >= 0 }
        val advancing = state?.state in setOf(PlaybackState.STATE_PLAYING, PlaybackState.STATE_FAST_FORWARDING, PlaybackState.STATE_REWINDING)
        val position = if (session.hasPlayerReport) {
            playbackPosition(state?.position, state?.lastPositionUpdateTime, observed, state?.playbackSpeed, advancing, duration)
        } else {
            PlaybackPosition(null, state?.position?.takeIf { it >= 0 }, null, null, "original_player_report_unavailable")
        }
        val stateName = when (state?.state) {
            PlaybackState.STATE_NONE -> "none"
            PlaybackState.STATE_STOPPED -> "stopped"
            PlaybackState.STATE_PAUSED -> "paused"
            PlaybackState.STATE_PLAYING -> "playing"
            PlaybackState.STATE_FAST_FORWARDING -> "fast_forwarding"
            PlaybackState.STATE_REWINDING -> "rewinding"
            PlaybackState.STATE_BUFFERING -> "buffering"
            PlaybackState.STATE_ERROR -> "error"
            PlaybackState.STATE_CONNECTING -> "connecting"
            PlaybackState.STATE_SKIPPING_TO_PREVIOUS -> "skipping_to_previous"
            PlaybackState.STATE_SKIPPING_TO_NEXT -> "skipping_to_next"
            PlaybackState.STATE_SKIPPING_TO_QUEUE_ITEM -> "skipping_to_queue_item"
            else -> "unknown"
        }
        val controls = JSONArray()
        val actions = state?.actions ?: 0L
        if (actions and PlaybackState.ACTION_PLAY != 0L) controls.put("play")
        if (actions and PlaybackState.ACTION_PAUSE != 0L) controls.put("pause")
        if (actions and PlaybackState.ACTION_SEEK_TO != 0L) controls.put("seek")
        val title = metadata?.getString(MediaMetadata.METADATA_KEY_TITLE)
        val artist = metadata?.getString(MediaMetadata.METADATA_KEY_ARTIST)
        return JSONObject().put("mediaSessionId", session.id).put("applicationId", controller.packageName)
            .put("state", stateName)
            .put("title", nullable(title?.take(maxTextChars))).put("artist", nullable(artist?.take(maxTextChars)))
            .put("textTruncated", listOfNotNull(title, artist).any { it.length > maxTextChars })
            .put("durationMs", nullable(duration)).put("supportedControls", controls)
            .put("reportedPositionMs", nullable(position.reportedPositionMs))
            .put("estimatedPositionMs", nullable(position.estimatedPositionMs))
            .put("positionUpdatedElapsedMs", nullable(position.positionUpdatedElapsedMs))
            .put("positionUpdateAgeMs", nullable(position.positionUpdateAgeMs))
            .put("positionUnknownReason", nullable(position.unknownReason))
            .put("observedElapsedMs", observed).put("clock", "android_elapsed_realtime")
            .put("playbackSpeed", nullable(state?.playbackSpeed?.takeIf { it.isFinite() }))
            .put("evidence", if (session.hasPlayerReport) "player_report" else "platform_query")
    }

    suspend fun execute(type: String, applicationId: String?, sessionId: String?, limit: Int, maxTextChars: Int, waitTimeoutMs: Long, onDispatch: () -> Unit = {}, notificationKey: String? = null, actionId: String? = null, positionMs: Long? = null, positionToleranceMs: Long = 1000): String = withContext(Dispatchers.Main.immediate) {
        var dispatched = false
        try {
            val payload = JSONObject().put("schemaVersion", 1)
            when (type) {
                "list_notifications" -> {
                    val listener = requireListener()
                    val notifications = notifications(listener)
                    val filtered = notifications.filter { applicationId == null || it.packageName == applicationId }.sortedBy { it.key }
                    val items = JSONArray()
                    filtered.take(limit).forEach { sbn ->
                        val notification = sbn.notification
                        val title = notification.extras.getCharSequence(Notification.EXTRA_TITLE)?.toString()
                        val text = notification.extras.getCharSequence(Notification.EXTRA_TEXT)?.toString()
                        val revision = listener.revisionFor(sbn.key)
                        val buttons = JSONArray()
                        var textTruncated = listOfNotNull(title, text).any { it.length > maxTextChars }
                        notification.actions?.take(20)?.forEachIndexed { index, action ->
                            val actionTitle = action.title?.toString()
                            if (actionTitle != null && actionTitle.length > maxTextChars) textTruncated = true
                            // Never reassign a published handle, even if a platform update precedes its listener callback.
                            val handle = UUID.randomUUID().toString()
                            advertisedActions[handle] = AdvertisedAction(listener, sbn.key, revision, sbn.postTime, index, action)
                            buttons.put(JSONObject().put("actionId", handle)
                                .put("title", nullable(actionTitle?.take(maxTextChars)))
                                .put("requiresInput", requiresInput(action))
                                .put("requiresAuthentication", requiresAuthentication(action)))
                        }
                        items.put(JSONObject().put("key", sbn.key).put("applicationId", sbn.packageName)
                            .put("title", nullable(title?.take(maxTextChars))).put("text", nullable(text?.take(maxTextChars)))
                            .put("postTime", sbn.postTime).put("ongoing", sbn.isOngoing).put("clearable", sbn.isClearable)
                            .put("groupKey", nullable(sbn.groupKey)).put("groupSummary", notification.flags and Notification.FLAG_GROUP_SUMMARY != 0)
                            .put("actions", buttons).put("actionsTruncated", (notification.actions?.size ?: 0) > 20)
                            .put("textTruncated", textTruncated)
                            .put("progress", if (notification.extras.containsKey(Notification.EXTRA_PROGRESS)) JSONObject()
                                .put("value", notification.extras.getInt(Notification.EXTRA_PROGRESS))
                                .put("max", notification.extras.getInt(Notification.EXTRA_PROGRESS_MAX))
                                .put("indeterminate", notification.extras.getBoolean(Notification.EXTRA_PROGRESS_INDETERMINATE)) else JSONObject.NULL))
                    }
                    payload.put("notifications", items).put("truncated", filtered.size > limit).put("total", filtered.size)
                }
                "dismiss_notification", "invoke_notification_action" -> {
                    val listener = requireListener()
                    val notification = notifications(listener).singleOrNull { it.key == notificationKey }
                        ?: throw NotificationMediaException("NOTIFICATION_EXPIRED", "Notification key is no longer active; list notifications again.")
                    payload.put("notificationKey", notificationKey)
                    if (type == "dismiss_notification") {
                        if (!notification.isClearable) throw NotificationMediaException("NOTIFICATION_NOT_DISMISSIBLE", "Notification is not clearable.")
                        dispatched = true
                        onDispatch()
                        listener.cancelNotification(notification.key)
                        val deadline = SystemClock.elapsedRealtime() + waitTimeoutMs
                        var removed: Boolean
                        do {
                            if (requireListener() !== listener) throw NotificationMediaException("NOTIFICATION_LISTENER_DISCONNECTED", "Listener changed after cancellation dispatch.", true)
                            removed = notifications(listener).none { it.key == notificationKey }
                            if (removed || SystemClock.elapsedRealtime() >= deadline) break
                            delay(50)
                        } while (true)
                        payload.put("dispatched", true).put("removalObserved", removed).put("waitTimeoutMs", waitTimeoutMs)
                    } else {
                        val advertised = advertisedActions[actionId]
                        val current = advertised?.let { notification.notification.actions?.getOrNull(it.index) }
                        if (advertised == null || advertised.listener !== listener || advertised.key != notificationKey ||
                            advertised.revision != listener.revisionFor(notification.key) || advertised.postTime != notification.postTime ||
                            current == null || current.actionIntent != advertised.action.actionIntent || current.title?.toString() != advertised.action.title?.toString()) {
                            throw NotificationMediaException("NOTIFICATION_ACTION_EXPIRED", "Action handle no longer matches the advertised notification revision; list notifications again.")
                        }
                        if (requiresInput(current) || requiresInput(advertised.action)) {
                            throw NotificationMediaException("NOTIFICATION_ACTION_INPUT_UNSUPPORTED", "RemoteInput actions are not supported.")
                        }
                        if (requiresAuthentication(current) || requiresAuthentication(advertised.action)) {
                            throw NotificationMediaException("NOTIFICATION_ACTION_AUTHENTICATION_UNSUPPORTED", "Authentication-required actions are not supported.")
                        }
                        val intent = advertised.action.actionIntent
                            ?: throw NotificationMediaException("NOTIFICATION_ACTION_EXPIRED", "Action has no PendingIntent.")
                        // Send the exact advertised intent once. Android may race after validation.
                        try {
                            intent.send()
                        } catch (error: PendingIntent.CanceledException) {
                            throw NotificationMediaException("NOTIFICATION_ACTION_CANCELLED", "The advertised PendingIntent was canceled; it was not dispatched.")
                        } catch (error: RuntimeException) {
                            dispatched = true
                            onDispatch()
                            throw error
                        }
                        dispatched = true
                        onDispatch()
                        payload.put("dispatched", true).put("actionId", actionId)
                    }
                }
                "list_media_sessions" -> {
                    val filtered = activeSessions().filter { applicationId == null || it.controller.packageName == applicationId }.sortedBy { it.id }
                    payload.put("sessions", JSONArray(filtered.take(limit).map { status(it, maxTextChars) }))
                        .put("truncated", filtered.size > limit).put("total", filtered.size)
                }
                else -> {
                    val session = select(applicationId, sessionId)
                    if (type == "get_media_status") {
                        ensurePinned(session)
                        payload.put("session", status(session, maxTextChars))
                    } else if (type == "media_seek") {
                        val position = positionMs ?: throw NotificationMediaException("MEDIA_POSITION_INVALID", "positionMs is required.")
                        if (position !in 0..9007199254740991L || positionToleranceMs !in 0..60000) {
                            throw NotificationMediaException("MEDIA_POSITION_INVALID", "Invalid position or tolerance.")
                        }
                        if ((currentState(session)?.actions ?: 0L) and PlaybackState.ACTION_SEEK_TO == 0L) {
                            throw NotificationMediaException("MEDIA_ACTION_UNSUPPORTED", "Player does not advertise seek.")
                        }
                        val metadata = session.controller.metadata
                        val duration = metadata?.takeIf { it.containsKey(MediaMetadata.METADATA_KEY_DURATION) }
                            ?.getLong(MediaMetadata.METADATA_KEY_DURATION)?.takeIf { it >= 0 }
                        if (duration != null && position > duration) throw NotificationMediaException("MEDIA_POSITION_OUT_OF_RANGE", "positionMs exceeds the known duration ($duration ms).")
                        ensurePinned(session)
                        val reportSequence = session.reportSequence
                        val dispatchedElapsedMs = SystemClock.elapsedRealtime()
                        dispatched = true
                        onDispatch()
                        session.controller.transportControls.seekTo(position)
                        val deadline = SystemClock.elapsedRealtime() + waitTimeoutMs
                        fun positionObserved(): Boolean {
                            val report = session.reportedState ?: return false
                            return session.reportSequence > reportSequence && report.lastPositionUpdateTime >= dispatchedElapsedMs && report.lastPositionUpdateTime <= SystemClock.elapsedRealtime() &&
                                report.position >= 0 && kotlin.math.abs(report.position - position) <= positionToleranceMs
                        }
                        while (true) {
                            ensurePinned(session, true)
                            if (positionObserved() || waitTimeoutMs == 0L) break
                            if (SystemClock.elapsedRealtime() >= deadline) throw NotificationMediaException("MEDIA_POSTCONDITION_TIMEOUT", "Seek dispatched, but no new player position report matched the requested tolerance before timeout.", true)
                            delay(50)
                        }
                        payload.put("dispatched", true).put("waitTimeoutMs", waitTimeoutMs)
                            .put("requestedPositionMs", position).put("positionToleranceMs", positionToleranceMs)
                            .put("targetPositionObserved", positionObserved()).put("session", status(session, maxTextChars))
                    } else {
                        val pause = type == "media_pause"
                        val action = if (pause) PlaybackState.ACTION_PAUSE else PlaybackState.ACTION_PLAY
                        if ((currentState(session)?.actions ?: 0L) and action == 0L) {
                            throw NotificationMediaException("MEDIA_ACTION_UNSUPPORTED", "Player does not advertise ${if (pause) "pause" else "play"}.")
                        }
                        ensurePinned(session)
                        dispatched = true
                        onDispatch()
                        if (pause) session.controller.transportControls.pause() else session.controller.transportControls.play()
                        val target = if (pause) PlaybackState.STATE_PAUSED else PlaybackState.STATE_PLAYING
                        val deadline = SystemClock.elapsedRealtime() + waitTimeoutMs
                        while (true) {
                            ensurePinned(session, true)
                            if (currentState(session)?.state == target || waitTimeoutMs == 0L) break
                            if (SystemClock.elapsedRealtime() >= deadline) throw NotificationMediaException("MEDIA_POSTCONDITION_TIMEOUT", "Control dispatched, but player did not report the requested state before timeout.", true)
                            delay(50)
                        }
                        payload.put("dispatched", true).put("waitTimeoutMs", waitTimeoutMs)
                            .put("targetStateObserved", currentState(session)?.state == target)
                            .put("session", status(session, maxTextChars))
                    }
                }
            }
            payload.put("observedElapsedMs", SystemClock.elapsedRealtime())
            payload.put("deviceState", JSONObject()
                .put("screenOn", (context.getSystemService(Context.POWER_SERVICE) as android.os.PowerManager).isInteractive)
                .put("deviceLocked", (context.getSystemService(Context.KEYGUARD_SERVICE) as android.app.KeyguardManager).isKeyguardLocked)
                .put("userUnlocked", if (Build.VERSION.SDK_INT >= 24) (context.getSystemService(Context.USER_SERVICE) as android.os.UserManager).isUserUnlocked else true))
            val items = payload.optJSONArray("notifications") ?: payload.optJSONArray("sessions")
            while (payload.toString().toByteArray(Charsets.UTF_8).size > 64000 && items != null && items.length() > 0) {
                items.remove(items.length() - 1)
                payload.put("truncated", true)
            }
            payload.toString()
        } catch (error: NotificationMediaException) {
            throw NotificationMediaException(error.code, error.message.orEmpty(), dispatched || error.dispatched)
        } catch (error: SecurityException) {
            throw NotificationMediaException("NOTIFICATION_ACCESS_DENIED", "Android denied notification/media access.", dispatched)
        } catch (error: kotlinx.coroutines.CancellationException) {
            throw error
        } catch (error: RuntimeException) {
            throw NotificationMediaException("NOTIFICATION_MEDIA_OPERATION_FAILED", "Android notification/media operation failed; consult dispatch evidence before taking another action.", dispatched)
        }
    }
}
