package action.devicepackage

import action.context.getUserManager
import action.devicepackage.util.getSystemUiAppId
import action.devicepackage.util.loadAppLabel
import action.icon.IconResolver
import action.system.model.ComponentKey
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import androidx.test.platform.app.InstrumentationRegistry
import kotlinx.coroutines.runBlocking
import org.junit.Assert.*
import org.junit.Test

class PackageRepositorySystemTest {
    private val context: Context by lazy {
        InstrumentationRegistry.getInstrumentation().targetContext
    }
    private val packageManager: PackageManager by lazy {
        context.packageManager
    }
    private val packageInfoRepository by lazy {
        PackageInfoRepositorySystem(context)
    }
    private val iconResolver: IconResolver = IconResolver(context)

    private val launcherIntent = Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER)
    private val testComponentKey = ComponentKey(context.packageName, TestActivity1::class.java.name)

    private val config = PackageRepositoryConfigDefault(iconDensity = 640)

    private val launcherAppId = findLauncherApplicationId()

    private fun findLauncherApplicationId(): String? {
        val homeAppsIntent = Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_HOME)
        val launcherIntent = Intent(this.launcherIntent)
        val launcherApps = packageManager.queryIntentActivities(homeAppsIntent, 0)
        val launcherAppInfo =
            launcherApps.firstOrNull {
                packageManager
                    .queryIntentActivities(launcherIntent.setPackage(it.activityInfo.packageName), 0)
                    .isEmpty()
            }
        return launcherAppInfo?.activityInfo?.packageName
    }

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

    @Test fun repoCreateTest() {
        val repo = createPackageRepository()
        assertNotNull(repo)
    }

    @Test fun getDeviceAppInfosTest() =
        runBlocking {
            val packageRepository = createPackageRepository()

            val deviceAppInfos = packageManager.queryIntentActivities(launcherIntent, 0)
            val packageRepositoryAppInfos = packageRepository.getDeviceAppInfos()
            assertEquals(
                "Failed to match mapped resolved info size",
                deviceAppInfos.size,
                packageRepositoryAppInfos.size,
            )

            // verify all ComponentKey values are not not null
            packageRepositoryAppInfos.forEach {
                assertNotNull(it.componentKey.applicationId)
                assertNotNull(it.componentKey.className)
            }
        }

    @Test fun getAppInfosTest() =
        runBlocking {
            val packageRepository = createPackageRepository()
            packageRepository.getDeviceAppInfos()

            // verify random app id returns empty app info
            assertTrue(packageRepository.getAppInfos("a.made.up.app.id").isEmpty())

            // verify android settings info
            val settingsAppInfo = packageRepository.getAppInfos("com.android.settings").first()
            assertEquals("Settings app label do not match", "Settings", settingsAppInfo.getLabel())
            assertNotNull(settingsAppInfo.getIcon())
            assertNotNull(settingsAppInfo.getComponentKey())

            // verify test activities
            val result = packageRepository.getAppInfos(context.packageName)
            assertEquals("There must be two test activities", 2, result.size)

            // verify TestActivity1
            val activity1Info = result.first { it.getComponentKey() == testComponentKey }
            assertEquals("Failed to match test activity 1 label", "TestLabel1", activity1Info.getLabel())
            assertNotNull(activity1Info.getComponentKey())
            assertNotNull(activity1Info.getIcon())

            // verify TestActivity2
            val activity2Info = result.first { it.getComponentKey().className == TestActivity2::class.java.name }
            assertNotNull(activity1Info.getComponentKey())
            assertNotNull(activity2Info.getIcon())
            // when Activity doesn't have label verify package name is used
            assertEquals(TestActivity2::class.java.name, activity2Info.getLabel())
        }

    @Test
    fun getAppInfos_appWithoutLauncherActivity_fallbackToApplicationInfo() =
        runBlocking {
            val packageRepository = createPackageRepository()
            val infos = packageRepository.getAppInfos(getSystemUiAppId())
            assertEquals(1, infos.size)
            val info = infos[0]
            assertEquals(getSystemUiAppId(), info.getComponentKey().applicationId)
            assertTrue(info.getComponentKey().isApplicationKey())
            assertEquals(packageManager.loadAppLabel(getSystemUiAppId()), info.getLabel())
        }

    @Test fun getAppInfos_sorted() =
        runBlocking {
            val packageRepository = createPackageRepository()
            val results = packageRepository.getDeviceAppInfos()

            for (i in 0 until results.size - 1) {
                val a = results[i].label
                val b = results[i + 1].label
                assertTrue("\"$b\" must be before \"$a\"", a <= b)
            }
        }

    @Test
    fun getAppInfoTest() =
        runBlocking {
            val packageRepository = createPackageRepository()

            // Some random ComponentKey values should return null appInfo
            val madeUpComponentKey = ComponentKey("a.made.up.app.id", "a.made.up.app.Activity")
            assertNull(packageRepository.getAppInfo(madeUpComponentKey))
            // Valid app id with invalid class name should return null
            val invalidActivityComponentKey = ComponentKey(context.packageName, "a.made.up.app.Activity")
            assertNull(packageRepository.getAppInfo(invalidActivityComponentKey))

            // valid ComponentKey should return a valid appInfo
            val activityInfo = packageRepository.getAppInfo(testComponentKey)
            assertNotNull(activityInfo)
            assertEquals("Failed to match test activity 1 label", "TestLabel1", activityInfo?.getLabel())
            assertNotNull(activityInfo?.getComponentKey())
            assertNotNull(activityInfo?.getIcon())
        }

    @Test
    fun getAppInfo_applicationKey_fallbackToApplicationInfo() =
        runBlocking {
            val packageRepository = createPackageRepository()
            val info = packageRepository.getAppInfo(ComponentKey.applicationKey(getSystemUiAppId()))!!
            assertEquals(getSystemUiAppId(), info.getComponentKey().applicationId)
            assertTrue(info.getComponentKey().isApplicationKey())
            assertEquals(packageManager.loadAppLabel(getSystemUiAppId()), info.getLabel())
        }
}
