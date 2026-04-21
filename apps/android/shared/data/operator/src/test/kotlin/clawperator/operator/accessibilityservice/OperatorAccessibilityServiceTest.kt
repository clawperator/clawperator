package clawperator.operator.accessibilityservice

import action.buildconfig.BuildConfigMock
import action.coroutine.CoroutineScopes
import android.accessibilityservice.AccessibilityService
import android.accessibilityservice.AccessibilityServiceInfo
import android.app.Application
import android.view.KeyEvent
import android.view.accessibility.AccessibilityEvent
import clawperator.accessibilityservice.AccessibilityServiceManagerAndroid
import clawperator.operator.recording.RecordingEventFilter
import clawperator.routine.RoutineId
import clawperator.routine.RoutineManager
import clawperator.routine.RoutineRun
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlin.test.Test
import kotlin.test.assertFalse
import kotlin.test.assertSame
import kotlin.test.assertTrue
import org.junit.runner.RunWith
import org.koin.core.context.startKoin
import org.koin.core.context.stopKoin
import org.koin.dsl.module
import org.robolectric.Robolectric
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import org.robolectric.util.ReflectionHelpers

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

    @Test
    @Config(sdk = [33], manifest = Config.NONE, application = Application::class)
    fun `onCreateInputMethod returns custom accessibility ime on api33`() {
        withServiceKoin(debug = true) {
            val service = Robolectric.buildService(OperatorAccessibilityService::class.java).create().get()

            val inputMethod = service.onCreateInputMethod()

            assertTrue(inputMethod.javaClass.name.contains("OperatorAccessibilityInputMethod"))
        }
    }

    @Test
    @Config(sdk = [33], manifest = Config.NONE, application = Application::class)
    fun `onServiceConnected enables ime editor flag and registers current service`() {
        withServiceKoin(debug = true) { manager ->
            val service = Robolectric.buildService(OperatorAccessibilityService::class.java).create().get()
            service.serviceInfo = AccessibilityServiceInfo()

            ReflectionHelpers.callInstanceMethod<Unit>(service, "onServiceConnected")

            assertTrue((service.serviceInfo.flags and AccessibilityServiceInfo.FLAG_INPUT_METHOD_EDITOR) != 0)
            assertSame(service, manager.currentAccessibilityServiceFlow.value)

            service.onDestroy()
            assertSame(null, manager.currentAccessibilityServiceFlow.value)
        }
    }

    private fun withServiceKoin(
        debug: Boolean,
        block: (AccessibilityServiceManagerAndroid) -> Unit,
    ) {
        stopKoin()

        val manager = AccessibilityServiceManagerAndroid()
        val buildConfig = BuildConfigMock().apply { _debug = debug }
        val coroutineScopes =
            CoroutineScopes(
                main = CoroutineScope(SupervisorJob() + Dispatchers.Unconfined),
                io = CoroutineScope(SupervisorJob() + Dispatchers.Unconfined),
            )
        val routineManager = NoOpRoutineManager()
        val recordingEventFilter = NoOpRecordingEventFilter()

        try {
            startKoin {
                modules(
                    module {
                        single { manager }
                        single<action.buildconfig.BuildConfig> { buildConfig }
                        single { coroutineScopes }
                        single<RoutineManager> { routineManager }
                        single<RecordingEventFilter> { recordingEventFilter }
                    },
                )
            }
            block(manager)
        } finally {
            stopKoin()
        }
    }

    private class NoOpRoutineManager : RoutineManager {
        override val isRunning: Boolean = false

        override suspend fun runLoop() = Unit

        override fun start(build: () -> RoutineRun): RoutineId = RoutineId("test")

        override fun cancelCurrent(): Boolean = false
    }

    private class NoOpRecordingEventFilter : RecordingEventFilter {
        override fun onAccessibilityEvent(
            service: AccessibilityService,
            event: AccessibilityEvent?,
        ) = Unit

        override fun onKeyEvent(
            service: AccessibilityService,
            event: KeyEvent,
        ) = Unit
    }
}
