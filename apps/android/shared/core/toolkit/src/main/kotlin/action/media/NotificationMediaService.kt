package action.media

import action.notification.NotificationListenerService
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
    private data class Session(val id: String, val controller: MediaController, var destroyed: Boolean = false, var callback: MediaController.Callback? = null, var reportedState: PlaybackState? = null, var hasPlayerReport: Boolean = false)
    private val sessions = mutableMapOf<MediaSession.Token, Session>()
    private val destroyedTokens = mutableSetOf<MediaSession.Token>()
    private val sessionManager = context.getSystemService(Context.MEDIA_SESSION_SERVICE) as MediaSessionManager

    private fun requireListener(): NotificationListenerService {
        val component = ComponentName(context, NotificationListenerService::class.java)
        val allowed = Settings.Secure.getString(context.contentResolver, "enabled_notification_listeners")
            ?.split(':')?.mapNotNull(ComponentName::unflattenFromString)?.contains(component) == true
        if (!allowed) throw NotificationMediaException("NOTIFICATION_ACCESS_DENIED", "Enable notification access for the selected Operator.")
        return NotificationListenerService.connectedInstance
            ?: throw NotificationMediaException("NOTIFICATION_LISTENER_DISCONNECTED", "Notification listener is not connected; wait for Android to reconnect it.")
    }

    private fun activeSessions(): List<Session> {
        requireListener()
        val controllers = sessionManager.getActiveSessions(ComponentName(context, NotificationListenerService::class.java))
        val active = controllers.map { it.sessionToken }.toSet()
        sessions.keys.filter { it !in active }.forEach { token ->
            sessions.remove(token)?.let { removed ->
                removed.destroyed = true
                removed.callback?.let { removed.controller.unregisterCallback(it) }
            }
        }
        destroyedTokens.retainAll(active)
        return controllers.filter { it.sessionToken !in destroyedTokens }.map { controller ->
            sessions.getOrPut(controller.sessionToken) {
                val session = Session(UUID.randomUUID().toString(), controller)
                val callback = object : MediaController.Callback() {
                    override fun onPlaybackStateChanged(state: PlaybackState?) {
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
                session.callback = callback
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
            throw NotificationMediaException("MEDIA_SESSION_EXPIRED", "Selected session ended; a replacement session was not selected.", dispatched)
        }
    }

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
        val names = mapOf(0 to "none", 1 to "stopped", 2 to "paused", 3 to "playing", 4 to "fast_forwarding", 5 to "rewinding", 6 to "buffering", 7 to "error", 8 to "connecting", 9 to "skipping_to_previous", 10 to "skipping_to_next", 11 to "skipping_to_queue_item")
        val controls = JSONArray()
        val actions = state?.actions ?: 0L
        if (actions and PlaybackState.ACTION_PLAY != 0L) controls.put("play")
        if (actions and PlaybackState.ACTION_PAUSE != 0L) controls.put("pause")
        if (actions and PlaybackState.ACTION_SEEK_TO != 0L) controls.put("seek")
        val title = metadata?.getString(MediaMetadata.METADATA_KEY_TITLE)
        val artist = metadata?.getString(MediaMetadata.METADATA_KEY_ARTIST)
        return JSONObject().put("mediaSessionId", session.id).put("applicationId", controller.packageName)
            .put("state", state?.state?.let { names[it] } ?: "unknown")
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

    suspend fun execute(type: String, applicationId: String?, sessionId: String?, limit: Int, maxTextChars: Int, waitTimeoutMs: Long, onDispatch: () -> Unit = {}): String = withContext(Dispatchers.Main.immediate) {
        var dispatched = false
        try {
            val payload = JSONObject().put("schemaVersion", 1)
            when (type) {
                "list_notifications" -> {
                    val notifications = requireListener().activeNotifications
                        ?: throw NotificationMediaException("NOTIFICATION_QUERY_FAILED", "Android did not return a notification snapshot.")
                    val filtered = notifications.filter { applicationId == null || it.packageName == applicationId }.sortedBy { it.key }
                    val items = JSONArray()
                    filtered.take(limit).forEach { sbn ->
                        val notification = sbn.notification
                        val title = notification.extras.getCharSequence(Notification.EXTRA_TITLE)?.toString()
                        val text = notification.extras.getCharSequence(Notification.EXTRA_TEXT)?.toString()
                        val revision = requireListener().revisionFor(sbn.key)
                        val buttons = JSONArray()
                        notification.actions?.take(20)?.forEachIndexed { index, action ->
                            buttons.put(JSONObject().put("actionId", "$revision:$index")
                                .put("title", nullable(action.title?.toString()?.take(maxTextChars)))
                                .put("requiresInput", !action.remoteInputs.isNullOrEmpty())
                                .put("requiresAuthentication", if (Build.VERSION.SDK_INT >= 31) action.isAuthenticationRequired else false))
                        }
                        items.put(JSONObject().put("key", sbn.key).put("applicationId", sbn.packageName)
                            .put("title", nullable(title?.take(maxTextChars))).put("text", nullable(text?.take(maxTextChars)))
                            .put("postTime", sbn.postTime).put("ongoing", sbn.isOngoing).put("clearable", sbn.isClearable)
                            .put("groupKey", nullable(sbn.groupKey)).put("groupSummary", notification.flags and Notification.FLAG_GROUP_SUMMARY != 0)
                            .put("actions", buttons).put("actionsTruncated", (notification.actions?.size ?: 0) > 20)
                            .put("textTruncated", listOfNotNull(title, text).any { it.length > maxTextChars })
                            .put("progress", if (notification.extras.containsKey(Notification.EXTRA_PROGRESS)) JSONObject()
                                .put("value", notification.extras.getInt(Notification.EXTRA_PROGRESS))
                                .put("max", notification.extras.getInt(Notification.EXTRA_PROGRESS_MAX))
                                .put("indeterminate", notification.extras.getBoolean(Notification.EXTRA_PROGRESS_INDETERMINATE)) else JSONObject.NULL))
                    }
                    payload.put("notifications", items).put("truncated", filtered.size > limit).put("total", filtered.size)
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
                        do {
                            ensurePinned(session, true)
                            if (currentState(session)?.state == target || waitTimeoutMs == 0L) break
                            if (SystemClock.elapsedRealtime() >= deadline) throw NotificationMediaException("MEDIA_POSTCONDITION_TIMEOUT", "Control dispatched, but player did not report the requested state before timeout.", true)
                            delay(50)
                        } while (true)
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
        }
    }
}
