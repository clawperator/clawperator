package action.keyguard

import android.content.Context
import android.os.Build

class KeyguardManagerSystem(
    private val context: Context,
) : KeyguardManager {
    private val systemKeyguardManager by lazy {
        context.getSystemService(Context.KEYGUARD_SERVICE) as android.app.KeyguardManager
    }

    override fun isDeviceLocked(): Boolean =
        if (Build.VERSION.SDK_INT >= 22) {
            systemKeyguardManager.isDeviceLocked
        } else {
            systemKeyguardManager.isKeyguardLocked
        }

    override fun isKeyguardLocked(): Boolean = systemKeyguardManager.isKeyguardLocked

    override fun isDeviceSecure(): Boolean =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            systemKeyguardManager.isDeviceSecure
        } else {
            systemKeyguardManager.isKeyguardSecure
        }
}
