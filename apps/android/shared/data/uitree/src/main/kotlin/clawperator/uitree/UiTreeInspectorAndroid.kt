package clawperator.uitree

import action.log.Log
import android.accessibilityservice.AccessibilityService
import android.content.Context
import android.os.Build
import android.util.DisplayMetrics
import android.view.WindowManager
import android.view.accessibility.AccessibilityWindowInfo
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

    override suspend fun getCurrentWindowMetadata(): UiWindowMetadata? {
        val service = accessibilityServiceManager.currentAccessibilityService ?: return null
        val activeRoot = service.rootInActiveWindow ?: return null
        val foregroundPackage = activeRoot.packageName?.toString()?.takeIf { it.isNotBlank() }
        val windows =
            try {
                service.windows ?: emptyList()
            } catch (e: Exception) {
                emptyList()
            }

        var overlayPackage: String? = null
        for (window in windows) {
            val root = try {
                window.root
            } catch (e: Exception) {
                null
            }
            val packageName = root?.packageName?.toString()?.takeIf { it.isNotBlank() }
            val benignSystemUi =
                window.type == AccessibilityWindowInfo.TYPE_SYSTEM &&
                    packageName == "com.android.systemui" &&
                    !window.isActive
            if (benignSystemUi) {
                continue
            }
            val packageDiffers = foregroundPackage != null && packageName != null && packageName != foregroundPackage
            val nonAppWindow = window.type != AccessibilityWindowInfo.TYPE_APPLICATION

            if (overlayPackage == null && (packageDiffers || nonAppWindow)) {
                overlayPackage = packageName ?: foregroundPackage
            }
        }

        return UiWindowMetadata(
            foregroundPackage = foregroundPackage,
            hasOverlay = overlayPackage != null,
            overlayPackage = overlayPackage,
            windowCount = windows.size,
        )
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
        getScreenDimensionsFromService(service)

    companion object {
        /**
         * Returns the screen dimensions from an AccessibilityService.
         * Falls back to (0, 0) if dimensions cannot be determined.
         *
         * For API 30+: Uses WindowMetrics.currentWindowMetrics.bounds
         * For pre-API 30: Uses DisplayMetrics with defaultDisplay.getRealMetrics()
         */
        fun getScreenDimensionsFromService(service: AccessibilityService): Pair<Int, Int> =
            try {
                val windowManager = service.getSystemService(Context.WINDOW_SERVICE) as? WindowManager
                if (windowManager == null) {
                    Log.d("[Operator-UxInspector] WindowManager not available")
                    Pair(0, 0)
                } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                    // API 30+: Use WindowMetrics
                    val windowMetrics = windowManager.currentWindowMetrics
                    val bounds = windowMetrics.bounds
                    Pair(bounds.width(), bounds.height())
                } else {
                    // Pre-API 30: Use DisplayMetrics with defaultDisplay
                    @Suppress("DEPRECATION")
                    val display = windowManager.defaultDisplay
                    val metrics = DisplayMetrics()
                    @Suppress("DEPRECATION")
                    display.getRealMetrics(metrics)
                    Pair(metrics.widthPixels, metrics.heightPixels)
                }
            } catch (e: Exception) {
                Log.d("[Operator-UxInspector] Failed to get screen dimensions: ${e.message}")
                // Fallback to 0,0 if screen dimensions can't be determined
                Pair(0, 0)
            }
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
