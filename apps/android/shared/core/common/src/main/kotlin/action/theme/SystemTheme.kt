package action.theme

import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow

/**
 * Does the system recommend the app use its dark theme?
 */
interface SystemTheme {
    val isDarkTheme: Boolean
    val darkTheme: StateFlow<Boolean>

    /**
     * Call to force [darkTheme] to be updated (such as via an [onConfigurationChanged] call on Android).
     */
    fun update()
}

class SystemThemeNoOp(
    override val isDarkTheme: Boolean = false,
    override val darkTheme: MutableStateFlow<Boolean> = MutableStateFlow(isDarkTheme),
) : SystemTheme {
    override fun update() { }
}
