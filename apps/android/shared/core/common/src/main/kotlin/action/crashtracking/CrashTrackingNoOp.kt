package action.crashtracking

import action.annotation.CheckResult
import action.log.Log

class CrashTrackingNoOp : CrashTracking {
    init {
        Log.d("%s, Initialising", this::class.simpleName)
    }

    @CheckResult override fun logFatalException(
        exception: Exception,
        message: String,
    ): Exception {
        Log.w(message)
        Log.e(exception, exception.message)
        return exception
    }

    override fun logNonFatalException(exception: Exception) {
        Log.w(exception, exception.message)
    }

    override fun log(
        message: String,
        logToConsole: Boolean,
    ) {
        Log.i(message)
    }
}
