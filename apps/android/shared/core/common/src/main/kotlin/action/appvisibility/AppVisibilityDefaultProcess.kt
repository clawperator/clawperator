package action.appvisibility

import action.log.Log
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow

/**
 * Default application process [AppVisibility] implementation.
 */
class AppVisibilityDefaultProcess : AppVisibility {
    private val _isVisible = MutableStateFlow(false)

    fun updateVisibility(isVisible: Boolean) {
        if (this._isVisible.value == isVisible) return
        Log.d("updateVisibility() -> isVisible: ${this._isVisible.value} -> $isVisible")
        _isVisible.value = isVisible
    }

    override val isVisible: Flow<Boolean>
        get() = _isVisible
    override val visible: Boolean
        get() = _isVisible.value
}
