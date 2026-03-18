package clawperator.operator.recording

import action.buildconfig.BuildConfigMock
import android.accessibilityservice.AccessibilityService
import android.app.Application
import android.content.Context
import android.view.accessibility.AccessibilityEvent
import androidx.test.core.app.ApplicationProvider
import kotlinx.coroutines.test.runTest
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import clawperator.task.runner.RecordingCommandOutcome
import clawperator.task.runner.RecordingManager
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

@RunWith(RobolectricTestRunner::class)
@Config(manifest = Config.NONE, application = Application::class)
class RecordingEventFilterTest {
    private val context = ApplicationProvider.getApplicationContext<Context>()

    @Test
    fun `self events are filtered before enqueue`() = runTest {
        val manager = FakeRecordingManager(active = true)
        val filter =
            RecordingEventFilterDefault(
                recordingManager = manager,
                buildConfig = BuildConfigMock().apply { _debug = true },
            )
        val event =
            AccessibilityEvent.obtain(AccessibilityEvent.TYPE_VIEW_CLICKED).apply {
                packageName = "com.clawperator.operator.dev"
                className = "android.widget.Button"
            }

        filter.onAccessibilityEvent(TestAccessibilityService(context), event)

        assertEquals(0, manager.enqueuedEvents.size)
    }

    @Test
    fun `non self scroll event is enqueued with null snapshot`() = runTest {
        val manager = FakeRecordingManager(active = true)
        val filter =
            RecordingEventFilterDefault(
                recordingManager = manager,
                buildConfig = BuildConfigMock().apply { _debug = true },
            )
        val event =
            AccessibilityEvent.obtain(AccessibilityEvent.TYPE_VIEW_SCROLLED).apply {
                packageName = "com.android.settings"
                scrollX = 1
                scrollY = 2
                maxScrollX = 3
                maxScrollY = 4
            }

        filter.onAccessibilityEvent(TestAccessibilityService(context), event)

        assertEquals(1, manager.enqueuedEvents.size)
        val recorded = manager.enqueuedEvents.single() as RecordingScrollEvent
        assertEquals("com.android.settings", recorded.packageName)
        assertEquals(null, recorded.snapshot)
        assertEquals(0L, recorded.seq)
        assertTrue(manager.isRecordingActive())
    }

    private class FakeRecordingManager(
        private val active: Boolean,
    ) : RecordingManager, RecordingEventSink {
        val enqueuedEvents = mutableListOf<RecordingEvent>()
        private var nextSeq = 0L

        override suspend fun startRecording(sessionId: String?): RecordingCommandOutcome {
            error("unused in test")
        }

        override suspend fun stopRecording(sessionId: String?): RecordingCommandOutcome {
            error("unused in test")
        }

        override fun isRecordingActive(): Boolean = active

        override fun enqueueEvent(eventBuilder: (seq: Long) -> RecordingEvent): Boolean {
            enqueuedEvents += eventBuilder(nextSeq++)
            return true
        }
    }

    open class TestAccessibilityService(
        context: Context,
    ) : AccessibilityService() {
        private val baseContext = context

        override fun getSystemService(name: String): Any? = baseContext.getSystemService(name)

        override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        }

        override fun onInterrupt() {
        }
    }
}
