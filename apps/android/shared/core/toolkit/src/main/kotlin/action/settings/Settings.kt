package action.settings

interface Settings {
    interface OnSettingChangeListener {
        fun onSettingChanged(
            settings: Settings,
            key: String?,
        )
    }

    fun unregisterOnSettingChangeListener(listener: OnSettingChangeListener)

    fun registerOnSettingChangeListener(listener: OnSettingChangeListener)

    fun contains(key: String): Boolean

    fun getAll(): Map<String, *>

    fun getBoolean(
        key: String,
        defaultValue: Boolean,
    ): Boolean

    fun putBoolean(
        key: String,
        value: Boolean,
    )

    fun getInt(
        key: String,
        defaultValue: Int,
    ): Int

    fun putInt(
        key: String,
        value: Int,
    )

    fun getLong(
        key: String,
        defaultValue: Long,
    ): Long

    fun putLong(
        key: String,
        value: Long,
    )

    fun getString(
        key: String,
        defaultValue: String,
    ): String

    fun putString(
        key: String,
        value: String,
    )

    fun getFloat(
        key: String,
        defaultValue: Float,
    ): Float

    fun putFloat(
        key: String,
        value: Float,
    )

    fun resetAll()
}
