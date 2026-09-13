package action.media

import action.notification.NotificationListenerService
import android.app.Notification
import android.content.ComponentName
import android.content.Context
import android.media.session.MediaController
import android.media.session.MediaSession
import android.media.session.MediaSessionManager
import android.media.session.PlaybackState
import android.provider.Settings
import androidx.test.core.app.ApplicationProvider
import kotlinx.coroutines.async
import kotlinx.coroutines.CoroutineStart
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.json.JSONObject
import org.junit.After
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.Robolectric
import org.robolectric.RobolectricTestRunner
import org.robolectric.Shadows.shadowOf
import org.robolectric.annotation.Config
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertTrue

@OptIn(ExperimentalCoroutinesApi::class)
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [21, 28])
class NotificationMediaServiceTest {
    private lateinit var context: Context
    private lateinit var listener: NotificationListenerService
    private lateinit var service: NotificationMediaService
    private val connected = NotificationListenerService::class.java.getDeclaredField("connectedInstance").apply { isAccessible = true }

    @Before fun setup() {
        Dispatchers.setMain(UnconfinedTestDispatcher())
        context = ApplicationProvider.getApplicationContext()
        listener = Robolectric.buildService(NotificationListenerService::class.java).get()
        connected.set(null, listener)
        Settings.Secure.putString(context.contentResolver, "enabled_notification_listeners", ComponentName(context, NotificationListenerService::class.java).flattenToString())
        if (android.os.Build.VERSION.SDK_INT >= 27) shadowOf(context.getSystemService(Context.NOTIFICATION_SERVICE) as android.app.NotificationManager)
            .setNotificationListenerAccessGranted(ComponentName(context, NotificationListenerService::class.java), true)
        service = NotificationMediaService(context)
    }
    @After fun cleanup() {
        connected.set(null, null)
        Dispatchers.resetMain()
    }
    private fun controller(tag: String): MediaController {
        val controller = MediaController(context, MediaSession(context, tag).sessionToken)
        shadowOf(controller).setPackageName("test.player")
        shadowOf(context.getSystemService(Context.MEDIA_SESSION_SERVICE) as MediaSessionManager).addController(controller)
        return controller
    }
    private suspend fun query(type: String, app: String? = null, id: String? = null, limit: Int = 25) =
        JSONObject(service.execute(type, app, id, limit, 256, 0))

    @Test fun snapshotsReflectPostingRemovalFiltersAndBounds() = runTest {
        assertEquals(0, query("list_notifications").getJSONArray("notifications").length())
        val notification = (if (android.os.Build.VERSION.SDK_INT >= 26) Notification.Builder(context, "fixture") else Notification.Builder(context)).setContentTitle("fixture").setOngoing(true).setGroup("group").setGroupSummary(true).build()
        val key = shadowOf(listener).addActiveNotification("test.player", 1, notification)
        shadowOf(listener).addActiveNotification("test.other", 2, notification)
        val filtered = query("list_notifications", app = "test.player")
        assertEquals(1, filtered.getInt("total"))
        val first = filtered.getJSONArray("notifications").getJSONObject(0)
        assertTrue(first.getBoolean("ongoing"))
        assertTrue(first.getBoolean("groupSummary"))
        assertTrue(query("list_notifications", limit = 1).getBoolean("truncated"))
        listener.cancelNotification(key)
        assertEquals(0, query("list_notifications", app = "test.player").getInt("total"))
    }
    @Test fun originalCallbackSurvivesFreshPlatformExtrapolation() = runTest {
        val controller = controller("one")
        fun playing(position: Long, updated: Long) = PlaybackState.Builder().setState(PlaybackState.STATE_PLAYING, position, 1f, updated).build()
        shadowOf(controller).setPlaybackState(playing(5000, 5000))
        val initial = query("list_media_sessions").getJSONArray("sessions").getJSONObject(0)
        assertEquals("platform_query", initial.getString("evidence"))
        assertEquals(0L, initial.getLong("playerReportSequence"))
        assertTrue(initial.isNull("playerReportReceivedElapsedMs"))
        assertTrue(initial.isNull("reportedPositionMs"))
        assertTrue(initial.isNull("positionUpdatedElapsedMs"))
        shadowOf(controller).callbacks.single().onPlaybackStateChanged(playing(1000, 1))
        shadowOf(controller).setPlaybackState(playing(9000, 9000))
        repeat(2) {
            val status = query("get_media_status", id = initial.getString("mediaSessionId")).getJSONObject("session")
            assertEquals(1L, status.getLong("playerReportSequence"))
            assertTrue(!status.isNull("playerReportReceivedElapsedMs"))
            assertEquals("player_report", status.getString("evidence"))
            assertEquals(1000L, status.getLong("reportedPositionMs"))
            assertEquals(1L, status.getLong("positionUpdatedElapsedMs"))
        }
    }
    @Test fun observationCountsCallbacksAndBoundsSamplesIncludingNullReports() = runTest {
        val controller = controller("observe")
        val id = query("list_media_sessions").getJSONArray("sessions").getJSONObject(0).getString("mediaSessionId")
        val observation = async(start = CoroutineStart.UNDISPATCHED) {
            JSONObject(service.execute("observe_media", null, id, 25, 256, 0, durationMs = 100))
        }
        val callback = shadowOf(controller).callbacks.single()
        repeat(70) { index ->
            callback.onPlaybackStateChanged(PlaybackState.Builder().setState(PlaybackState.STATE_PLAYING, index.toLong(), 1f, 1).setBufferedPosition(500).build())
        }
        callback.onPlaybackStateChanged(null)
        val result = observation.await()
        assertEquals(71, result.getInt("newPlayerReportCount"))
        assertEquals(64, result.getJSONArray("samples").length())
        assertTrue(result.getBoolean("truncated"))
        assertEquals(0, result.getJSONObject("initialSession").getInt("playerReportSequence"))
        assertEquals(71, result.getJSONObject("session").getInt("playerReportSequence"))
        assertTrue(result.getJSONObject("session").isNull("reportedPositionMs"))
        val quiet = JSONObject(service.execute("observe_media", null, id, 25, 256, 0, durationMs = 1))
        assertEquals(0, quiet.getInt("newPlayerReportCount"))
        assertEquals(0, quiet.getJSONArray("samples").length())
    }
    @Test fun observationCleansUpOnCancellationAndRejectsExpiredSession() = runTest {
        val controller = controller("observe-cancel")
        val id = query("list_media_sessions").getJSONArray("sessions").getJSONObject(0).getString("mediaSessionId")
        val canceled = async(start = CoroutineStart.UNDISPATCHED) {
            service.execute("observe_media", null, id, 25, 256, 0, durationMs = 30000)
        }
        canceled.cancel()
        canceled.join()
        val sessionsField = NotificationMediaService::class.java.getDeclaredField("sessions").apply { isAccessible = true }
        val session = (sessionsField.get(service) as Map<*, *>).values.single()!!
        val observersField = session.javaClass.getDeclaredField("observers").apply { isAccessible = true }
        assertTrue((observersField.get(session) as Set<*>).isEmpty())
        val expired = async(start = CoroutineStart.UNDISPATCHED) {
            assertFailsWith<NotificationMediaException> {
                service.execute("observe_media", null, id, 25, 256, 0, durationMs = 100)
            }.code
        }
        shadowOf(controller).callbacks.single().onSessionDestroyed()
        assertEquals("MEDIA_SESSION_EXPIRED", expired.await())
        assertTrue((observersField.get(session) as Set<*>).isEmpty())
    }
    @Test fun ambiguityExpiryAndUnsupportedControlsRemainDistinct() = runTest {
        val first = controller("one")
        val id = query("list_media_sessions").getJSONArray("sessions").getJSONObject(0).getString("mediaSessionId")
        controller("two")
        assertEquals("MEDIA_SESSION_AMBIGUOUS", assertFailsWith<NotificationMediaException> { query("get_media_status", app = "test.player") }.code)
        assertTrue(query("get_media_status", id = id).getJSONObject("session").isNull("title"))
        assertEquals("MEDIA_ACTION_UNSUPPORTED", assertFailsWith<NotificationMediaException> { query("media_pause", id = id) }.code)
        shadowOf(first).callbacks.toList().forEach { it.onSessionDestroyed() }
        assertEquals("MEDIA_SESSION_EXPIRED", assertFailsWith<NotificationMediaException> { query("get_media_status", id = id) }.code)
        assertEquals(1, query("list_media_sessions").getInt("total"))
    }
    @Test fun denialAndDisconnectionNeverBecomeEmptySuccess() = runTest {
        connected.set(null, null)
        assertEquals("NOTIFICATION_LISTENER_DISCONNECTED", assertFailsWith<NotificationMediaException> { query("list_notifications") }.code)
        if (android.os.Build.VERSION.SDK_INT >= 27) {
            shadowOf(context.getSystemService(Context.NOTIFICATION_SERVICE) as android.app.NotificationManager)
                .setNotificationListenerAccessGranted(ComponentName(context, NotificationListenerService::class.java), false)
        } else Settings.Secure.putString(context.contentResolver, "enabled_notification_listeners", "")
        assertEquals("NOTIFICATION_ACCESS_DENIED", assertFailsWith<NotificationMediaException> { query("list_media_sessions") }.code)
    }
    @Test fun resolvedSessionCannotBeReplacedBeforeDispatch() = runTest {
        val first = controller("original")
        val original = query("list_media_sessions").getJSONArray("sessions").getJSONObject(0).getString("mediaSessionId")
        // Resolve exactly as an application selector does, then simulate destruction
        // before the final dispatch guard. The replacement has the same package.
        val select = NotificationMediaService::class.java.getDeclaredMethod("select", String::class.java, String::class.java).apply { isAccessible = true }
        val pinned = select.invoke(service, "test.player", null)
        shadowOf(first).callbacks.toList().forEach { it.onSessionDestroyed() }
        controller("replacement")
        val replacement = query("list_media_sessions").getJSONArray("sessions").getJSONObject(0).getString("mediaSessionId")
        assertTrue(original != replacement)
        val guard = NotificationMediaService::class.java.declaredMethods.single { it.name == "ensurePinned" }.apply { isAccessible = true }
        for (dispatched in listOf(false, true)) {
            val error = assertFailsWith<java.lang.reflect.InvocationTargetException> { guard.invoke(service, pinned, dispatched) }.cause as NotificationMediaException
            assertEquals("MEDIA_SESSION_EXPIRED", error.code)
            assertEquals(dispatched, error.dispatched)
        }
    }

    @Test fun truncatedButtonTitleSetsNotificationTextFlag() = runTest {
        val notification = (if (android.os.Build.VERSION.SDK_INT >= 26) Notification.Builder(context, "fixture") else Notification.Builder(context))
            .setContentTitle("A").setContentText("B")
            .addAction(android.R.drawable.ic_media_play, "Long button label", null)
            .build()
        shadowOf(listener).addActiveNotification("test.player", 1, notification)
        val payload = JSONObject(service.execute("list_notifications", "test.player", null, 25, 1, 0))
        val item = payload.getJSONArray("notifications").getJSONObject(0)
        assertTrue(item.getBoolean("textTruncated"))
        assertEquals("L", item.getJSONArray("actions").getJSONObject(0).getString("title"))
        assertEquals(false, item.getBoolean("actionsTruncated"))
    }

    @Test fun concurrentRevisionReadsShareOneHandle() {
        val executor = java.util.concurrent.Executors.newFixedThreadPool(8)
        try {
            val ready = java.util.concurrent.CyclicBarrier(8)
            val results = (1..8).map {
                executor.submit<String> {
                    ready.await(5, java.util.concurrent.TimeUnit.SECONDS)
                    listener.revisionFor("same-notification")
                }
            }.map { it.get(5, java.util.concurrent.TimeUnit.SECONDS) }
            assertEquals(1, results.toSet().size)
        } finally {
            executor.shutdownNow()
        }
    }

    @Test fun temporaryInactivityPreservesHandleAndOriginalReport() = runTest {
        val controller = controller("temporarily-inactive")
        val id = query("list_media_sessions").getJSONArray("sessions").getJSONObject(0).getString("mediaSessionId")
        shadowOf(controller).callbacks.single().onPlaybackStateChanged(
            PlaybackState.Builder().setState(PlaybackState.STATE_PLAYING, 1200, 1f, 1).build(),
        )
        val manager = shadowOf(context.getSystemService(Context.MEDIA_SESSION_SERVICE) as MediaSessionManager)
        manager.clearControllers()
        assertEquals(0, query("list_media_sessions").getInt("total"))
        assertEquals("MEDIA_SESSION_EXPIRED", assertFailsWith<NotificationMediaException> { query("get_media_status", id = id) }.code)
        manager.addController(controller)
        val resumed = query("get_media_status", id = id).getJSONObject("session")
        assertEquals(id, resumed.getString("mediaSessionId"))
        assertEquals("player_report", resumed.getString("evidence"))
        assertEquals(1200L, resumed.getLong("reportedPositionMs"))
        assertEquals(1L, resumed.getLong("positionUpdatedElapsedMs"))
        assertEquals(1, shadowOf(controller).callbacks.size)
    }

    private fun postButton(input: Boolean = false): Pair<String, android.app.PendingIntent> {
        val intent = android.app.PendingIntent.getBroadcast(context, 1, android.content.Intent("fixture.button"), android.app.PendingIntent.FLAG_IMMUTABLE)
        val action = Notification.Action.Builder(android.R.drawable.ic_media_play, "Button", intent)
        if (input) action.addRemoteInput(android.app.RemoteInput.Builder("reply").build())
        val notification = (if (android.os.Build.VERSION.SDK_INT >= 26) Notification.Builder(context, "fixture") else Notification.Builder(context))
            .addAction(action.build()).build()
        return shadowOf(listener).addActiveNotification("test.player", 7, notification) to intent
    }
    private suspend fun buttonHandle() = query("list_notifications").getJSONArray("notifications").getJSONObject(0)
        .getJSONArray("actions").getJSONObject(0).getString("actionId")
    private suspend fun mutation(type: String, key: String, handle: String? = null) =
        JSONObject(service.execute(type, null, null, 25, 256, 0, notificationKey = key, actionId = handle))

    @Test fun dismissalChecksExistenceClearabilityAndObservedRemoval() = runTest {
        val (key, _) = postButton()
        val result = mutation("dismiss_notification", key)
        assertTrue(result.getBoolean("dispatched"))
        assertTrue(result.getBoolean("removalObserved"))
        assertEquals("NOTIFICATION_EXPIRED", assertFailsWith<NotificationMediaException> { mutation("dismiss_notification", key) }.code)
        val ongoing = Notification.Builder(context).setOngoing(true).build()
        val ongoingKey = shadowOf(listener).addActiveNotification("test.player", 8, ongoing)
        val error = assertFailsWith<NotificationMediaException> { mutation("dismiss_notification", ongoingKey) }
        assertEquals("NOTIFICATION_NOT_DISMISSIBLE", error.code)
        assertEquals(false, error.dispatched)
    }
    @Test fun buttonsRejectUnadvertisedRemovedCanceledAndInputActions() = runTest {
        val (key, intent) = postButton()
        assertEquals("NOTIFICATION_ACTION_EXPIRED", assertFailsWith<NotificationMediaException> { mutation("invoke_notification_action", key, "unknown:0") }.code)
        val handle = buttonHandle()
        assertTrue(mutation("invoke_notification_action", key, handle).getBoolean("dispatched"))
        intent.cancel()
        val canceled = assertFailsWith<NotificationMediaException> { mutation("invoke_notification_action", key, handle) }
        assertEquals("NOTIFICATION_ACTION_CANCELLED", canceled.code)
        assertEquals(false, canceled.dispatched)
        listener.cancelNotification(key)
        assertEquals("NOTIFICATION_EXPIRED", assertFailsWith<NotificationMediaException> { mutation("invoke_notification_action", key, handle) }.code)
        val (inputKey, _) = postButton(input = true)
        assertEquals("NOTIFICATION_ACTION_INPUT_UNSUPPORTED", assertFailsWith<NotificationMediaException> { mutation("invoke_notification_action", inputKey, buttonHandle()) }.code)
    }
    @Test fun handlesCannotSurviveListenerReplacementOrServiceRestart() = runTest {
        val (key, _) = postButton()
        val handle = buttonHandle()
        val replacement = Robolectric.buildService(NotificationListenerService::class.java).get()
        shadowOf(replacement).addActiveNotification("test.player", 7, Notification.Builder(context).build())
        connected.set(null, replacement)
        assertEquals("NOTIFICATION_ACTION_EXPIRED", assertFailsWith<NotificationMediaException> { mutation("invoke_notification_action", key, handle) }.code)
        connected.set(null, listener)
        service = NotificationMediaService(context)
        assertEquals("NOTIFICATION_ACTION_EXPIRED", assertFailsWith<NotificationMediaException> { mutation("invoke_notification_action", key, handle) }.code)
    }
    @Test fun seekValidatesCapabilitiesAndDurationWithoutTreatingOldPositionsAsConfirmation() = runTest {
        val controller = controller("seek")
        val id = query("list_media_sessions").getJSONArray("sessions").getJSONObject(0).getString("mediaSessionId")
        suspend fun seek(position: Long) = JSONObject(service.execute("media_seek", null, id, 25, 256, 0, positionMs = position))
        assertEquals("MEDIA_ACTION_UNSUPPORTED", assertFailsWith<NotificationMediaException> { seek(10) }.code)
        val state = PlaybackState.Builder().setActions(PlaybackState.ACTION_SEEK_TO).setState(PlaybackState.STATE_PAUSED, 1000, 0f, 1).build()
        shadowOf(controller).callbacks.single().onPlaybackStateChanged(state)
        val unknown = seek(1000)
        assertTrue(unknown.getBoolean("dispatched"))
        assertEquals(false, unknown.getBoolean("targetPositionObserved"))
        assertEquals(1000L, unknown.getJSONObject("session").getLong("reportedPositionMs"))
        for (duration in listOf(0L, 1000L)) {
            shadowOf(controller).setMetadata(android.media.MediaMetadata.Builder().putLong(android.media.MediaMetadata.METADATA_KEY_DURATION, duration).build())
            assertTrue(seek(duration).getBoolean("dispatched"))
            val error = assertFailsWith<NotificationMediaException> { seek(duration + 1) }
            assertEquals("MEDIA_POSITION_OUT_OF_RANGE", error.code)
            assertEquals(false, error.dispatched)
        }
        assertEquals("MEDIA_POSITION_INVALID", assertFailsWith<NotificationMediaException> { seek(-1) }.code)
    }

    @Test fun canceledSeekWaitRetainsDispatchReceiptAndOriginalReport() = runTest {
        val controller = controller("canceled-seek")
        val id = query("list_media_sessions").getJSONArray("sessions").getJSONObject(0).getString("mediaSessionId")
        shadowOf(controller).callbacks.single().onPlaybackStateChanged(
            PlaybackState.Builder().setActions(PlaybackState.ACTION_SEEK_TO).setState(PlaybackState.STATE_PLAYING, 1000, 1f, 1).build(),
        )
        var dispatchCount = 0
        assertFailsWith<kotlinx.coroutines.TimeoutCancellationException> {
            kotlinx.coroutines.withTimeout(100) {
                service.execute("media_seek", null, id, 25, 256, 30000, { dispatchCount++ }, positionMs = 10000, positionToleranceMs = 0)
            }
        }
        assertEquals(1, dispatchCount)
        val after = query("get_media_status", id = id).getJSONObject("session")
        assertEquals(1000L, after.getLong("reportedPositionMs"))
        assertEquals(1L, after.getLong("positionUpdatedElapsedMs"))
    }

    @Test fun listingNeverReassignsAnExistingAdvertisedHandle() = runTest {
        val (key, _) = postButton()
        val original = buttonHandle()
        val again = buttonHandle()
        assertTrue(original != again)
        assertTrue(mutation("invoke_notification_action", key, original).getBoolean("dispatched"))
        assertTrue(mutation("invoke_notification_action", key, again).getBoolean("dispatched"))
        // Simulate a new platform snapshot arriving before the listener revision callback.
        listener.cancelNotification(key)
        val replacement = android.app.PendingIntent.getBroadcast(context, 2, android.content.Intent("replacement.button"), android.app.PendingIntent.FLAG_IMMUTABLE)
        shadowOf(listener).addActiveNotification("test.player", 7, Notification.Builder(context).addAction(android.R.drawable.ic_media_play, "Button", replacement).build())
        val updated = buttonHandle()
        assertTrue(updated != original && updated != again)
        assertEquals("NOTIFICATION_ACTION_EXPIRED", assertFailsWith<NotificationMediaException> { mutation("invoke_notification_action", key, original) }.code)
        assertTrue(mutation("invoke_notification_action", key, updated).getBoolean("dispatched"))
    }

    @Test @Config(sdk = [28]) fun dataOnlyRemoteInputIsAdvertisedAndRejected() = runTest {
        val intent = android.app.PendingIntent.getBroadcast(context, 3, android.content.Intent("image.button"), android.app.PendingIntent.FLAG_IMMUTABLE)
        val action = Notification.Action.Builder(android.R.drawable.ic_media_play, "Image", intent)
            .addRemoteInput(android.app.RemoteInput.Builder("image").setAllowFreeFormInput(false).setAllowDataType("image/png", true).build()).build()
        val key = shadowOf(listener).addActiveNotification("test.player", 9, Notification.Builder(context, "fixture").addAction(action).build())
        val item = query("list_notifications").getJSONArray("notifications").getJSONObject(0).getJSONArray("actions").getJSONObject(0)
        assertTrue(item.getBoolean("requiresInput"))
        assertEquals("NOTIFICATION_ACTION_INPUT_UNSUPPORTED", assertFailsWith<NotificationMediaException> { mutation("invoke_notification_action", key, item.getString("actionId")) }.code)
    }

    @org.robolectric.annotation.Implements(android.service.notification.NotificationListenerService::class)
    class RefusingCancellationShadow : org.robolectric.shadows.ShadowService() {
        var notifications = emptyArray<android.service.notification.StatusBarNotification>()
        @org.robolectric.annotation.Implementation
        protected fun getActiveNotifications() = notifications
        @org.robolectric.annotation.Implementation
        protected fun cancelNotification(key: String) { /* A void platform call can leave the key active. */ }
    }

    @Test @Config(shadows = [RefusingCancellationShadow::class])
    fun refusedCancellationIsDispatchedButNeverConfirmedRemoved() = runTest {
        val notification = android.service.notification.StatusBarNotification("test.player", "test.player", 7, null, 0, 0, 0,
            Notification.Builder(context).build(), android.os.Process.myUserHandle(), 1)
        org.robolectric.shadow.api.Shadow.extract<RefusingCancellationShadow>(listener).notifications = arrayOf(notification)
        val key = notification.key
        val result = mutation("dismiss_notification", key)
        assertTrue(result.getBoolean("dispatched"))
        assertEquals(false, result.getBoolean("removalObserved"))
        assertEquals(1, query("list_notifications").getInt("total"))
    }

}
