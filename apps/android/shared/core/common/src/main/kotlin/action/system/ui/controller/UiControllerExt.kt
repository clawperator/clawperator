package action.system.ui.controller

import android.app.Activity

val UiControllerManager.currentActivity: Activity?
    get() {
        val activityWrapper = currentUiController ?: return null
        require(activityWrapper is UiControllerAndroid)
        return activityWrapper.activity
    }

val UiController.activity: Activity
    get() {
        require(this is UiControllerAndroid)
        return activity
    }

val Activity.uiController: UiControllerAndroid
    get() = UiControllerAndroid(this)

@get:JvmName("uiControllerNullable")
val Activity?.uiController: UiControllerAndroid?
    get() = this?.let { UiControllerAndroid(it) }
