package clawperator.uitree

class UiTreeInspectorNoOp : UiTreeInspector {
    override suspend fun getCurrentUiElements(): List<UiTreeElement> = emptyList()

    override suspend fun getCurrentUiTree(): UiTree? = null
}
