package action.device

import android.content.Context
import android.os.Build
import android.provider.Settings

class DeviceIdSystem(
    context: Context,
) : DeviceId {
    private val _bestDeviceId: String by lazy {
        _secureAndroidId ?: fallbackId()
    }

    override val bestDeviceId: String
        get() = _bestDeviceId

    private val _secureAndroidId: String? by lazy {
        val id = Settings.Secure.getString(context.contentResolver, Settings.Secure.ANDROID_ID)
        id?.toString()?.let {
            if (it.isValidAndroidId()) {
                it
            } else {
                null
            }
        }
    }

    override val secureAndroidId: String?
        get() = _secureAndroidId

    fun fallbackId(): String = Build.MANUFACTURER.lowercase() + Build.MODEL.lowercase()
}

internal fun String?.isValidAndroidId(): Boolean {
    if (isNullOrEmpty() ||
        this.length <= 7 ||
        this == "-1" ||
        this == "0" ||
        this == "null" ||
        this == "id" ||
        this == "unknown"
    ) {
        return false
    }

    return true
}
