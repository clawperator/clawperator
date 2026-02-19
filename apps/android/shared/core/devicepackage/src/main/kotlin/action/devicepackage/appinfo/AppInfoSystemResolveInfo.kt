package action.devicepackage.appinfo

import action.devicepackage.isDebuggable
import action.devicepackage.isSystemApp
import action.icon.IconResolver
import action.livedata.computableLiveData
import action.system.model.ComponentKey
import action.utils.map
import android.content.pm.PackageInfo
import android.content.pm.PackageManager
import android.content.pm.ResolveInfo
import android.graphics.drawable.Drawable
import androidx.core.content.pm.PackageInfoCompat.getLongVersionCode
import androidx.lifecycle.LiveData

class AppInfoSystemResolveInfo(
    private val resolveInfo: ResolveInfo,
    private val packageManager: PackageManager,
    packageInfo: PackageInfo,
    private val iconResolver: IconResolver,
) : AppInfo(),
    AppInfoItemsSyncResolver {
    private var componentKey: ComponentKey? = null
    private var label: String? = null
    private var isDebuggable: Boolean
    private var isSystemApp: Boolean
    private val versionCode: Long
    private val targetSdkVersion: Int

    private val iconInfoResult = computableLiveData { iconResolver.processIcon(resolveInfo) }

    private val icon: LiveData<Drawable> = iconInfoResult.getLiveData().map { it.first }
    private val iconHighlightColor: LiveData<Int> = iconInfoResult.getLiveData().map { it.second }

    init {
        val appInfo = packageInfo.applicationInfo
        isDebuggable = appInfo?.isDebuggable() ?: false
        isSystemApp = appInfo?.isSystemApp() ?: false
        versionCode = getLongVersionCode(packageInfo)
        targetSdkVersion = appInfo?.targetSdkVersion ?: 0
    }

    override fun getComponentKey() =
        componentKey
            ?: ComponentKey(resolveInfo.activityInfo.packageName, resolveInfo.activityInfo.name)
                .also { componentKey = it }

    override fun getLabel() =
        label
            ?: (resolveInfo.loadLabel(packageManager)?.toString() ?: "").also { label = it }

    override fun getIcon() = icon

    override fun getIconHighlightColor() = iconHighlightColor

    override fun isDebuggable() = isDebuggable

    override fun isSystemApp() = isSystemApp

    override fun getVersionCode() = versionCode

    override fun getTargetSdkVersion(): Int = targetSdkVersion

    override fun resolveIconInfoSync(iconResolver: IconResolver) = iconInfoResult.computeImmediate()

    override fun resolveIconHighlightColorSync(iconResolver: IconResolver): Int = iconInfoResult.computeImmediate().second
}
