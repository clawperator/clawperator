package action.system.window

import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

data class WindowInsets(
    val statusBarHeight: Dp,
    val navigationBarHeight: Dp,
) {
    companion object {
        val Preset =
            WindowInsets(
                statusBarHeight = 24.dp,
                navigationBarHeight = 16.dp,
            )
        val Empty =
            WindowInsets(
                statusBarHeight = 0.dp,
                navigationBarHeight = 0.dp,
            )
    }
}
