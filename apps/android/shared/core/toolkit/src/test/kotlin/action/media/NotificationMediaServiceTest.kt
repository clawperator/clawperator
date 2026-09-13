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
        assertTrue(initial.isNull("reportedPositionMs"))
        assertTrue(initial.isNull("positionUpdatedElapsedMs"))
        shadowOf(controller).callbacks.single().onPlaybackStateChanged(playing(1000, 1))
        shadowOf(controller).setPlaybackState(playing(9000, 9000))
        repeat(2) {
            val status = query("get_media_status", id = initial.getString("mediaSessionId")).getJSONObject("session")
            assertEquals("player_report", status.getString("evidence"))
            assertEquals(1000L, status.getLong("reportedPositionMs"))
            assertEquals(1L, status.getLong("positionUpdatedElapsedMs"))
        }
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

}
