package action.apprestarter

import action.system.toast.ToastDisplayController
import action.system.ui.controller.UiControllerManager
import action.system.ui.controller.currentActivity
import android.content.Context
import com.jakewharton.processphoenix.ProcessPhoenix

class AppRestarterDefault(
    private val uiControllerManager: UiControllerManager,
    private val toastDisplayController: ToastDisplayController,
) : action.apprestarter.AppRestarter {
    private fun isRestartProcess(context: Context): Boolean = ProcessPhoenix.isPhoenixProcess(context)

    override fun restartApp() {
        val currentActivity = uiControllerManager.currentActivity ?: return
        toastDisplayController.showToast("Restarting app…")
        ProcessPhoenix.triggerRebirth(currentActivity)
    }
}
