package clawperator.uitree

import action.log.Log
import android.accessibilityservice.AccessibilityService
import clawperator.accessibilityservice.AccessibilityServiceManager
import clawperator.accessibilityservice.buildUiTree
import clawperator.accessibilityservice.currentAccessibilityService
import clawperator.accessibilityservice.toUiAutomatorHierarchyDump

class UiTreeInspectorAndroid(
    private val accessibilityServiceManager: AccessibilityServiceManager,
) : UiTreeInspector {
    override suspend fun getCurrentUiElements(): List<UiTreeElement> {
        // Use the new hierarchical approach and flatten for backwards compatibility
        return getCurrentUiTree()?.flatten() ?: emptyList()
    }

    override suspend fun getCurrentUiTree(): UiTree? {
        val service = accessibilityServiceManager.currentAccessibilityService
        if (service == null) {
            Log.d("[Operator-UxInspector] Accessibility service is not available")
            return null
        }
        val rootNode = service.rootInActiveWindow
        if (rootNode == null) {
            Log.d("[Operator-UxInspector] Root node is null")
            return null
        }

        // Get screen dimensions for offscreen detection (if available)
        val (screenWidth, screenHeight) = getScreenDimensions(service)

        return rootNode
            .buildUiTree(
                windowId = rootNode.windowId,
                screenWidth = screenWidth,
                screenHeight = screenHeight,
                includeContentHash = false, // Can be enabled for debugging stability issues
            ).also { tree ->
                // Enhanced logging with role information
//            logTreeSummary(tree)
            }
    }

    override suspend fun getCurrentUiHierarchyDump(): String? {
        val service = accessibilityServiceManager.currentAccessibilityService
        if (service == null) {
            Log.d("[Operator-UxInspector] Accessibility service is not available")
            return null
        }
        val rootNode = service.rootInActiveWindow
        if (rootNode == null) {
            Log.d("[Operator-UxInspector] Root node is null")
            return null
        }
        val rotation = getDisplayRotation(service)

        return try {
            rootNode.toUiAutomatorHierarchyDump(rotation = rotation)
        } finally {
            rootNode.recycle()
        }
    }

    private fun getDisplayRotation(service: AccessibilityService): Int =
        try {
            service.display?.rotation ?: 0
        } catch (e: Exception) {
            0
        }

    private fun getScreenDimensions(service: AccessibilityService): Pair<Int, Int> =
        try {
            // For now, return 0,0 as screen dimensions are not easily accessible
            // from AccessibilityService. This can be enhanced later if needed.
            Pair(0, 0)
        } catch (e: Exception) {
            // Fallback to 0,0 if screen dimensions can't be determined
            Pair(0, 0)
        }

    private fun logTreeSummary(tree: UiTree) {
        val allNodes = collectAllNodes(tree.root)
        Log.d("[Operator-UxInspector] Found ${allNodes.size} UI nodes in tree")

        // Count nodes by role for summary
        val roleCounts = allNodes.groupBy { it.role }.mapValues { it.value.size }
        Log.d("[Operator-UxInspector] Role summary: ${roleCounts.entries.joinToString { "${it.key.name.lowercase()}=${it.value}" }}")

        // Log individual nodes with enhanced information
        allNodes.forEachIndexed { index, node ->
            val resourceInfo = node.resourceId?.let { " [$it]" } ?: ""
            val hintsInfo =
                if (node.hints.isNotEmpty()) {
                    " hints=${node.hints.entries.joinToString { "${it.key}=${it.value}" }}"
                } else {
                    ""
                }
            val displayText =
                when {
                    node.label.isNotBlank() -> node.label
                    node.isClickable -> "<icon/button>"
                    else -> "<${node.className.substringAfterLast('.')}>"
                }
            val boundsInfo = " @(${node.bounds.left.toInt()},${node.bounds.top.toInt()})"
            Log.d("[Operator] ${index + 1}. ${node.role.name.lowercase()}: \"$displayText\" (clickable: ${node.isClickable})${resourceInfo}${hintsInfo}$boundsInfo")
        }
    }

    private fun collectAllNodes(root: UiNode): List<UiNode> {
        val nodes = mutableListOf<UiNode>()

        fun traverse(node: UiNode) {
            nodes.add(node)
            node.children.forEach { traverse(it) }
        }
        traverse(root)
        return nodes
    }
}
