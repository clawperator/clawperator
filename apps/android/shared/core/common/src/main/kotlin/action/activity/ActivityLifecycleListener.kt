package action.activity

import android.app.Activity
import android.app.Application
import android.app.Application.ActivityLifecycleCallbacks
import android.os.Bundle

/**
 * Helper class to make use of [ActivityLifecycleCallbacks] cleaner.
 */
class ActivityLifecycleListener(
    application: Application,
    private val callbacks: Callbacks,
) : ActivityLifecycleCallbacks {
    init {
        application.registerActivityLifecycleCallbacks(this)
    }

    abstract class Callbacks {
        open fun onActivityPreCreated(
            activity: Activity,
            savedInstanceState: Bundle?,
        ) { }

        open fun onActivityCreated(
            activity: Activity,
            savedInstanceState: Bundle?,
        ) { }

        open fun onActivityPostCreated(
            activity: Activity,
            savedInstanceState: Bundle?,
        ) { }

        open fun onActivityPreStarted(activity: Activity) { }

        open fun onActivityStarted(activity: Activity) { }

        open fun onActivityPostStarted(activity: Activity) {}

        open fun onActivityPreResumed(activity: Activity) { }

        open fun onActivityResumed(activity: Activity) { }

        open fun onActivityPostResumed(activity: Activity) { }

        open fun onActivityPrePaused(activity: Activity) { }

        open fun onActivityPaused(activity: Activity) { }

        open fun onActivityPostPaused(activity: Activity) { }

        open fun onActivityPreStopped(activity: Activity) { }

        open fun onActivityStopped(activity: Activity) { }

        open fun onActivityPostStopped(activity: Activity) { }

        open fun onActivityPreSaveInstanceState(
            activity: Activity,
            outState: Bundle,
        ) { }

        open fun onActivitySaveInstanceState(
            activity: Activity,
            bundle: Bundle?,
        ) { }

        open fun onActivityPostSaveInstanceState(
            activity: Activity,
            outState: Bundle,
        ) { }

        open fun onActivityPreDestroyed(activity: Activity) { }

        open fun onActivityDestroyed(activity: Activity) { }

        open fun onActivityPostDestroyed(activity: Activity) { }
    }

    override fun onActivityPreCreated(
        activity: Activity,
        savedInstanceState: Bundle?,
    ) {
        callbacks.onActivityPreCreated(activity, savedInstanceState)
    }

    override fun onActivityCreated(
        activity: Activity,
        savedInstanceState: Bundle?,
    ) {
        callbacks.onActivityCreated(activity, savedInstanceState)
    }

    override fun onActivityPostCreated(
        activity: Activity,
        savedInstanceState: Bundle?,
    ) {
        callbacks.onActivityPostCreated(activity, savedInstanceState)
    }

    override fun onActivityPreStarted(activity: Activity) {
        callbacks.onActivityPreStarted(activity)
    }

    override fun onActivityStarted(activity: Activity) {
        callbacks.onActivityStarted(activity)
    }

    override fun onActivityPostStarted(activity: Activity) {
        callbacks.onActivityPostStarted(activity)
    }

    override fun onActivityPreResumed(activity: Activity) {
        callbacks.onActivityPreResumed(activity)
    }

    override fun onActivityResumed(activity: Activity) {
        callbacks.onActivityResumed(activity)
    }

    override fun onActivityPostResumed(activity: Activity) {
        callbacks.onActivityPostResumed(activity)
    }

    override fun onActivityPrePaused(activity: Activity) {
        callbacks.onActivityPrePaused(activity)
    }

    override fun onActivityPaused(activity: Activity) {
        callbacks.onActivityPaused(activity)
    }

    override fun onActivityPostPaused(activity: Activity) {
        callbacks.onActivityPostPaused(activity)
    }

    override fun onActivityPreStopped(activity: Activity) {
        callbacks.onActivityPreStopped(activity)
    }

    override fun onActivityStopped(activity: Activity) {
        callbacks.onActivityStopped(activity)
    }

    override fun onActivityPostStopped(activity: Activity) {
        callbacks.onActivityPostStopped(activity)
    }

    override fun onActivityPreSaveInstanceState(
        activity: Activity,
        outState: Bundle,
    ) {
        callbacks.onActivityPreSaveInstanceState(activity, outState)
    }

    override fun onActivitySaveInstanceState(
        activity: Activity,
        outState: Bundle,
    ) {
        callbacks.onActivitySaveInstanceState(activity, outState)
    }

    override fun onActivityPostSaveInstanceState(
        activity: Activity,
        outState: Bundle,
    ) {
        callbacks.onActivityPostSaveInstanceState(activity, outState)
    }

    override fun onActivityPreDestroyed(activity: Activity) {
        callbacks.onActivityPreDestroyed(activity)
    }

    override fun onActivityDestroyed(activity: Activity) {
        callbacks.onActivityDestroyed(activity)
    }

    override fun onActivityPostDestroyed(activity: Activity) {
        callbacks.onActivityPostDestroyed(activity)
    }
}
