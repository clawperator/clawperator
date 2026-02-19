package action.system.settings

import android.content.Context
import android.provider.Settings

class SystemSettingsRepositorySystem(
    context: Context,
) : SystemSettingsRepository {
    private val contentResolver by lazy { context.contentResolver }

    override val isUsingAutomaticSystemTime: Boolean
        get() = Settings.Global.getInt(contentResolver, Settings.Global.AUTO_TIME, 0) == 1
}
