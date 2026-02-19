package clawperator.accessibilityservice

import action.coroutine.flow.mapDistinct
import android.accessibilityservice.AccessibilityService
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow

interface AccessibilityServiceManager {
    val isRunning: Flow<Boolean>
}

class AccessibilityServiceManagerAndroid : AccessibilityServiceManager {
    val currentAccessibilityServiceFlow: MutableStateFlow<AccessibilityService?> = MutableStateFlow(null)

    override val isRunning: Flow<Boolean>
        get() = mapDistinct(currentAccessibilityServiceFlow) { it != null }

    fun setCurrentAccessibilityService(
        service: AccessibilityService,
        set: Boolean,
    ) {
        if (set) {
            currentAccessibilityServiceFlow.value = service
        } else {
            if (currentAccessibilityServiceFlow.value == service) {
                currentAccessibilityServiceFlow.value = null
            }
        }
    }
}

val AccessibilityServiceManager.currentAccessibilityService: AccessibilityService?
    get() = (this as? AccessibilityServiceManagerAndroid)?.currentAccessibilityServiceFlow?.value
