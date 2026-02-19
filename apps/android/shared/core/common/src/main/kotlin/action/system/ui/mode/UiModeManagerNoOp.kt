package action.system.ui.mode

class UiModeManagerNoOp(
    var isNightModeState: Boolean = false,
) : UiModeManager {
    override val isNightModeDisplaying: Boolean
        get() = isNightModeState
}
