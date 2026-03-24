package clawperator.uitree

import action.log.Log
import android.accessibilityservice.AccessibilityService
import android.view.accessibility.AccessibilityNodeInfo
import clawperator.accessibilityservice.AccessibilityServiceManager
import clawperator.accessibilityservice.boundsInScreenRect
import clawperator.accessibilityservice.currentAccessibilityService
import clawperator.accessibilityservice.debugNode
import clawperator.accessibilityservice.dispatchLongPress
import clawperator.accessibilityservice.dispatchSingleTap
import clawperator.accessibilityservice.dispatchSwipe
import clawperator.accessibilityservice.firstClickableAncestorOrSelf
import clawperator.accessibilityservice.firstEditableAncestorOrSelf
import clawperator.accessibilityservice.firstFocusableAncestorOrSelf
import android.os.Bundle

class UiTreeManagerAndroid(
    private val accessibilityServiceManager: AccessibilityServiceManager,
) : UiTreeManager {
    override suspend fun triggerClick(
        uiNode: UiNode,
        clickTypes: UiTreeClickTypes,
    ): Boolean {
        // Get the live AccessibilityNodeInfo from the direct reference
        val service = accessibilityServiceManager.currentAccessibilityService ?: return false
        val accessibilityNodeInfo = uiNode.accessibilityNodeInfo as? AccessibilityNodeInfo ?: return false

        // Try each click type in order until one succeeds
        for (clickType in clickTypes.ordered) {
            val success =
                when (clickType) {
                    UiTreeClickType.Click -> performClick(accessibilityNodeInfo, service, uiNode)
                    UiTreeClickType.LongClick -> performLongClick(accessibilityNodeInfo, service, uiNode)
                    UiTreeClickType.Focus -> performFocus(accessibilityNodeInfo, uiNode)
                }

            if (success) {
                Log.d("[UiTreeManager] Successfully performed $clickType on node for id=${uiNode.id}")
                return true
            }
        }

        Log.d("[UiTreeManager] All click types failed for id=${uiNode.id}")
        return false
    }

    override suspend fun clickAt(
        x: Float,
        y: Float,
        clickTypes: UiTreeClickTypes,
    ): Boolean {
        val service = accessibilityServiceManager.currentAccessibilityService ?: return false

        for (clickType in clickTypes.ordered) {
            val success =
                when (clickType) {
                    UiTreeClickType.Click -> service.dispatchSingleTap(x, y)
                    UiTreeClickType.LongClick -> service.dispatchLongPress(x, y)
                    UiTreeClickType.Focus -> {
                        Log.w("[UiTreeManager] Focus click type is not supported for raw coordinates at ($x,$y)")
                        false
                    }
                }

            if (success) {
                Log.d("[UiTreeManager] Successfully performed $clickType at ($x,$y)")
                return true
            }
        }

        Log.d("[UiTreeManager] All coordinate click types failed at ($x,$y)")
        return false
    }

    override suspend fun setText(
        uiNode: UiNode,
        text: String,
        submit: Boolean,
    ): Boolean {
        val accessibilityNodeInfo = uiNode.accessibilityNodeInfo as? AccessibilityNodeInfo ?: return false
        val target = accessibilityNodeInfo.firstEditableAncestorOrSelf() ?: accessibilityNodeInfo

        // Best-effort focus before setting text.
        if (!target.isFocused) {
            target.performAction(AccessibilityNodeInfo.ACTION_FOCUS)
            target.performAction(AccessibilityNodeInfo.ACTION_CLICK)
        }

        val args =
            Bundle().apply {
                putCharSequence(AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE, text)
            }

        val setTextSucceeded = target.performAction(AccessibilityNodeInfo.ACTION_SET_TEXT, args)
        if (!setTextSucceeded) {
            Log.d("[UiTreeManager] ACTION_SET_TEXT failed for id=${uiNode.id} on ${target.debugNode()}")
            return false
        }

        if (submit) {
            // Not all API levels/vendors expose a reliable IME submit action here.
            // Best-effort: click target after text set to trigger app-side listeners.
            target.performAction(AccessibilityNodeInfo.ACTION_CLICK)
        }

        return true
    }

    override suspend fun swipeWithinVertical(
        uiNode: UiNode,
        startYRatio: Float,
        endYRatio: Float,
        durationMs: Long,
    ): Boolean {
        val service = accessibilityServiceManager.currentAccessibilityService ?: return false

        // Get the live AccessibilityNodeInfo from the direct reference
        val accessibilityNodeInfo = uiNode.accessibilityNodeInfo as? AccessibilityNodeInfo ?: return false
        val bounds = accessibilityNodeInfo.boundsInScreenRect
        if (bounds.isEmpty) return false

        val centerX = bounds.exactCenterX()
        val startY = bounds.top + (bounds.height() * startYRatio)
        val endY = bounds.top + (bounds.height() * endYRatio)

        return service.dispatchSwipe(centerX, startY, centerX, endY, durationMs)
    }

    override suspend fun swipeWithinHorizontal(
        uiNode: UiNode,
        startXRatio: Float,
        endXRatio: Float,
        durationMs: Long,
    ): Boolean {
        val service = accessibilityServiceManager.currentAccessibilityService ?: return false

        // Get the live AccessibilityNodeInfo from the direct reference
        val accessibilityNodeInfo = uiNode.accessibilityNodeInfo as? AccessibilityNodeInfo ?: return false
        val bounds = accessibilityNodeInfo.boundsInScreenRect
        if (bounds.isEmpty) return false

        val centerY = bounds.exactCenterY()
        val startX = bounds.left + (bounds.width() * startXRatio)
        val endX = bounds.left + (bounds.width() * endXRatio)

        return service.dispatchSwipe(startX, centerY, endX, centerY, durationMs)
    }

    // --- Click type implementations ---

    /**
     * Performs a regular click: try ACTION_CLICK on clickable ancestor, fallback to gesture tap
     */
    private suspend fun performClick(
        accessibilityNodeInfo: AccessibilityNodeInfo,
        service: AccessibilityService,
        uiNode: UiNode,
    ): Boolean {
        // 1) Try ACTION_CLICK on clickable ancestor
        accessibilityNodeInfo.firstClickableAncestorOrSelf()?.let { clickable ->
            if (clickable.isEnabled && clickable.performAction(AccessibilityNodeInfo.ACTION_CLICK)) {
                Log.d("[UiTreeManager] Clicked via ACTION_CLICK on ${clickable.debugNode()} for id=${uiNode.id}")
                return true
            }
        }

        // 2) Gesture fallback: tap center of node bounds
        val bounds = accessibilityNodeInfo.boundsInScreenRect
        if (!bounds.isEmpty) {
            val cx = bounds.exactCenterX()
            val cy = bounds.exactCenterY()
            val ok = service.dispatchSingleTap(cx, cy)
            Log.d("[UiTreeManager] Clicked via gesture at ($cx,$cy) for id=${uiNode.id} -> $ok")
            return ok
        }

        return false
    }

    /**
     * Performs a long click: try ACTION_LONG_CLICK on clickable ancestor, fallback to long-press gesture
     */
    private suspend fun performLongClick(
        accessibilityNodeInfo: AccessibilityNodeInfo,
        service: AccessibilityService,
        uiNode: UiNode,
    ): Boolean {
        // 1) Try ACTION_LONG_CLICK on clickable ancestor
        accessibilityNodeInfo.firstClickableAncestorOrSelf()?.let { clickable ->
            if (clickable.isEnabled && clickable.performAction(AccessibilityNodeInfo.ACTION_LONG_CLICK)) {
                Log.d("[UiTreeManager] Long-clicked via ACTION_LONG_CLICK on ${clickable.debugNode()} for id=${uiNode.id}")
                return true
            }
        }

        // 2) Gesture fallback: long-press center of node bounds
        val bounds = accessibilityNodeInfo.boundsInScreenRect
        if (!bounds.isEmpty) {
            val cx = bounds.exactCenterX()
            val cy = bounds.exactCenterY()
            val ok = service.dispatchLongPress(cx, cy)
            Log.d("[UiTreeManager] Long-clicked via gesture at ($cx,$cy) for id=${uiNode.id} -> $ok")
            return ok
        }

        return false
    }

    /**
     * Performs focus: try ACTION_FOCUS, fallback to ACTION_SELECT (no gesture fallback)
     */
    private suspend fun performFocus(
        accessibilityNodeInfo: AccessibilityNodeInfo,
        uiNode: UiNode,
    ): Boolean {
        val target = accessibilityNodeInfo.firstFocusableAncestorOrSelf() ?: accessibilityNodeInfo

        // Try ACTION_FOCUS first
        if (target.performAction(AccessibilityNodeInfo.ACTION_FOCUS)) {
            Log.d("[UiTreeManager] Focused via ACTION_FOCUS on ${target.debugNode()} for id=${uiNode.id}")
            return true
        }

        // Try ACTION_SELECT as fallback
        if (target.performAction(AccessibilityNodeInfo.ACTION_SELECT)) {
            Log.d("[UiTreeManager] Selected via ACTION_SELECT on ${target.debugNode()} for id=${uiNode.id}")
            return true
        }

        return false
    }
}
