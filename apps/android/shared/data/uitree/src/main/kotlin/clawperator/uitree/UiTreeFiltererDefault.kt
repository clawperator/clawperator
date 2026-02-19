package clawperator.uitree

import action.math.geometry.Rect
import action.system.window.WindowFrame
import action.system.window.WindowFrameManager
import kotlin.math.max
import kotlin.math.min

class UiTreeFiltererDefault(
    private val windowFrameManager: WindowFrameManager,
) : UiTreeFilterer {
    private val currentWindowFrame: WindowFrame
        get() = windowFrameManager.windowFrame.value

    override fun filterOnScreenOnly(uiTree: UiTree): UiTree {
        val filteredRoot = filterOnScreenOnly(uiTree.root)
        return uiTree.copy(root = filteredRoot)
    }

    fun filterOnScreenOnly(uiNode: UiNode): UiNode {
        val frame = currentWindowFrame
        // Always keep the root but filter its descendants. If the root itself were off-screen,
        // the children would be, too — but keeping the root keeps the type invariant.
        return filterNode(uiNode, frame) ?: uiNode.copy(children = emptyList())
    }

    private fun filterNode(
        node: UiNode,
        frame: WindowFrame,
    ): UiNode? {
        // Normalize and test visibility
        val nb = node.bounds.normalize()

        val w = nb.width
        val h = nb.height
        val isSizePositive = w > 0f && h > 0f
        val isVisFlagTrue = node.isVisible // respect platform visibility
        val intersectsScreen = frame.containsAny(nb.left, nb.top, w, h)

        val onScreen = isSizePositive && isVisFlagTrue && intersectsScreen
        if (!onScreen) return null

        // Filter children recursively
        val keptChildren = node.children.mapNotNull { child -> filterNode(child, frame) }

        // Preserve everything else, just swap children
        return node.copy(children = keptChildren)
    }

    // Some OEMs/apps report swapped or negative edges; normalize to a well-formed rect
    private fun Rect.normalize(): Rect {
        val l = min(left, right)
        val r = max(left, right)
        val t = min(top, bottom)
        val b = max(top, bottom)
        return if (l == left && r == right && t == top && b == bottom) {
            this
        } else {
            Rect(l, t, r, b)
        }
    }
}
