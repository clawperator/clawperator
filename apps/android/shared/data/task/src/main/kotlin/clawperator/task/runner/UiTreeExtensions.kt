package clawperator.task.runner

import clawperator.uitree.ToggleState
import clawperator.uitree.UiTree
import clawperator.uitree.UiTreeTraversal
import clawperator.uitree.inferOnOffState

/**
 * Finds the On/Off toggle container in the UI tree using a flexible NodeMatcher.
 * Then infers the toggle state within that container's subtree.
 *
 * @param containerMatcher NodeMatcher for finding the toggle container (e.g., by resourceId, text, role, etc.)
 * @return ToggleState.On, ToggleState.Off, or ToggleState.Unknown
 */
fun UiTree.inferOnOffStateInContainer(containerMatcher: NodeMatcher): ToggleState {
    // Convert UiNode to TaskUiNode for matching
    val container =
        UiTreeTraversal.findFirst(this) { uiNode ->
            val taskUiNode =
                TaskUiNode(
                    resourceId = uiNode.resourceId,
                    label = uiNode.label,
                    clickable = uiNode.isClickable,
                    role = uiNode.role.name.lowercase(),
                    bounds = uiNode.bounds,
                    debugPath = uiNode.id.value,
                )
            containerMatcher.matches(taskUiNode)
        } ?: return ToggleState.Unknown

    // Create a temporary sub-tree rooted at the container to search within
    val subTree = UiTree(root = container, windowId = this.windowId)
    return subTree.inferOnOffState()
}
