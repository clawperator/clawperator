package action.settings

import action.log.Log
import action.preference.MutableObservableValue
import action.preference.ObservableValue
import action.preference.PreferenceInfo
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.flow.MutableStateFlow
import action.settings.SettingFactoryCommon as SettingFactoryImpl

object SettingFactory {
    inline fun <reified T : Any> setting(
        preferenceInfo: PreferenceInfo<T>,
        settings: Settings,
        updateDispatcher: SettingsUpdateDispatcher,
        coroutineScope: CoroutineScope,
    ): ObservableValue<T> = SettingFactoryImpl.setting(preferenceInfo, settings, updateDispatcher, coroutineScope)

    inline fun <reified T : Any, R : Any> setting(
        pref: PreferenceInfo<T>,
        settings: Settings,
        updateDispatcher: SettingsUpdateDispatcher,
        coroutineScope: CoroutineScope,
        noinline mapper: (T) -> R,
    ): ObservableValue<R> =
        SettingFactoryImpl
            .setting(pref, settings, updateDispatcher, coroutineScope, observeAndUpdateFlow = false, mapper)

    inline fun <reified T : Any> mutableSettingFlow(
        preferenceInfo: PreferenceInfo<T>,
        settings: Settings?,
        updateDispatcher: SettingsUpdateDispatcher,
        coroutineScope: CoroutineScope,
    ): MutableStateFlow<T> = SettingFactoryImpl.mutableSettingFlow(preferenceInfo, settings, updateDispatcher, coroutineScope)

    inline fun <reified T : Any, R : Any> mutableSettingFlow(
        preferenceInfo: PreferenceInfo<T>,
        settings: Settings?,
        updateDispatcher: SettingsUpdateDispatcher,
        coroutineScope: CoroutineScope,
        noinline mapper: (T) -> R,
        noinline inverseMapper: (R) -> T,
    ): MutableStateFlow<R> =
        SettingFactoryImpl.mutableSettingFlow(
            preferenceInfo,
            settings,
            updateDispatcher,
            coroutineScope,
            mapper,
            inverseMapper,
        )

    inline fun <reified T : Any> mutableSetting(
        preferenceInfo: PreferenceInfo<T>,
        settings: Settings?,
        updateDispatcher: SettingsUpdateDispatcher,
        coroutineScope: CoroutineScope,
    ): MutableObservableValue<T> = SettingFactoryImpl.mutableSetting(preferenceInfo, settings, updateDispatcher, coroutineScope)

    inline fun <reified T : Any, R : Any> mutableSetting(
        preferenceInfo: PreferenceInfo<T>,
        settings: Settings?,
        updateDispatcher: SettingsUpdateDispatcher,
        coroutineScope: CoroutineScope,
        noinline mapper: (T) -> R,
        noinline inverseMapper: (R) -> T,
    ): MutableObservableValue<R> =
        SettingFactoryImpl.mutableSetting(
            preferenceInfo,
            settings,
            updateDispatcher,
            coroutineScope,
            observeAndUpdateFlow = false,
            mapper,
            inverseMapper,
        )

    inline fun <reified T : Any> staticSetting(
        preferenceInfo: PreferenceInfo<T>,
        settings: Settings,
        coroutineScope: CoroutineScope,
        initialValueResolver: () -> T,
    ): T = SettingFactoryImpl.staticSetting(preferenceInfo, settings, coroutineScope, initialValueResolver)
}

fun <T : Any> MutableStateFlow<T>.observeForProcessBridge(): MutableStateFlow<T> {
    Log.w("TODO: Implement observeForProcessBridge() for MutableStateFlow")
    return this
}
