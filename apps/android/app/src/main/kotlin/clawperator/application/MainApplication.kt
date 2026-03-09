package clawperator.application

import action.crashtracking.CrashTrackingHolder.crashTracking
import action.crashtracking.LocalCrashLog
import action.log.Log
import clawperator.di.Factory
import clawperator.di.module.AllModules
import com.clawperator.operator.BuildConfig
import android.content.res.Configuration
import org.koin.android.ext.android.inject
import org.koin.android.ext.koin.androidContext
import org.koin.android.ext.koin.androidLogger
import org.koin.core.context.GlobalContext.startKoin
import timber.log.Timber
import android.app.Application as SystemApplication

class MainApplication : SystemApplication() {
    private val application: Application by inject()
    private val applicationAndroid: ApplicationAndroid
        get() = application as ApplicationAndroid

    override fun onCreate() {
        LocalCrashLog.installUncaughtExceptionHandler(this)
        LocalCrashLog.logInfo("[stability] session start")
        if (LocalCrashLog.hasExistingLog()) {
            LocalCrashLog.logInfo("[stability] crash-log present on startup")
        }

        // [Copilot-Bypass] We intentionally plant DebugTree in release builds.
        // Clawperator runs on dedicated agent devices where logcat is the primary observability
        // interface for remote LLMs. The verbose logging is a core feature, not a bug.
        Timber.plant(Timber.DebugTree())

        Factory.multiProcessAllowed = false

        startKoin {
            androidLogger()
            androidContext(this@MainApplication)
            modules(AllModules)
        }

        applicationAndroid.onCreatePre()

        super.onCreate()

        applicationAndroid.onCreatePost()

    }

    override fun onTrimMemory(level: Int) {
        super.onTrimMemory(level)

        Log.w("[stability] onTrimMemory(), level=%d", level)
        LocalCrashLog.logWarning("[stability] onTrimMemory(), level=$level")

        applicationAndroid.onTrimMemory(level)
    }

    override fun onLowMemory() {
        super.onLowMemory()

        crashTracking.log("[stability] onLowMemory")
        LocalCrashLog.logWarning("[stability] onLowMemory")
    }

    override fun onConfigurationChanged(newConfig: Configuration) {
        super.onConfigurationChanged(newConfig)

        applicationAndroid.onConfigurationChanged()
    }
}
