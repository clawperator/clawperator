package action.process

fun extractProcessSuffix(processName: String): String? {
    val separatorIndex = processName.indexOf(":")
    return if (separatorIndex > -1) {
        processName.substring(separatorIndex)
    } else {
        null
    }
}
