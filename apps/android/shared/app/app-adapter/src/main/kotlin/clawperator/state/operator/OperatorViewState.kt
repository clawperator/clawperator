package clawperator.state.operator

import clawperator.app.AppScreenState
import androidx.compose.runtime.Stable

@Stable
sealed interface OperatorViewState : AppScreenState {
    @Stable
    data object Loading : OperatorViewState

    @Stable
    data class Data(
        val appDoctorState: AppDoctorState,
        /** Label for the permissions-not-granted state (e.g. accessibility status text). */
        val accessibilityPermissionLabel: String,
    ) : OperatorViewState
}
