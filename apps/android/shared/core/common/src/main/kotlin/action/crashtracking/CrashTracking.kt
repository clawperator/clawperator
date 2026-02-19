package action.crashtracking

import action.annotation.CheckResult

interface CrashTracking {
    /**
     * Throws the given [exception]. Before doing so, logs [message].
     * Helpful for adding extra data to a known Exception to help identify
     * the cause/offending data.
     *
     * Note: correct usage is `throws logFatalException(ex, "foo")`
     */
    @CheckResult
    fun logFatalException(
        exception: Exception,
        message: String,
    ): Exception

    fun logNonFatalException(exception: Exception)

    fun log(
        message: String,
        logToConsole: Boolean = true,
    )
}
