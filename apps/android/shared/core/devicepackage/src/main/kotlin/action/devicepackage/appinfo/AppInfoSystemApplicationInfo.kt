package action.devicepackage.appinfo

import action.devicepackage.isDebuggable
import action.devicepackage.isSystemApp
import action.icon.IconResolver
import action.livedata.computableLiveData
import action.system.model.ComponentKey
import action.utils.map
import android.content.pm.ApplicationInfo
import android.content.pm.PackageManager
import android.graphics.drawable.Drawable
import androidx.core.content.pm.PackageInfoCompat.getLongVersionCode
import androidx.lifecycle.LiveData

class AppInfoSystemApplicationInfo(
    private val appInfo: ApplicationInfo,
    private val packageManager: PackageManager,
    private val iconResolver: IconResolver,
) : AppInfo(),
    AppInfoItemsSyncResolver {
    private var componentKey: ComponentKey? = null
    private var label: String? = null
    private val isDebuggable = appInfo.isDebuggable()
    private val isSystemApp = appInfo.isSystemApp()
    private val versionCode = getLongVersionCode(packageManager.getPackageInfo(appInfo.packageName, 0))

    private val iconInfoResult = computableLiveData { iconResolver.processIcon(appInfo) }

    private val icon: LiveData<Drawable> = iconInfoResult.getLiveData().map { it.first }
    private val iconHighlightColor: LiveData<Int> = iconInfoResult.getLiveData().map { it.second }

    override fun getComponentKey() =
        componentKey
            ?: ComponentKey.applicationKey(appInfo.packageName).also { componentKey = it }

    override fun getLabel() =
        label
            ?: packageManager.getApplicationLabel(appInfo).toString().also { label = it }

    override fun getIcon() = icon

    override fun getIconHighlightColor() = iconHighlightColor

    override fun isDebuggable() = isDebuggable

    override fun isSystemApp() = isSystemApp

    override fun getVersionCode() = versionCode

    override fun getTargetSdkVersion(): Int = appInfo.targetSdkVersion

    override fun resolveIconInfoSync(iconResolver: IconResolver) = iconInfoResult.computeImmediate()

    override fun resolveIconHighlightColorSync(iconResolver: IconResolver): Int = iconInfoResult.computeImmediate().second
}
