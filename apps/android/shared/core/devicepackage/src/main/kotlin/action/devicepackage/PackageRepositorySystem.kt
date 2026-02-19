package action.devicepackage

import action.context.getLauncherAppsService
import action.context.getTelecomManager
import action.devicepackage.appinfo.AppInfo
import action.devicepackage.appinfo.AppInfoHandle
import action.devicepackage.appinfo.AppInfoHandleSystem
import action.devicepackage.appinfo.AppInfoSystemApplicationInfo
import action.devicepackage.appinfo.AppInfoSystemResolveInfo
import action.devicepackage.model.ActivityData
import action.devicepackage.model.AppInfoFilter
import action.devicepackage.model.ApplicationData
import action.devicepackage.model.DeviceActivityInfoAndroid
import action.icon.IconResolver
import action.log.Log
import action.system.model.ComponentKey
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.pm.ActivityInfo
import android.content.pm.LauncherActivityInfo
import android.content.pm.LauncherApps
import android.content.pm.PackageManager
import android.content.pm.ResolveInfo
import android.net.Uri
import android.os.Build
import android.os.UserManager
import android.telecom.TelecomManager

open class PackageRepositorySystem(
    context: Context,
    private val packageInfoRepository: PackageInfoRepository,
    private val iconResolver: IconResolver,
    private val userManager: UserManager,
    private val config: PackageRepositoryConfig,
) : PackageRepository {
    private var cachedLauncherActivities: List<ResolveInfo>? = null
    private var cachedStateId = -1

    private var launchersCacheStateId = -1
    private var cachedLaunchers: Set<String>? = null

    private val packageManager: PackageManager by lazy {
        context.packageManager
    }

    private val telecomManager: TelecomManager by lazy {
        context.getTelecomManager()
    }

    private val launcherApps: LauncherApps by lazy {
        context.getLauncherAppsService()
    }

    override suspend fun getLauncherAppIds(): Collection<String> {
        val stateId = packageInfoRepository.getStateId()
        val cached = cachedLaunchers
        return if (cached == null || launchersCacheStateId != stateId) {
            packageManager
                .queryIntentActivities(
                    Intent(Intent.ACTION_MAIN)
                        .addCategory(Intent.CATEGORY_HOME),
                    0,
                ).map { it.activityInfo.packageName }
                .toSet()
                .also {
                    cachedLaunchers = it
                    launchersCacheStateId = stateId
                }
        } else {
            cached
        }
    }

    override suspend fun getDeviceAppInfos(filter: AppInfoFilter?): List<AppInfoHandle> =
        mutableListOf<ResolveInfo>()
            .apply {
                val launcherActivities = getLauncherActivities()
                launcherActivities.forEach { resolveInfo ->
                    val predicate = createPredicate(filter)
                    if (predicate.invoke(resolveInfo)) {
                        add(resolveInfo)
                    }
                }
            }.map { AppInfoHandleSystem(it, it.loadLabel(packageManager).toString()) }
            .sortedBy { it.label.lowercase() }
            .toList()

    override suspend fun getAppInfo(componentKey: ComponentKey): AppInfo? {
        val appInfos = getAppInfos(componentKey.applicationId)

        appInfos
            .firstOrNull {
                it.getComponentKey().className == componentKey.className
            }?.also {
                return it
            }

        if (componentKey.isApplicationKey()) {
            return if (appInfos.isNotEmpty()) {
                appInfos.first()
            } else {
                getFallbackApplicationInfos(componentKey.applicationId).firstOrNull()
            }
        }

        return null
    }

    override suspend fun getAppInfos(applicationId: String): List<AppInfo> =
        getActivityInfos(applicationId)
            .let { if (it.isEmpty()) getFallbackApplicationInfos(applicationId) else it }

    fun getComponents(applicationId: String): List<ComponentKey> =
        getLauncherActivities(applicationId).map {
            ComponentKey(it.activityInfo.packageName, it.activityInfo.name)
        }

    override suspend fun getDefaultPhoneAppIds(): Collection<String> =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            listOf(telecomManager.defaultDialerPackage)
        } else {
            getDialerApps()
                ?.map { it.activityInfo.packageName }
                ?.filter { packageInfoRepository.getApplicationInfoSystem(it)?.isSystemApp() == true }
                ?: listOf()
        }

    fun getLauncherActivityInfos(defaultUserOnly: Boolean): List<LauncherActivityInfo>? {
        return mutableListOf<LauncherActivityInfo>()
            .apply {
                userManager.userProfiles.forEach {
                    if (defaultUserOnly && it.hashCode() != 0) {
                        return@forEach
                    }
                    plusAssign(launcherApps.getActivityList(null, it))
                }
                sortBy { it.label.toString().lowercase() }
            }.ifEmpty { null }
    }

    override fun getLauncherActivityInfosForAllUsers(): Collection<LauncherActivityInfo> =
        mutableListOf<LauncherActivityInfo>().apply {
            userManager.userProfiles.forEach {
                plusAssign(launcherApps.getActivityList(null, it))
            }
            sortBy { it.label.toString().lowercase() }
        }

    override fun getIntentActivities(intent: Intent): Collection<ActivityInfo> =
        packageManager
            .queryIntentActivities(intent, 0)
            .mapNotNull {
                it.activityInfo
            }.filter {
                it.packageName != null
            }

    override suspend fun getAllApplicationData(
        defaultUserOnly: Boolean,
        includeActivityData: Boolean,
    ): List<ApplicationData>? {
        val activityInfos = getLauncherActivityInfos(defaultUserOnly)

        return mutableListOf<ApplicationData>()
            .apply {
                activityInfos?.forEach { launcherActivityInfo ->
                    add(launcherActivityInfo.getApplicationData(includeActivityData))
                }
            }.ifEmpty { null }
    }

    suspend fun LauncherActivityInfo.getApplicationData(includeActivityData: Boolean): ApplicationData {
        val applicationId = applicationInfo.packageName
        val label = applicationInfo.loadLabel(packageManager).toString()

        val activityData =
            if (includeActivityData) {
                getExportedActivityData(applicationId)
            } else {
                null
            }

        return ApplicationData(applicationId, label, activityData)
    }

    override suspend fun getExportedActivityData(applicationId: String): List<ActivityData>? =
        packageInfoRepository
            .getExportedActivityInfos(applicationId)
            ?.filterIsInstance<DeviceActivityInfoAndroid>()
            ?.map {
                val activityInfo = it.activityInfo
                ActivityData(
                    ComponentKey(activityInfo.packageName, activityInfo.name),
                    label = activityInfo.loadLabel(packageManager).toString(),
                    obj = it,
                )
            }?.ifEmpty { null }

    override fun getComponentEnabledState(componentKey: ComponentKey): ComponentEnabledState =
        getComponentKeyEnabledState(
            packageManager.getComponentEnabledSetting(componentKey.asComponentName()),
        )

    override fun setComponentEnabledState(
        componentKey: ComponentKey,
        state: ComponentEnabledState,
    ) {
        val componentName = componentKey.asComponentName()
        val currentSystemState = packageManager.getComponentEnabledSetting(componentName)
        if (currentSystemState != state.systemState) {
            Log.d(
                "Setting %s component state: %s -> %s",
                componentKey.applicationId,
                getComponentKeyEnabledState(currentSystemState).name,
                getComponentKeyEnabledState(state.systemState).name,
            )
            packageManager.setComponentEnabledSetting(
                componentName,
                state.systemState,
                PackageManager.DONT_KILL_APP,
            )
        }
    }

    private suspend fun getActivityInfos(applicationId: String): List<AppInfo> =
        mutableListOf<AppInfo>().apply {
            val activities =
                getLauncherActivities(applicationId)
                    .asSequence()
            activities.forEach { resolveInfo ->
                packageInfoRepository.getPackageInfoSystem(resolveInfo.activityInfo.packageName)?.also {
                    add(AppInfoSystemResolveInfo(resolveInfo, packageManager, it, iconResolver))
                }
            }

//                .mapNotNull { resolveInfo ->
//                    packageInfoRepository.getPackageInfo(resolveInfo.activityInfo.packageName)?.let {
//                        AppInfoSystemResolveInfo(resolveInfo, packageManager, it, iconResolver)
//                    }
//                }.toList()
        }

    private suspend fun getFallbackApplicationInfos(applicationId: String): List<AppInfo> {
        val appInfoList = mutableListOf<AppInfo>()
        try {
            packageManager.getApplicationInfo(applicationId, 0).let {
                val appInfo = AppInfoSystemApplicationInfo(it, packageManager, iconResolver)
                appInfoList.add(appInfo)
                if (appInfo.getLabel() == applicationId) {
                    val packageInfo =
                        packageInfoRepository.getPackageInfoSystem(applicationId)
                            ?: return appInfoList
                    val intent =
                        packageManager.getLaunchIntentForPackage(applicationId)
                            ?: return appInfoList
                    val resolveInfo =
                        packageManager.resolveActivity(intent, 0)
                            ?: return appInfoList
                    appInfoList[0] =
                        AppInfoSystemResolveInfo(
                            resolveInfo,
                            packageManager,
                            packageInfo,
                            iconResolver,
                        )
                }
            }
        } catch (ex: PackageManager.NameNotFoundException) {
        } catch (ex: NullPointerException) {
        }
        return appInfoList
    }

    private fun getLauncherActivities(packageName: String): List<ResolveInfo> {
        val intent =
            Intent(Intent.ACTION_MAIN, null)
                .addCategory(Intent.CATEGORY_LAUNCHER)
                .setPackage(packageName)
        return packageManager.queryIntentActivities(intent, 0)
    }

    private fun getLauncherActivities(): List<ResolveInfo> {
        val stateId = packageInfoRepository.getStateId()
        val cached = cachedLauncherActivities
        return if (cached == null || cachedStateId != stateId) {
            val activities = queryLauncherActivities()
            cachedLauncherActivities = activities
            cachedStateId = stateId
            activities
        } else {
            cached
        }
    }

    private fun queryLauncherActivities(): List<ResolveInfo> {
        val intent = Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER)
//        if (!permissionsProvider.hasQueryAllPackagesPermission()) {
//            Timber.w("Requesting bulk packageInfo without QUERY_ALL_PACKAGES permission - only a subset will be returned")
//        }
        return packageManager.queryIntentActivities(intent, 0)
    }

    private fun createPredicate(filter: AppInfoFilter?): suspend (ResolveInfo) -> Boolean {
        if (filter == null || filter.isEmpty) {
            return { true }
        } else {
            return { info ->
                val appId = info.activityInfo.packageName
                when {
                    (!filter.includeLaunchers && getLauncherAppIds().contains(appId)) ||
                        filter.filterApps.contains(appId) -> {
                        false
                    }
                    !filter.includeDebugApps || !filter.includeUninstalledApps -> {
                        val appInfo = packageInfoRepository.getApplicationInfoSystem(appId)
                        if (!filter.includeUninstalledApps && appInfo == null) {
                            false
                        } else {
                            appInfo == null || !appInfo.isDebuggable()
                        }
                    }
                    else -> true
                }
            }
        }
    }

    private fun getDialerApps(): List<ResolveInfo>? {
        val intent = Intent(Intent.ACTION_DIAL, Uri.parse("tel:+13335557654"))
        return getLauncherAppForResolveInfos(packageManager.queryIntentActivities(intent, 0))
    }

    private fun getLauncherAppForResolveInfos(resolveInfos: List<ResolveInfo>?): List<ResolveInfo>? {
        if (resolveInfos != null && resolveInfos.isNotEmpty()) {
            val result = mutableListOf<ResolveInfo>()
            for (resolveInfo in resolveInfos) {
                if (resolveInfo.activityInfo != null) {
                    val activityInfo = resolveInfo.activityInfo
                    val launcherInfos = getLauncherActivities(activityInfo.packageName)
                    val rootResolveInfo = getRootResolveInfo(activityInfo)
                    if (launcherInfos.isEmpty() || rootResolveInfo == null) continue
                    // Now find an item with a matching root Activity. This ensures for apps with multiple
                    // launcher Activities (such as Samsung bundling Dialer and Contacts in the same package),
                    // we use the right one. Re #1096.
                    for (launcherInfo in launcherInfos) {
                        val launcherRoot = getRootResolveInfo(launcherInfo.activityInfo)
                        if (launcherRoot != null) {
                            if (rootResolveInfo.activityInfo.name == launcherRoot.activityInfo.name) {
                                if (!isResolveInfoOnList(launcherInfo, result)) {
                                    result.add(launcherInfo)
                                }
                            }
                        }
                    }
                }
            }
            if (result.size > 0) {
                return result
            }
        }
        return null
    }

    private fun getRootResolveInfo(activityInfo: ActivityInfo): ResolveInfo? {
        var activityInfoMutable = activityInfo
        while (activityInfo.targetActivity != null && activityInfo.targetActivity != activityInfo.name) {
            try {
                activityInfoMutable =
                    packageManager.getActivityInfo(
                        ComponentName(activityInfo.packageName, activityInfo.targetActivity),
                        0,
                    )
            } catch (e: PackageManager.NameNotFoundException) {
            }
        }
        val result =
            packageManager.queryIntentActivities(
                Intent()
                    .setComponent(ComponentName(activityInfoMutable.packageName, activityInfoMutable.name)),
                0,
            )
        if (result.size > 0) {
            return result[0]
        }
        return null
    }

    private fun isResolveInfoOnList(
        resolveInfo: ResolveInfo,
        list: List<ResolveInfo>,
    ): Boolean {
        if (resolveInfo.activityInfo != null) {
            for (i in list) {
                if (i.activityInfo != null &&
                    i.activityInfo.name == resolveInfo.activityInfo.name &&
                    i.activityInfo.packageName == resolveInfo.activityInfo.packageName
                ) {
                    return true
                }
            }
        }
        return false
    }
}
