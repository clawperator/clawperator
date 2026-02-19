package action.devicepackage

import android.content.Context
import android.content.pm.PackageManager
import androidx.test.platform.app.InstrumentationRegistry
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Test

class PackageInfoRepositorySystemTest {
    private val context: Context by lazy {
        InstrumentationRegistry.getInstrumentation().targetContext
    }
    private val packageManager: PackageManager by lazy {
        context.packageManager
    }

    @Test fun getApplicationInfo_exists() {
        val repo = PackageInfoRepositorySystem(context)
        assertNotNull(runBlocking { repo.getPackageInfo(context.packageName) })
    }

    @Test fun getApplicationInfo_doesNotExist() {
        val repo = PackageInfoRepositorySystem(context)
        assertNull(runBlocking { repo.getPackageInfo("a.made.up.application.id") })
    }
}
