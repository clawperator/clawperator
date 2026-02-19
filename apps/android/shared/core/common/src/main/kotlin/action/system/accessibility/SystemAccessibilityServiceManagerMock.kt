package action.system.accessibility

class SystemAccessibilityServiceManagerMock(
    private val onRequestAction: (SystemAccessibilityActionType) -> Unit = {},
) : SystemAccessibilityServiceManager {
    override fun requestAction(systemAccessibilityActionType: SystemAccessibilityActionType) {
        onRequestAction(systemAccessibilityActionType)
    }
}
