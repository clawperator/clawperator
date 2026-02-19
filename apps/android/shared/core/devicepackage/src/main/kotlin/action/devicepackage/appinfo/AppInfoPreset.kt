package action.devicepackage.appinfo

import action.icon.FallbackIconResolver
import action.icon.IconResolver
import action.system.model.ComponentKey
import android.graphics.drawable.Drawable

class AppInfoPreset(
    private val _componentKey: ComponentKey,
    fallbackIconResolver: FallbackIconResolver,
    private val _label: String? = null,
    private val _isDebuggable: Boolean = false,
    private val _isSystemApp: Boolean = false,
    private val _versionCode: Long = 0,
    private val _targetSdkVersion: Int = 28,
) : AppInfo(),
    AppInfoItemsSyncResolver {
    private val icon = fallbackIconResolver.getDrawable()
    private val iconHighlightColor = fallbackIconResolver.getIconHighlightColor()

    override fun getComponentKey() = _componentKey

    override fun getLabel() = _label ?: _componentKey.applicationId

    override fun getIcon() = icon

    override fun getIconHighlightColor() = iconHighlightColor

    override fun isDebuggable(): Boolean = _isDebuggable

    override fun isSystemApp(): Boolean = _isSystemApp

    override fun getVersionCode(): Long = _versionCode

    override fun getTargetSdkVersion(): Int = _targetSdkVersion

    override fun resolveIconHighlightColorSync(iconResolver: IconResolver): Int = iconResolver.fallbackIconInfoSync().second

    override fun resolveIconInfoSync(iconResolver: IconResolver): Pair<Drawable, Int> = iconResolver.fallbackIconInfoSync()
}
