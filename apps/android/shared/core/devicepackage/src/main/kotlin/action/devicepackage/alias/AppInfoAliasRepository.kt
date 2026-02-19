package action.devicepackage.alias

import action.devicepackage.DeviceAppConstants.Companion.CLASS_NAME_LEAK_CANARY
import action.devicepackage.PackageInfoRepository
import action.devicepackage.getPackageInfoSystem
import action.icon.IconResolver
import action.string.StringRepository
import action.system.model.ComponentKey

interface AppInfoAliasRepository {
    suspend fun getAppInfo(componentKey: ComponentKey): AppInfoAlias?
}

class AppInfoAliasRepositoryDefault(
    private val packageInfoRepository: PackageInfoRepository,
    private val iconResolver: IconResolver,
    private val stringRepository: StringRepository,
) : AppInfoAliasRepository {
    override suspend fun getAppInfo(componentKey: ComponentKey): AppInfoAlias? {
        if (componentKey.className == CLASS_NAME_LEAK_CANARY) return null // Skip leak-canary
        val appId = componentKey.applicationId
        val aliasMapping =
            APP_INFO_ALIAS_MAPPINGS.find {
                it.appId == appId
            } ?: return null
        val packageInfo = packageInfoRepository.getPackageInfoSystem(appId) ?: return null
        return AppInfoAlias(aliasMapping, packageInfo, iconResolver, stringRepository)
    }
}

class AppInfoAliasRepositoryStub : AppInfoAliasRepository {
    var appInfoAliasProvider: (ComponentKey) -> AppInfoAlias? = { null }

    override suspend fun getAppInfo(componentKey: ComponentKey): AppInfoAlias? = appInfoAliasProvider(componentKey)
}
