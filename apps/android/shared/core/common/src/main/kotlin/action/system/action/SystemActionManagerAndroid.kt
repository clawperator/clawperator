package action.system.action

import action.system.accessibility.SystemAccessibilityServiceManager
import action.system.ui.controller.UiControllerManagerAndroid
import action.system.ui.controller.currentActivity
import android.app.Activity
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flowOf

class SystemActionManagerAndroid(
    private val uiControllerManagerAndroid: UiControllerManagerAndroid,
    private val systemAccessibilityServiceManager: SystemAccessibilityServiceManager,
) : SystemActionManagerDefault(systemAccessibilityServiceManager) {
    val activity: Activity?
        get() = uiControllerManagerAndroid.currentActivity

    override fun openNotificationPanel(): Flow<SystemActionState> {
        val activity = activity
        if (activity != null) {
            if (activity.showQuickSettings()) {
                return flowOf(SystemActionState.Result.Success)
            }
        }

        return super.openNotificationPanel()
    }

    override fun openQuickSettings(): Flow<SystemActionState> {
        val activity = activity
        if (activity != null) {
            if (activity.showQuickSettings()) {
                return flowOf(SystemActionState.Result.Success)
            }
        }

        return super.openQuickSettings()
    }

    override fun openRecentApps(): Flow<SystemActionState> {
        val activity = activity
        if (activity != null) {
            if (activity.showRecentApps()) {
                return flowOf(SystemActionState.Result.Success)
            }
        }

        return super.openRecentApps()
    }
}
