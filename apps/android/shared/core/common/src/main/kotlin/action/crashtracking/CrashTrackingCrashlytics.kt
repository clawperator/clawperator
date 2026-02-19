package action.crashtracking

import action.annotation.CheckResult
import action.log.Log
import com.google.firebase.crashlytics.FirebaseCrashlytics

class CrashTrackingCrashlytics : CrashTracking {
    private val crashlytics by lazy { FirebaseCrashlytics.getInstance() }

    init {
        Log.d("%s, Initialising", this::class.simpleName)
    }

    @CheckResult override fun logFatalException(
        exception: Exception,
        message: String,
    ): Exception {
        log(message, true)
        Log.e(exception, exception.localizedMessage)
        throw exception
    }

    override fun logNonFatalException(exception: Exception) {
        crashlytics.recordException(exception)
        Log.w(exception, exception.localizedMessage)
    }

    override fun log(
        message: String,
        logToConsole: Boolean,
    ) {
        crashlytics.log(message)
        if (logToConsole) {
            Log.i(message)
        }
    }
}
