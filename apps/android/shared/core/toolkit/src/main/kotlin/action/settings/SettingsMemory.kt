package action.settings

import action.log.Log
import action.settings.Settings.OnSettingChangeListener

class SettingsMemory(
    private val tag: String = "SettingsMemory",
) : Settings {
    private val settings = mutableMapOf<String, Any?>()
    private val listeners = mutableSetOf<OnSettingChangeListener>()

    override fun registerOnSettingChangeListener(listener: OnSettingChangeListener) {
        listeners.add(listener)
    }

    override fun unregisterOnSettingChangeListener(listener: OnSettingChangeListener) {
        listeners.remove(listener)
    }

    override fun contains(key: String): Boolean = settings.containsKey(key)

    override fun getAll(): Map<String, *> = settings

    override fun getBoolean(
        key: String,
        defaultValue: Boolean,
    ): Boolean = settings[key]?.let { it as Boolean } ?: defaultValue

    override fun putBoolean(
        key: String,
        value: Boolean,
    ) {
        settings[key] = value
        listeners.forEach { it.onSettingChanged(this, key) }
    }

    override fun getInt(
        key: String,
        defaultValue: Int,
    ): Int = settings[key]?.let { it as Int } ?: defaultValue

    override fun putInt(
        key: String,
        value: Int,
    ) {
        settings[key] = value
        listeners.forEach { it.onSettingChanged(this, key) }
    }

    override fun getLong(
        key: String,
        defaultValue: Long,
    ): Long = settings[key]?.let { it as Long } ?: defaultValue

    override fun putLong(
        key: String,
        value: Long,
    ) {
        settings[key] = value
        listeners.forEach { it.onSettingChanged(this, key) }
    }

    override fun getFloat(
        key: String,
        defaultValue: Float,
    ): Float = settings[key]?.let { it as Float } ?: defaultValue

    override fun putFloat(
        key: String,
        value: Float,
    ) {
        settings[key] = value
        listeners.forEach { it.onSettingChanged(this, key) }
    }

    override fun getString(
        key: String,
        defaultValue: String,
    ): String = settings[key]?.let { it as String } ?: defaultValue

    override fun putString(
        key: String,
        value: String,
    ) {
        settings[key] = value
        listeners.forEach { it.onSettingChanged(this, key) }
    }

    override fun resetAll() {
        settings.clear()
    }

    init {
        Log.d("SettingsMemory init [$this.tag]")
    }
}
