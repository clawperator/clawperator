package action.system.ui.mode

import android.content.Context
import android.content.res.Configuration

class UiModeManagerSystem(
    private val context: Context,
) : UiModeManager {
    val configuration: Configuration
        get() = context.resources.configuration

    override val isNightModeDisplaying: Boolean
        get() =
            (configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK) ==
                Configuration.UI_MODE_NIGHT_YES
}
