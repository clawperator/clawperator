package clawperator.operator.accessibilityservice

import action.coroutine.CoroutineScopes
import action.log.Log
import android.accessibilityservice.AccessibilityService
import android.accessibilityservice.AccessibilityServiceInfo
import android.view.accessibility.AccessibilityEvent
import clawperator.accessibilityservice.AccessibilityServiceManagerAndroid
import clawperator.routine.RoutineManager
import kotlinx.coroutines.Job
import kotlinx.coroutines.launch
import org.koin.android.ext.android.inject
import org.koin.core.component.KoinComponent

class OperatorAccessibilityService :
    AccessibilityService(),
    KoinComponent {
    private val accessibilityServiceManager: AccessibilityServiceManagerAndroid by inject()
    private val routineManager: RoutineManager by inject()
    private val coroutineScopes: CoroutineScopes by inject()
    private var routineLoopJob: Job? = null

    override fun onServiceConnected() {
        Log.d("[Operator-AccessibilityService] onServiceConnected()")

//         Configure enhanced accessibility service
        serviceInfo =
            serviceInfo?.apply {
                // Enhanced flags for better element discovery and interaction
                flags = flags or
                    AccessibilityServiceInfo.FLAG_REPORT_VIEW_IDS or
                    AccessibilityServiceInfo.FLAG_INCLUDE_NOT_IMPORTANT_VIEWS or
                    AccessibilityServiceInfo.FLAG_REQUEST_TOUCH_EXPLORATION_MODE or
                    AccessibilityServiceInfo.FLAG_REQUEST_FILTER_KEY_EVENTS

                // Set event types we want to monitor
                eventTypes = AccessibilityEvent.TYPE_WINDOW_CONTENT_CHANGED or
                    AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED or
                    AccessibilityEvent.TYPE_VIEW_CLICKED or
                    AccessibilityEvent.TYPE_VIEW_FOCUSED or
                    AccessibilityEvent.TYPE_VIEW_TEXT_CHANGED

                // Configure feedback and capabilities
                feedbackType = AccessibilityServiceInfo.FEEDBACK_ALL_MASK
                notificationTimeout = 100
            }

        Log.d("[Operator-AccessibilityService] Enhanced accessibility configured with flags: ${serviceInfo?.flags}")
        accessibilityServiceManager.setCurrentAccessibilityService(this, set = true)

        if (routineLoopJob == null) {
            routineLoopJob =
                coroutineScopes.io.launch {
                    try {
                        routineManager.runLoop()
                    } catch (t: Throwable) {
                        Log.e(t, "[Operator-AccessibilityService] RoutineManager loop terminated unexpectedly")
                    }
                }
            Log.d("[Operator-AccessibilityService] RoutineManager loop started")
        }
    }

    override fun onDestroy() {
        Log.d("[Operator-AccessibilityService] onDestroy()")
        accessibilityServiceManager.setCurrentAccessibilityService(this, set = false)

        routineManager.cancelCurrent()
        routineLoopJob?.cancel()
        routineLoopJob = null
        Log.d("[Operator-AccessibilityService] RoutineManager loop stopped")
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        Log.d("[Operator-AccessibilityService] onAccessibilityEvent($event)")
    }

    override fun onInterrupt() {
        Log.d("[Operator-AccessibilityService] onInterrupt()")
    }
}
