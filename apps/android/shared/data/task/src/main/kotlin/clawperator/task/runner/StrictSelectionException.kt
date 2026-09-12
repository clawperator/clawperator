package clawperator.task.runner

/** A fresh selection failed before the next target or gesture dispatch. */
class StrictSelectionException(
    val code: String,
    val candidateCount: Int,
    val candidates: String,
) : IllegalStateException("$code: strict selection is enabled (strict=true; CLI --strict); resolved $candidateCount candidates") {
    fun stepData(): Map<String, String> = mapOf(
        "error" to code,
        "strict" to "true",
        "message" to checkNotNull(message),
        "candidate_count" to candidateCount.toString(),
        "candidates" to candidates,
    )
}
