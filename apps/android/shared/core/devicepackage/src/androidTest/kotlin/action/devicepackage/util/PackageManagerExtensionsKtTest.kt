package action.devicepackage.util

import action.devicepackage.isDebuggable
import action.devicepackage.isSystemApp
import android.content.Context
import android.content.pm.PackageManager
import androidx.test.platform.app.InstrumentationRegistry
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test

class PackageManagerExtensionsKtTest {
    private val context: Context by lazy { InstrumentationRegistry.getInstrumentation().targetContext }
    private val packageManager: PackageManager by lazy { context.packageManager }

    private fun getAppInfo(applicationId: String) = packageManager.getApplicationInfo(applicationId, 0)

    @Test fun isDebugApp_thisApplication_true() {
        val info = getAppInfo(context.packageName)
        assertNotNull(this)
        assertTrue(info.isDebuggable())
    }

    @Test fun isDebugApp_androidSettings_false() {
        val info = getAppInfo("com.android.settings")
        assertNotNull(this)
        assertFalse(info.isDebuggable())
    }

    @Test fun isSystemApp_thisApplication_false() {
        val info = getAppInfo(context.packageName)
        assertNotNull(this)
        assertFalse(info.isSystemApp())
    }

    @Test fun isSystemApp_androidSettings_true() {
        val info = getAppInfo("com.android.settings")
        assertNotNull(this)
        assertTrue(info.isSystemApp())
    }
}
