package action.settings

import action.settings.Settings.OnSettingChangeListener
import android.content.SharedPreferences
import android.content.SharedPreferences.OnSharedPreferenceChangeListener
import androidx.core.content.edit

class SettingsSharedPreferences(
    private val sharedPreferences: SharedPreferences,
) : Settings {
    private val listenerMap: MutableMap<OnSettingChangeListener, OnSharedPreferenceChangeListener> =
        mutableMapOf()

    override fun unregisterOnSettingChangeListener(listener: OnSettingChangeListener) {
        val sharedPreferenceListener = listenerMap[listener] ?: return
        sharedPreferences.unregisterOnSharedPreferenceChangeListener(sharedPreferenceListener)
        listenerMap.remove(listener)
    }

    override fun registerOnSettingChangeListener(listener: OnSettingChangeListener) {
        val sharedPreferenceListener =
            listenerMap.getOrPut(listener) {
                OnSharedPreferenceChangeListener { _, key ->
                    listener.onSettingChanged(this, key)
                }
            }
        sharedPreferences.registerOnSharedPreferenceChangeListener(sharedPreferenceListener)
    }

    override fun contains(key: String): Boolean = sharedPreferences.contains(key)

    override fun getAll(): Map<String, *> = sharedPreferences.all

    override fun getBoolean(
        key: String,
        defaultValue: Boolean,
    ): Boolean = sharedPreferences.getBoolean(key, defaultValue)

    override fun putBoolean(
        key: String,
        value: Boolean,
    ) {
        sharedPreferences.edit {
            putBoolean(key, value)
        }
    }

    override fun getInt(
        key: String,
        defaultValue: Int,
    ): Int = sharedPreferences.getInt(key, defaultValue)

    override fun putInt(
        key: String,
        value: Int,
    ) {
        sharedPreferences.edit {
            putInt(key, value)
        }
    }

    override fun getLong(
        key: String,
        defaultValue: Long,
    ): Long = sharedPreferences.getLong(key, defaultValue)

    override fun putLong(
        key: String,
        value: Long,
    ) {
        sharedPreferences.edit {
            putLong(key, value)
        }
    }

    override fun getString(
        key: String,
        defaultValue: String,
    ): String = sharedPreferences.getString(key, defaultValue) ?: defaultValue

    override fun putString(
        key: String,
        value: String,
    ) {
        sharedPreferences.edit {
            putString(key, value)
        }
    }

    override fun getFloat(
        key: String,
        defaultValue: Float,
    ): Float = sharedPreferences.getFloat(key, defaultValue)

    override fun putFloat(
        key: String,
        value: Float,
    ) {
        sharedPreferences.edit {
            putFloat(key, value)
        }
    }

    override fun resetAll() {
        sharedPreferences.edit(commit = true) {
            clear()
        }
    }
}
