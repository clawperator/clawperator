package action.process

/**
 * A wrapper for [android.os.Environment].
 */
interface Process {
    val processName: String

    val processNameSuffix: String?

    val isDefaultProcess: Boolean
    val isTestProcess: Boolean
}

fun Process.requireIsDefault(debugLabel: String?) {
    require(isDefaultProcess) {
        if (debugLabel != null) {
            "$debugLabel can only be created in default process (current=$processName)"
        } else {
            "Requires default process (current=$processName)"
        }
    }
}
