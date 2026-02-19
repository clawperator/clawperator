package clawperator.uitree

interface UiTreeInspector {
    suspend fun getCurrentUiElements(): List<UiTreeElement>

    suspend fun getCurrentUiTree(): UiTree?
}
