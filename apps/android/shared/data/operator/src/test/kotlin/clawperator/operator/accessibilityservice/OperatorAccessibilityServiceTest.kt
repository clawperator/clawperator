package clawperator.operator.accessibilityservice

import android.app.Application
import kotlin.test.Test
import kotlin.test.assertFalse
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(manifest = Config.NONE, application = Application::class)
class OperatorAccessibilityServiceTest {
    @Test
    fun `throwing diagnostic hook is swallowed by wrapper`() {
        runRecordingDiagnosticHook(
            hook = RecordingDiagnosticHook(),
            hookLabel = "for test",
        ) {
            throw IllegalStateException("boom")
        }
    }

    @Test
    fun `null diagnostic hook is a no-op`() {
        var invoked = false

        runRecordingDiagnosticHook(
            hook = null,
            hookLabel = "for test",
        ) {
            invoked = true
        }

        assertFalse(invoked)
    }
}
