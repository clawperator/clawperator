package clawperator.uitree

interface UiTreeInspector {
    suspend fun getCurrentUiElements(): List<UiTreeElement>

    suspend fun getCurrentUiTree(): UiTree?

    suspend fun getCurrentWindowMetadata(): UiWindowMetadata?

    /**
     * Returns a UI hierarchy dump that mirrors Android's `uiautomator dump` node structure.
     */
    suspend fun getCurrentUiHierarchyDump(): String?
}
