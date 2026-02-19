package action.system.ui.controller

import action.util.WeakReference

class UiControllerManagerAndroid : UiControllerManager {
    private var currentActivity: WeakReference<UiControllerAndroid>? = null
    override val currentUiController: UiControllerAndroid?
        get() = currentActivity?.get()

    enum class LifecycleState {
        Created,
        Started,

//        Resumed,
//        Paused,
        Stopped,
        Destroyed,
    }

    private fun register(
        uiControllerAndroid: UiControllerAndroid,
        lifecycleState: LifecycleState,
    ) {
        if (lifecycleState == LifecycleState.Created ||
            lifecycleState == LifecycleState.Started
        ) {
            if (currentUiController?.activity != uiControllerAndroid.activity) {
                currentActivity = WeakReference(uiControllerAndroid)
            }
        } else if (lifecycleState == LifecycleState.Destroyed) {
            if (currentUiController?.activity == uiControllerAndroid.activity) {
                currentActivity = null
            }
        }
    }

    fun onCreate(activity: UiControllerAndroid) {
        register(activity, LifecycleState.Created)
    }

    fun onDestroy(activity: UiControllerAndroid) {
        register(activity, LifecycleState.Destroyed)
    }

    fun onStop(activity: UiControllerAndroid) {
        register(activity, LifecycleState.Stopped)
    }

    fun onStart(activity: UiControllerAndroid) {
        register(activity, LifecycleState.Started)
    }
}
