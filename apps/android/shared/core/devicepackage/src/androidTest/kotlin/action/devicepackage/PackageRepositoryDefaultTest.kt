package action.devicepackage

import action.context.getUserManager
import action.devicepackage.alias.AppInfoAliasRepositoryStub
import action.devicepackage.util.CountingPackageRepositorySystem
import action.devicepackage.util.VersionOffsetPackageInfoRepository
import action.devicepackage.util.getSystemUiAppId
import action.devicepackage.util.loadAppLabel
import action.devicestate.DeviceStateMock
import action.icon.IconResolver
import action.system.model.ComponentKey
import android.content.Intent
import androidx.test.platform.app.InstrumentationRegistry
import kotlinx.coroutines.runBlocking
import org.junit.Assert
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

class PackageRepositoryDefaultTest {
    private lateinit var packageRepository: PackageRepositoryDefault

    private val context by lazy { InstrumentationRegistry.getInstrumentation().targetContext }
    private val packageManager by lazy { context.packageManager }
    private val userManager by lazy { context.getUserManager() }

    private val iconResolver by lazy { IconResolver(context) }
    private val launcherIntent = Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER)
    private val testComponentKey = ComponentKey(context.packageName, TestActivity1::class.java.name)

    private val config = PackageRepositoryConfigDefault(iconDensity = 640)

    private val packageInfoRepositoryReal by lazy { PackageInfoRepositorySystem(context) }
    private val packageInfoRepositoryWithOffset by lazy { VersionOffsetPackageInfoRepository(packageInfoRepositoryReal) }
    private val packageRepositorySystemCounting by lazy {
        CountingPackageRepositorySystem(
            context,
            packageInfoRepositoryWithOffset,
            iconResolver,
            userManager,
            config,
        )
    }
    private val appInfoAliasRepository = AppInfoAliasRepositoryStub()

    @Before
    fun setUp() {
        packageRepository =
            PackageRepositoryDefault(
                packageRepositorySystemCounting,
                packageInfoRepositoryWithOffset,
                appInfoAliasRepository,
                iconResolver,
                DeviceStateMock(_isUserUnlocked = true),
            )
    }

    @Test
    fun getDeviceAppInfos_matchesLauncherIntentResolveInfoListSize() =
        runBlocking {
            val deviceAppInfos = packageManager.queryIntentActivities(launcherIntent, 0)
            val packageRepositoryAppInfos = packageRepository.getDeviceAppInfos()
            Assert.assertEquals(
                "Failed to match mapped resolved info size",
                deviceAppInfos.size,
                packageRepositoryAppInfos.size,
            )

            // verify all ComponentKey values are not not null
            packageRepositoryAppInfos.forEach {
                Assert.assertNotNull(it.componentKey.applicationId)
                Assert.assertNotNull(it.componentKey.className)
            }
        }

    @Test
    fun getDeviceAppInfos_alwaysCallsSystemRepo() {
        runBlocking {
            packageRepository.getDeviceAppInfos()
            packageRepository.getDeviceAppInfos()
            assertEquals(2, packageRepositorySystemCounting.getDeviceAppInfosCallCount)
        }
    }

    @Test
    fun getAppInfos_resultFetchedFromCache_systemRepoNotCalled() =
        runBlocking {
            packageRepository.run {
                val currentPackage = context.packageName

                val appInfos1 = getAppInfos(currentPackage)
                assertEquals("Failed to load correct test activities info", 2, appInfos1.size)

                val cached = getAppInfos(currentPackage)
                assertEquals(appInfos1.size, cached.size)
                assertTrue(appInfos1.zip(cached).all { it.first === it.second })
                assertEquals(appInfos1.size, packageRepositorySystemCounting.getAppInfoCallCount)
            }
        }

    @Test
    fun getAppInfos_appWithoutActivities_fallbackToApplicationInfo() =
        runBlocking {
            packageRepository.run {
                val appInfos = getAppInfos(getSystemUiAppId())
                assertEquals(1, appInfos.size)
                assertEquals(packageManager.loadAppLabel(getSystemUiAppId()), appInfos[0].getLabel())
                assertEquals(1, packageRepositorySystemCounting.getAppInfoCallCount)
            }
        }

    @Test
    fun getAppInfos_fetchedFromCacheForAppWithoutActivities_systemRepoNotCalled() =
        runBlocking {
            packageRepository.run {
                val appInfos1 = getAppInfos(getSystemUiAppId())
                val cached = getAppInfos(getSystemUiAppId())

                assertEquals(appInfos1.size, cached.size)
                assertTrue(appInfos1.zip(cached).all { it.first === it.second })
                assertEquals(1, packageRepositorySystemCounting.getAppInfoCallCount)
            }
        }

    @Test
    fun getAppInfo_resultFetchedFromCache_systemRepoNotCalled() =
        runBlocking {
            packageRepository.run {
                val appInfo1 = getAppInfo(testComponentKey)
                val cached = getAppInfo(testComponentKey)

                assertTrue("Failed to return same instance on requery", appInfo1 === cached)
                assertEquals(1, packageRepositorySystemCounting.getAppInfoCallCount)
            }
        }

    @Test
    fun getAppInfo_sameAppIdDifferentClassName_differentCacheEntries() =
        runBlocking {
            packageRepository.run {
                val appInfo1 = getAppInfo(testComponentKey)
                val appInfo2 = getAppInfo(ComponentKey(testComponentKey.applicationId, TestActivity2::class.java.name))

                assertTrue("Returned the same instance on requery", appInfo1 !== appInfo2)
                assertEquals(2, packageRepositorySystemCounting.getAppInfoCallCount)
            }
        }

    @Test
    fun getAppInfo_cachedWithDifferentVersionCode_cacheInvalidated() =
        runBlocking {
            packageRepository.run {
                val appInfo1 = getAppInfo(testComponentKey)
                packageInfoRepositoryWithOffset.setVersionOffset(testComponentKey.applicationId, 1)
                val appInfo2 = getAppInfo(testComponentKey)

                assertTrue("Returned the same instance on requery", appInfo1 !== appInfo2)
                assertEquals(2, packageRepositorySystemCounting.getAppInfoCallCount)
            }
        }

    @Test
    fun getAppInfo_applicationKey_applicationInfoCached() =
        runBlocking {
            packageRepository.run {
                val appKey = ComponentKey.applicationKey(getSystemUiAppId())
                val info = getAppInfo(appKey)
                val cached = getAppInfo(appKey)
                assertEquals(packageManager.loadAppLabel(getSystemUiAppId()), info!!.getLabel())
                assertTrue("Failed to return same instance on requery", info === cached)
                assertEquals(1, packageRepositorySystemCounting.getAppInfoCallCount)
            }
        }
}
