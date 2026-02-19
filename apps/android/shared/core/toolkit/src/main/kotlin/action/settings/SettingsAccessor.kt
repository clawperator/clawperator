package action.settings

import kotlin.reflect.KClass

sealed class SettingsAccessor<T> {
    abstract fun get(
        settings: Settings,
        key: String,
        defaultValue: T,
    ): T

    abstract fun set(
        settings: Settings,
        key: String,
        value: T,
    )
}

@Suppress("UNCHECKED_CAST")
fun <T : Any> resolveSettingsAccessor(clazz: KClass<T>): SettingsAccessor<T> =
    when (clazz) {
        Boolean::class -> BooleanSettingsAccessor as SettingsAccessor<T>
        String::class -> StringSettingsAccessor as SettingsAccessor<T>
        Int::class -> IntSettingsAccessor as SettingsAccessor<T>
        Long::class -> LongSettingsAccessor as SettingsAccessor<T>
        Float::class -> FloatSettingsAccessor as SettingsAccessor<T>
        Double::class -> DoubleSettingsAccessor as SettingsAccessor<T>
        else -> throw IllegalArgumentException("Unsupported type: $clazz")
    }

data object StringSettingsAccessor : SettingsAccessor<String>() {
    override fun get(
        settings: Settings,
        key: String,
        defaultValue: String,
    ): String = requireNotNull(settings.getString(key, defaultValue))

    override fun set(
        settings: Settings,
        key: String,
        value: String,
    ) {
        settings.putString(key, value)
    }
}

data object BooleanSettingsAccessor : SettingsAccessor<Boolean>() {
    override fun get(
        settings: Settings,
        key: String,
        defaultValue: Boolean,
    ): Boolean = settings.getBoolean(key, defaultValue)

    override fun set(
        settings: Settings,
        key: String,
        value: Boolean,
    ) {
        settings.putBoolean(key, value)
    }
}

data object IntSettingsAccessor : SettingsAccessor<Int>() {
    override fun get(
        settings: Settings,
        key: String,
        defaultValue: Int,
    ): Int = settings.getInt(key, defaultValue)

    override fun set(
        settings: Settings,
        key: String,
        value: Int,
    ) {
        settings.putInt(key, value)
    }
}

data object LongSettingsAccessor : SettingsAccessor<Long>() {
    override fun get(
        settings: Settings,
        key: String,
        defaultValue: Long,
    ): Long = settings.getLong(key, defaultValue)

    override fun set(
        settings: Settings,
        key: String,
        value: Long,
    ) {
        settings.putLong(key, value)
    }
}

data object FloatSettingsAccessor : SettingsAccessor<Float>() {
    override fun get(
        settings: Settings,
        key: String,
        defaultValue: Float,
    ): Float = settings.getFloat(key, defaultValue)

    override fun set(
        settings: Settings,
        key: String,
        value: Float,
    ) {
        settings.putFloat(key, value)
    }
}

data object DoubleSettingsAccessor : SettingsAccessor<Double>() {
    override fun get(
        settings: Settings,
        key: String,
        defaultValue: Double,
    ): Double = settings.getFloat(key, defaultValue.toFloat()).toDouble()

    override fun set(
        settings: Settings,
        key: String,
        value: Double,
    ) {
        settings.putFloat(key, value.toFloat())
    }
}
