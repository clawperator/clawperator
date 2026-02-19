package clawperator.state.operator

import action.coroutine.flow.combineDistinct
import action.resources.string.StringRepository
import androidx.lifecycle.ViewModel
import clawperator.accessibilityservice.AccessibilityServiceManager
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.stateIn

class OperatorViewModel(
    private val operatorRepository: OperatorRepository,
    private val accessibilityServiceManager: AccessibilityServiceManager,
    private val stringRepository: StringRepository,
    private val coroutineScope: CoroutineScope,
) : ViewModel() {
    val isReady: Flow<Boolean>
        get() = operatorRepository.isReady

    private fun mapViewState(
        accessibilityIsRunning: Boolean,
    ): OperatorViewState.Data {
        val label =
            if (accessibilityIsRunning) {
                stringRepository.accessibilityPermissionStatusGranted
            } else {
                stringRepository.accessibilityPermissionStatusNotGranted
            }

        return OperatorViewState.Data(
            accessibilityPermissionLabel = label,
        )
    }

    val viewState: StateFlow<OperatorViewState> =
        combineDistinct(
            isReady,
            accessibilityServiceManager.isRunning,
        ) { isReady, accessibilityIsRunning ->
            if (isReady) {
                mapViewState(accessibilityIsRunning = accessibilityIsRunning)
            } else {
                OperatorViewState.Loading
            }
        }.stateIn(
            scope = coroutineScope,
            started = SharingStarted.WhileSubscribed(),
            initialValue = OperatorViewState.Loading
        )

    suspend fun onBackPress() {
    }
}
