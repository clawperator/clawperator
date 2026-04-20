package clawperator.uitree

import action.log.Log
import android.accessibilityservice.AccessibilityService
import android.os.Build
import android.os.Bundle
import android.view.accessibility.AccessibilityNodeInfo
import android.view.inputmethod.EditorInfo
import androidx.core.view.accessibility.AccessibilityNodeInfoCompat
import clawperator.accessibilityservice.AccessibilityServiceManager
import clawperator.accessibilityservice.NoOpTextInputConnectionSource
import clawperator.accessibilityservice.TextInputConnectionSource
import clawperator.accessibilityservice.TextInputEditorInfo
import clawperator.accessibilityservice.TextInputSession
import clawperator.accessibilityservice.boundsInScreenRect
import clawperator.accessibilityservice.currentAccessibilityService
import clawperator.accessibilityservice.debugNode
import clawperator.accessibilityservice.debugNodeRedacted
import clawperator.accessibilityservice.dispatchLongPress
import clawperator.accessibilityservice.dispatchSingleTap
import clawperator.accessibilityservice.dispatchSwipe
import clawperator.accessibilityservice.firstClickableAncestorOrSelf
import clawperator.accessibilityservice.firstEditableAncestorOrSelf
import clawperator.accessibilityservice.firstFocusableAncestorOrSelf

class UiTreeManagerAndroid(
    private val accessibilityServiceManager: AccessibilityServiceManager,
) : UiTreeManager {
    // Phase 1 defines the testable boundary for the API 33 path without wiring it yet.
    private val inputConnectionSource: TextInputConnectionSource =
        accessibilityServiceManager as? TextInputConnectionSource ?: NoOpTextInputConnectionSource

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
        clear: Boolean,
    ): Boolean {
        val accessibilityNodeInfo = uiNode.accessibilityNodeInfo as? AccessibilityNodeInfo ?: return false
        val target = accessibilityNodeInfo.firstEditableAncestorOrSelf() ?: accessibilityNodeInfo
        val request =
            TextEntryRequest(
                uiNode = uiNode,
                target = target,
                text = text,
                submit = submit,
                clear = clear,
                replacementSemantics = ReplacementSemantics.ReplaceExistingContent,
            )

        for (strategy in textEntryStrategies) {
            if (!strategy.supports(request.replacementSemantics)) {
                continue
            }
            val minimumSdk = strategy.minimumSdk
            if (minimumSdk != null && Build.VERSION.SDK_INT < minimumSdk) {
                continue
            }
            val attempt = strategy.attempt(request) ?: continue
            Log.d(
                "[UiTreeManager] enter_text strategy=${strategy.name} submit_method=${attempt.submitMethod.wireValue} succeeded for id=${uiNode.id}",
            )
            return true
        }

        Log.d("[UiTreeManager] All enter_text strategies failed for id=${uiNode.id}")
        return false
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

    private val textEntryStrategies: List<TextEntryStrategy> =
        listOf(
            LegacySetTextStrategy,
            Api33InputConnectionStrategy(),
        )

    private data class TextEntryRequest(
        val uiNode: UiNode,
        val target: AccessibilityNodeInfo,
        val text: String,
        val submit: Boolean,
        val clear: Boolean,
        val replacementSemantics: ReplacementSemantics,
    )

    private enum class ReplacementSemantics {
        ReplaceExistingContent,
    }

    private sealed interface TextEntryStrategy {
        val name: String
        val minimumSdk: Int?
            get() = null

        fun supports(replacementSemantics: ReplacementSemantics): Boolean

        suspend fun attempt(request: TextEntryRequest): TextEntryAttemptResult?
    }

    private data class TextEntryAttemptResult(
        val submitMethod: SubmitMethod,
    )

    private enum class SubmitMethod(
        val wireValue: String,
    ) {
        NotRequested("not_requested"),
        ImeEnterAction("ime_action"),
        ClickFallback("click_fallback"),
        Unavailable("submit_unavailable"),
    }

    private object LegacySetTextStrategy : TextEntryStrategy {
        override val name: String = "legacy_action_set_text"

        override fun supports(replacementSemantics: ReplacementSemantics): Boolean =
            replacementSemantics == ReplacementSemantics.ReplaceExistingContent

        override suspend fun attempt(request: TextEntryRequest): TextEntryAttemptResult? {
            val target = request.target

            // Best-effort focus before setting text.
            if (!target.isFocused) {
                target.performAction(AccessibilityNodeInfo.ACTION_FOCUS)
                target.performAction(AccessibilityNodeInfo.ACTION_CLICK)
            }

            // Clear via ACTION_SET_TEXT with an empty CharSequence so clear=true fails
            // truthfully if the requested clear step cannot be performed.
            if (request.clear) {
                val clearArgs =
                    Bundle().apply {
                        putCharSequence(AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE, "")
                    }
                val clearSucceeded = target.performAction(AccessibilityNodeInfo.ACTION_SET_TEXT, clearArgs)
                if (!clearSucceeded) {
                    Log.d(
                        "[UiTreeManager] ACTION_SET_TEXT clear failed for id=${request.uiNode.id} on ${target.debugNodeRedacted()}",
                    )
                    return null
                }
            }

            val args =
                Bundle().apply {
                    putCharSequence(AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE, request.text)
                }

            val setTextSucceeded = target.performAction(AccessibilityNodeInfo.ACTION_SET_TEXT, args)
            if (!setTextSucceeded) {
                Log.d("[UiTreeManager] ACTION_SET_TEXT failed for id=${request.uiNode.id} on ${target.debugNodeRedacted()}")
                return null
            }

            return TextEntryAttemptResult(submitMethod = performLegacySubmit(target, request.submit))
        }

        private fun performLegacySubmit(
            target: AccessibilityNodeInfo,
            submitRequested: Boolean,
        ): SubmitMethod {
            if (!submitRequested) {
                return SubmitMethod.NotRequested
            }

            if (
                supportsImeEnterAction(target) &&
                target.performAction(AccessibilityNodeInfoCompat.AccessibilityActionCompat.ACTION_IME_ENTER.id)
            ) {
                return SubmitMethod.ImeEnterAction
            }

            return if (target.performAction(AccessibilityNodeInfo.ACTION_CLICK)) {
                SubmitMethod.ClickFallback
            } else {
                SubmitMethod.Unavailable
            }
        }

        private fun supportsImeEnterAction(target: AccessibilityNodeInfo): Boolean {
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.R) {
                return false
            }
            return AccessibilityNodeInfoCompat.wrap(target).actionList.any { action ->
                action.id == AccessibilityNodeInfoCompat.AccessibilityActionCompat.ACTION_IME_ENTER.id
            }
        }
    }

    private inner class Api33InputConnectionStrategy : TextEntryStrategy {
        override val name: String = "api33_input_connection"
        override val minimumSdk: Int = Build.VERSION_CODES.TIRAMISU

        override fun supports(replacementSemantics: ReplacementSemantics): Boolean =
            replacementSemantics == ReplacementSemantics.ReplaceExistingContent

        override suspend fun attempt(request: TextEntryRequest): TextEntryAttemptResult? {
            val target = request.target

            if (!target.isFocused) {
                target.performAction(AccessibilityNodeInfo.ACTION_FOCUS)
                target.performAction(AccessibilityNodeInfo.ACTION_CLICK)
            }

            val session = inputConnectionSource.currentSession()
            if (session == null) {
                logUnavailable(request, "session_unavailable")
                return null
            }

            if (!session.isActive) {
                logUnavailable(request, "input_finished")
                return null
            }

            val editorInfo = session.editorInfo
            if (editorInfo == null) {
                logUnavailable(request, "editor_info_missing")
                return null
            }

            val replaceSucceeded = replaceText(session, editorInfo, request)
            if (!replaceSucceeded) {
                logUnavailable(request, "replace_unavailable")
                return null
            }

            return TextEntryAttemptResult(
                submitMethod = performSubmit(session, editorInfo, request.submit),
            )
        }

        private fun replaceText(
            session: TextInputSession,
            editorInfo: TextInputEditorInfo,
            request: TextEntryRequest,
        ): Boolean {
            val knownTextLength = resolveKnownTextLength(session, editorInfo)
            if (knownTextLength != null && session.setSelection(0, knownTextLength)) {
                return session.commitText(request.text, 1)
            }

            val cursorMovedToEnd = session.setSelection(Int.MAX_VALUE, Int.MAX_VALUE)
            if (!cursorMovedToEnd) {
                return false
            }

            val cleared = session.deleteSurroundingText(Int.MAX_VALUE, 0)
            if (!cleared) {
                return false
            }

            return session.commitText(request.text, 1)
        }

        private fun resolveKnownTextLength(
            session: TextInputSession,
            editorInfo: TextInputEditorInfo,
        ): Int? =
            editorInfo.initialSurroundingText?.text?.length
                ?: session.getSurroundingText(Int.MAX_VALUE, Int.MAX_VALUE)?.text?.length

        private fun performSubmit(
            session: TextInputSession,
            editorInfo: TextInputEditorInfo,
            submitRequested: Boolean,
        ): SubmitMethod {
            if (!submitRequested) {
                return SubmitMethod.NotRequested
            }

            val editorAction = resolveEditorAction(editorInfo) ?: return SubmitMethod.Unavailable
            return if (session.performEditorAction(editorAction)) {
                SubmitMethod.ImeEnterAction
            } else {
                SubmitMethod.Unavailable
            }
        }

        private fun resolveEditorAction(editorInfo: TextInputEditorInfo): Int? {
            if (editorInfo.actionId != 0) {
                return editorInfo.actionId
            }

            val action = editorInfo.imeOptions and EditorInfo.IME_MASK_ACTION
            if (action == EditorInfo.IME_ACTION_NONE || action == EditorInfo.IME_ACTION_UNSPECIFIED) {
                return null
            }
            if ((editorInfo.imeOptions and EditorInfo.IME_FLAG_NO_ENTER_ACTION) != 0) {
                return null
            }
            return action
        }

        private fun logUnavailable(
            request: TextEntryRequest,
            reason: String,
        ) {
            Log.d(
                "[UiTreeManager] enter_text strategy=$name unavailable reason=$reason for id=${request.uiNode.id}",
            )
        }
    }
}
