package action.preferences

import android.content.SharedPreferences

/**
 * A naive implementation of [SharedPreferences] where data is kept solely in memory, never written
 * to disc. Useful for unit tests, or situations where you explicitly don't want to write to disc
 * (such as during an instant app session).
 */
class SharedPreferencesMemory : SharedPreferences {
    private val prefs = mutableMapOf<String, Any?>()
    private val listeners = mutableSetOf<SharedPreferences.OnSharedPreferenceChangeListener>()

    override fun contains(key: String?): Boolean = prefs.containsKey(key)

    override fun getBoolean(
        key: String,
        defValue: Boolean,
    ): Boolean = prefs[key]?.let { it as Boolean } ?: defValue

    override fun getInt(
        key: String,
        defValue: Int,
    ): Int = prefs[key]?.let { it as Int } ?: defValue

    override fun getAll(): MutableMap<String, *> = prefs

    override fun edit(): SharedPreferences.Editor = Editor(prefs)

    override fun getLong(
        key: String?,
        defValue: Long,
    ): Long = prefs[key]?.let { it as Long } ?: defValue

    override fun getFloat(
        key: String?,
        defValue: Float,
    ): Float = prefs[key]?.let { it as Float } ?: defValue

    @Suppress("UNCHECKED_CAST")
    override fun getStringSet(
        key: String?,
        defValues: MutableSet<String>?,
    ): MutableSet<String>? = prefs[key]?.let { it as MutableSet<String> } ?: defValues

    override fun getString(
        key: String?,
        defValue: String?,
    ): String? = prefs[key]?.let { it as String } ?: defValue

    override fun unregisterOnSharedPreferenceChangeListener(listener: SharedPreferences.OnSharedPreferenceChangeListener) {
        listeners.remove(listener)
    }

    override fun registerOnSharedPreferenceChangeListener(listener: SharedPreferences.OnSharedPreferenceChangeListener) {
        listeners.add(listener)
    }

    inner class Editor(
        val prefs: MutableMap<String, Any?>,
    ) : SharedPreferences.Editor {
        override fun putLong(
            key: String,
            value: Long,
        ) = put(key, value)

        override fun putInt(
            key: String,
            value: Int,
        ) = put(key, value)

        override fun putBoolean(
            key: String,
            value: Boolean,
        ) = put(key, value)

        override fun putStringSet(
            key: String,
            values: MutableSet<String>?,
        ) = put(key, values)

        override fun putFloat(
            key: String,
            value: Float,
        ) = put(key, value)

        override fun putString(
            key: String,
            value: String?,
        ) = put(key, value)

        override fun apply() = Unit

        override fun commit(): Boolean = true

        override fun remove(key: String) =
            this.apply {
                prefs.remove(key)
                listeners.forEach { it.onSharedPreferenceChanged(this@SharedPreferencesMemory, key) }
            }

        override fun clear(): SharedPreferences.Editor =
            this.apply {
                val currentKeys = prefs.keys
                prefs.clear()
                listeners.forEach { listener ->
                    currentKeys.forEach { key ->
                        listener.onSharedPreferenceChanged(this@SharedPreferencesMemory, key)
                    }
                }
            }

        fun put(
            key: String,
            value: Any?,
        ) = this.apply {
            prefs[key] = value
            listeners.forEach { it.onSharedPreferenceChanged(this@SharedPreferencesMemory, key) }
        }
    }
}
