package clawperator.uitree

interface UiTreeManager {
    /**
     * Programmatically clicks the [uiNode] using the specified click types.
     * Returns true if any of the requested click actions was successfully dispatched.
     *
     * @param uiNode The UI node to interact with
     * @param clickTypes The types of clicks to attempt in order (defaults to regular Click)
     */
    suspend fun triggerClick(
        uiNode: UiNode,
        clickTypes: UiTreeClickTypes = UiTreeClickTypes.Default,
    ): Boolean

    /**
     * Sets text on the given [uiNode].
     *
     * @param uiNode The node to set text on
     * @param text Text to set
     * @param submit If true, dispatches IME enter after setting text
     * @return true if text was entered successfully
     */
    suspend fun setText(
        uiNode: UiNode,
        text: String,
        submit: Boolean = false,
    ): Boolean

    /**
     * Performs a vertical swipe gesture within the bounds of the given [uiNode].
     * Used for scrolling or other directional gestures.
     *
     * @param uiNode The node to swipe within
     * @param startYRatio Starting Y position as a ratio of the node's height (0.0 = top, 1.0 = bottom)
     * @param endYRatio Ending Y position as a ratio of the node's height (0.0 = top, 1.0 = bottom)
     * @param durationMs Duration of the swipe gesture in milliseconds (default 250ms)
     * @return true if the swipe was successfully dispatched
     */
    suspend fun swipeWithinVertical(
        uiNode: UiNode,
        startYRatio: Float,
        endYRatio: Float,
        durationMs: Long = 250,
    ): Boolean

    /**
     * Performs a horizontal swipe gesture within the bounds of the given [uiNode].
     * Used for scrolling or other directional gestures.
     *
     * @param uiNode The node to swipe within
     * @param startXRatio Starting X position as a ratio of the node's width (0.0 = left, 1.0 = right)
     * @param endXRatio Ending X position as a ratio of the node's width (0.0 = left, 1.0 = right)
     * @param durationMs Duration of the swipe gesture in milliseconds (default 250ms)
     * @return true if the swipe was successfully dispatched
     */
    suspend fun swipeWithinHorizontal(
        uiNode: UiNode,
        startXRatio: Float,
        endXRatio: Float,
        durationMs: Long = 250,
    ): Boolean
}
