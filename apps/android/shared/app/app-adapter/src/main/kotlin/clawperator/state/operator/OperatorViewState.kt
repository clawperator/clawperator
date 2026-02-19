package clawperator.state.operator

import clawperator.app.AppScreenState
import androidx.compose.runtime.Stable

@Stable
sealed interface OperatorViewState : AppScreenState {
    @Stable
    data object Loading : OperatorViewState

    @Stable
    data class Data(
        val accessibilityPermissionLabel: String,
    ) : OperatorViewState
}
