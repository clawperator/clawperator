package action.device

import java.util.Locale

data class DeviceModel(
    val manufacturer: String,
    val model: String,
) {
    fun getLabel(stripWhitespace: Boolean = true): String =
        "${manufacturer}_$model".let {
            if (stripWhitespace) it.replace("\\s".toRegex(), "") else it
        }

    val isXiaomi: Boolean by lazy { manufacturer.lowercase() == "xiaomi" }

    /**
     * Checks if this is a **native** Huawei device. You know, one that messes with AOSP such
     * that even checking if the app is a default launcher actually changes the default launcher.
     * Do NOT return true on the Nexus 6P.
     * Re #971.
     */
    val isNativeHuawei: Boolean by lazy {
        val manufacturer = manufacturer.lowercase()
        val modelLower = model.lowercase(Locale.getDefault())
        manufacturer == "huawei" && modelLower.startsWith("hw")
    }
}
