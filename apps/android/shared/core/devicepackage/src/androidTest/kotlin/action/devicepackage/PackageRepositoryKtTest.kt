package action.devicepackage

import action.context.getUserManager
import action.devicepackage.appinfo.AppInfoPreset
import action.icon.FallbackIconResolverSystem
import action.icon.IconResolver
import action.system.model.ComponentKey
import android.content.Context
import androidx.test.platform.app.InstrumentationRegistry
import kotlinx.coroutines.runBlocking
import org.junit.Assert.*
import org.junit.Test

class PackageRepositoryKtTest {
    private val context: Context by lazy { InstrumentationRegistry.getInstrumentation().targetContext }
    private val packageInfoRepository by lazy {
        PackageInfoRepositorySystem(context)
    }
    private val packageManager by lazy { context.packageManager }
    private val iconResolver: IconResolver = IconResolver(context)
    private val fallbackIconResolver = FallbackIconResolverSystem(iconResolver)
    private val config = PackageRepositoryConfigDefault(iconDensity = 640)

    private fun createPackageRepository(
        context: Context = this.context,
        iconResolver: IconResolver = this.iconResolver,
    ) = PackageRepositorySystem(
        context,
        packageInfoRepository,
        iconResolver,
        context.getUserManager(),
        config,
    )

    @Test fun requireAppInfo() =
        runBlocking {
            val key = ComponentKey("a.made.up.app.id", "className")
            createPackageRepository().run {
                val result = requireAppInfo(key, fallbackIconResolver)
                assertNotNull(result)
                val appInfo = result.appInfo
                assert(appInfo is AppInfoPreset)
                assertTrue(result.isPlaceholder)
                assertEquals(key, appInfo.getComponentKey())
                assertEquals(key.applicationId, appInfo.getLabel())
                assertNotNull(appInfo.getIcon())
            }
        }
}
