package action.appvisibility

import kotlinx.coroutines.flow.MutableStateFlow

class AppVisibilityNoOp(
    _isVisible: Boolean = true,
) : AppVisibility {
    override val isVisible = MutableStateFlow(_isVisible)
    override val visible: Boolean
        get() = isVisible.value
}
