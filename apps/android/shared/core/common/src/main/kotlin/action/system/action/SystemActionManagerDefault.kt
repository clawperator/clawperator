package action.system.action

import action.system.accessibility.SystemAccessibilityActionType
import action.system.accessibility.SystemAccessibilityServiceManager
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlin.coroutines.resume

open class SystemActionManagerDefault(
    private val systemAccessibilityServiceManager: SystemAccessibilityServiceManager,
) : SystemActionManager {
    private val activeFlows = mutableMapOf<SystemAccessibilityActionType, MutableList<(SystemActionState) -> Unit>>()

    fun startBackgroundRequest(systemAccessibilityActionType: SystemAccessibilityActionType) {
        systemAccessibilityServiceManager.requestAction(systemAccessibilityActionType)
    }

    fun setActionResult(
        type: SystemAccessibilityActionType,
        result: SystemActionState,
    ) {
        activeFlows[type]?.toList()?.forEach { callback ->
            callback(result)
        }
    }

    private fun handleSystemAction(type: SystemAccessibilityActionType): Flow<SystemActionState> =
        flow {
            emit(SystemActionState.Pending)

            val result =
                suspendCancellableCoroutine { continuation ->
                    val callbackRef =
                        object {
                            lateinit var callback: (SystemActionState) -> Unit
                        }

                    callbackRef.callback = { state ->
                        continuation.resume(state)
                        activeFlows[type]?.remove(callbackRef.callback)
                        if (activeFlows[type]?.isEmpty() == true) {
                            activeFlows.remove(type)
                        }
                    }

                    activeFlows.getOrPut(type) { mutableListOf() }.add(callbackRef.callback)

                    if (activeFlows[type]?.size == 1) {
                        startBackgroundRequest(type)
                    }

                    continuation.invokeOnCancellation {
                        activeFlows[type]?.remove(callbackRef.callback)
                        if (activeFlows[type]?.isEmpty() == true) {
                            activeFlows.remove(type)
                        }
                    }
                }
            emit(result)
        }

    override fun openNotificationPanel(): Flow<SystemActionState> = handleSystemAction(SystemAccessibilityActionType.OpenNotificationPanel)

    override fun openQuickSettings(): Flow<SystemActionState> = handleSystemAction(SystemAccessibilityActionType.OpenQuickSettingsPanel)

    override fun openRecentApps(): Flow<SystemActionState> = handleSystemAction(SystemAccessibilityActionType.OpenRecentApps)

    override fun lockScreen(): Flow<SystemActionState> = handleSystemAction(SystemAccessibilityActionType.LockScreen)
}
