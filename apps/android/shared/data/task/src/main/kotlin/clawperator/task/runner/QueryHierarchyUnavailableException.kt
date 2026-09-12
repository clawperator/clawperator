package clawperator.task.runner

import clawperator.uitree.UiHierarchyDiagnostics
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json

class QueryHierarchyUnavailableException(
    val diagnostics: UiHierarchyDiagnostics,
) : IllegalStateException("UI hierarchy is unavailable from the accessibility service") {
    fun stepData(): Map<String, String> = mapOf(
        "errorCode" to "UI_TREE_UNAVAILABLE",
        "error" to message.orEmpty(),
        "diagnostics" to Json { encodeDefaults = true }.encodeToString(diagnostics),
    )
}
