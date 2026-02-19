package action.devicepackage.alias

import action.devicepackage.appinfo.AppInfo
import action.devicepackage.appinfo.AppInfoItemsSyncResolver
import action.devicepackage.isDebuggable
import action.devicepackage.isSystemApp
import action.icon.IconResolver
import action.livedata.computableLiveData
import action.string.StringRepository
import action.system.model.ComponentKey
import action.utils.map
import android.content.pm.PackageInfo
import android.graphics.drawable.Drawable
import androidx.core.content.pm.PackageInfoCompat
import androidx.lifecycle.LiveData

class AppInfoAlias(
    private val appInfoAliasMapping: AppInfoAliasMapping,
    private val appPackageInfo: PackageInfo,
    private val iconResolver: IconResolver,
    private val stringRepository: StringRepository,
) : AppInfo(),
    AppInfoItemsSyncResolver {
    private val iconInfoResult = computableLiveData { iconResolver.processIcon(appInfoAliasMapping.aliasIcon) }
    private val icon: LiveData<Drawable> = iconInfoResult.getLiveData().map { it.first }
    private val iconHighlightColor: LiveData<Int> = iconInfoResult.getLiveData().map { it.second }

    override fun getComponentKey(): ComponentKey = ComponentKey.applicationKey(appInfoAliasMapping.appId)

    override fun getLabel(): String = stringRepository.getString(appInfoAliasMapping.aliasLabel)

    override fun getIcon(): LiveData<Drawable> = icon

    override fun getIconHighlightColor(): LiveData<Int> = iconHighlightColor

    override fun isDebuggable(): Boolean = appPackageInfo.applicationInfo?.isDebuggable() ?: false

    override fun isSystemApp(): Boolean = appPackageInfo.applicationInfo?.isSystemApp() ?: false

    override fun getVersionCode(): Long = PackageInfoCompat.getLongVersionCode(appPackageInfo)

    override fun getTargetSdkVersion(): Int = appPackageInfo.applicationInfo?.targetSdkVersion ?: 0

    override fun resolveIconInfoSync(iconResolver: IconResolver): Pair<Drawable, Int> = iconInfoResult.computeImmediate()

    override fun resolveIconHighlightColorSync(iconResolver: IconResolver): Int = resolveIconInfoSync(iconResolver).second
}
