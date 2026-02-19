package action.settings

import action.coroutine.map
import action.preference.MutableObservableValue
import action.preference.ObservableValue
import action.preference.PreferenceInfo
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.flow.MutableStateFlow

object SettingFactoryCommon {
    inline fun <reified T : Any> setting(
        preferenceInfo: PreferenceInfo<T>,
        settings: Settings,
        updateDispatcher: SettingsUpdateDispatcher,
        coroutineScope: CoroutineScope,
        observeAndUpdateFlow: Boolean = false,
    ): ObservableValue<T> =
        setting(
            preferenceInfo = preferenceInfo,
            settings = settings,
            updateDispatcher = updateDispatcher,
            coroutineScope = coroutineScope,
            observeAndUpdateFlow = observeAndUpdateFlow,
        ) { it }

    inline fun <reified T : Any, R : Any> setting(
        preferenceInfo: PreferenceInfo<T>,
        settings: Settings,
        updateDispatcher: SettingsUpdateDispatcher,
        coroutineScope: CoroutineScope,
        observeAndUpdateFlow: Boolean,
        noinline mapper: (T) -> R,
    ): ObservableValue<R> {
        val accessor = resolveSettingsAccessor(T::class)
        val mutableStateFlow = createMutableStateFlow(preferenceInfo, accessor, settings, updateDispatcher)
        val startingValue = mapper(accessor.get(settings, preferenceInfo.key, preferenceInfo.default()))
        return ObservableValueFlow(
            preferenceInfo.key,
            mutableStateFlow.map(coroutineScope, mapper) as MutableStateFlow<R>,
            observeAndUpdateFlow,
            coroutineScope,
        )
    }

    inline fun <reified T : Any> mutableSettingFlow(
        preferenceInfo: PreferenceInfo<T>,
        settings: Settings?,
        updateDispatcher: SettingsUpdateDispatcher,
        coroutineScope: CoroutineScope,
    ): MutableStateFlow<T> =
        mutableSettingFlow(
            preferenceInfo,
            settings,
            updateDispatcher,
            coroutineScope,
            mapper = { it },
            inverseMapper = { it },
        )

    inline fun <reified T : Any, R : Any> mutableSettingFlow(
        preferenceInfo: PreferenceInfo<T>,
        settings: Settings?,
        updateDispatcher: SettingsUpdateDispatcher,
        coroutineScope: CoroutineScope,
        noinline mapper: (T) -> R,
        noinline inverseMapper: (R) -> T,
    ): MutableStateFlow<R> {
        val mutableObservable =
            mutableSetting(
                preferenceInfo = preferenceInfo,
                settings = settings,
                updateDispatcher = updateDispatcher,
                coroutineScope = coroutineScope,
                observeAndUpdateFlow = true,
                mapper = mapper,
                inverseMapper = inverseMapper,
            )
        require(mutableObservable is ObservableValueFlow<R>)
        return mutableObservable.mutableStateFlow
    }

    inline fun <reified T : Any> mutableSetting(
        preferenceInfo: PreferenceInfo<T>,
        settings: Settings?,
        updateDispatcher: SettingsUpdateDispatcher,
        coroutineScope: CoroutineScope,
    ): MutableObservableValue<T> =
        mutableSetting(
            preferenceInfo,
            settings,
            updateDispatcher,
            coroutineScope,
            observeAndUpdateFlow = false,
            { it },
            { it },
        )

    inline fun <reified T : Any, R : Any> mutableSetting(
        preferenceInfo: PreferenceInfo<T>,
        settings: Settings?,
        updateDispatcher: SettingsUpdateDispatcher,
        coroutineScope: CoroutineScope,
        observeAndUpdateFlow: Boolean,
        noinline mapper: (T) -> R,
        noinline inverseMapper: (R) -> T,
    ): MutableObservableValue<R> {
        val accessor = resolveSettingsAccessor(T::class)
        val mutableStateFlow: MutableStateFlow<T> =
            createMutableStateFlow(preferenceInfo, accessor, settings, updateDispatcher)

        return ObservableValueFlow(
            preferenceInfo.key,
            mutableStateFlow.map(coroutineScope, mapper) as MutableStateFlow<R>,
            observeAndUpdateFlow,
            coroutineScope,
        ) { preferenceKey, newValue ->
            if (settings != null) {
                accessor.set(settings, preferenceKey, inverseMapper(newValue))
            } else {
                mutableStateFlow.value = inverseMapper(newValue)
            }
        }
    }

    inline fun <reified T : Any> staticSetting(
        preferenceInfo: PreferenceInfo<T>,
        settings: Settings,
        coroutineScope: CoroutineScope,
        initialValueResolver: () -> T,
    ): T {
        val accessor = resolveSettingsAccessor(T::class)
        return if (!settings.contains(preferenceInfo.key)) {
            initialValueResolver().also {
                accessor.set(settings, preferenceInfo.key, it)
            }
        } else {
            accessor.get(settings, preferenceInfo.key, preferenceInfo.default())
        }
    }

    fun <T> createMutableStateFlow(
        preferenceInfo: PreferenceInfo<T>,
        accessor: SettingsAccessor<T>,
        settings: Settings?,
        updateDispatcher: SettingsUpdateDispatcher,
    ): MutableStateFlow<T> {
        val updates =
            MutableStateFlow<T>(
                if (settings != null) {
                    accessor.get(settings, preferenceInfo.key, preferenceInfo.default())
                } else {
                    preferenceInfo.default()
                },
            )
        updateDispatcher.onUpdate(preferenceInfo.key) {
            if (settings != null) {
                updates.value = accessor.get(settings, preferenceInfo.key, preferenceInfo.default())
            }
        }
        return updates
    }
}
