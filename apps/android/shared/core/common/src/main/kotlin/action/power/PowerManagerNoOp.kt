package action.power

import kotlinx.coroutines.flow.MutableStateFlow

class PowerManagerNoOp constructor(
    var isInteractiveState: Boolean = true,
    var isPowerSaveModeState: Boolean = false,
) : PowerManager {
    override val powerSaveMode = MutableStateFlow(isPowerSaveModeState)

    override fun isInteractive() = isInteractiveState

    override fun isPowerSaveMode() = isPowerSaveModeState
}
