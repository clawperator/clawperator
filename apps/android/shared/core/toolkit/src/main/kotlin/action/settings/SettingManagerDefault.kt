package action.settings

import action.log.Log
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.launch

class SettingManagerDefault(
    allSettings: AllSettings,
    private val coroutineScopeMain: CoroutineScope,
) : SettingManager,
    Settings.OnSettingChangeListener {
    private val flowMap = mutableMapOf<String, MutableSharedFlow<Unit>>()

    override fun onSettingChanged(settingKey: String): Flow<Unit> {
        Log.d("onSettingChanged(): $settingKey")

        return flowMap.getOrPut(settingKey) {
            MutableSharedFlow()
        }
    }

    override fun onSettingChanged(
        settings: Settings,
        key: String?,
    ) {
        val flow = flowMap[key] ?: return
        coroutineScopeMain.launch {
            flow.emit(Unit)
        }
    }

    init {
        allSettings.settings.forEach {
            it.registerOnSettingChangeListener(this)
        }
    }
}
