package action.devicepackage.appinfo

import action.icon.IconResolver
import action.system.model.ComponentKey
import android.graphics.drawable.ColorDrawable
import android.graphics.drawable.Drawable
import androidx.lifecycle.LiveData
import androidx.lifecycle.MutableLiveData

class AppInfoStub(
    initBlock: Builder.() -> Unit = {},
) : AppInfo(),
    AppInfoItemsSyncResolver {
    private val componentKeyData: ComponentKey
    private val labelData: String
    private val drawableData: Drawable
    private val drawableLiveData: LiveData<Drawable>
    private val iconHighlightColorData: Int
    private val iconHighlightColorLiveData: LiveData<Int>
    private val isDebuggableData: Boolean
    private val isSystemAppData: Boolean
    private val versionCodeData: Long
    private val targetSdkVersionData: Int

    init {
        val builder = Builder().apply(initBlock)
        componentKeyData = builder.componentKey ?: COMPONENT_KEY_DEFAULT
        labelData = builder.label ?: LABEL_DEFAULT
        drawableData = builder.drawable ?: DRAWABLE_DEFAULT
        drawableLiveData = MutableLiveData<Drawable>().apply { postValue(drawableData) }
        iconHighlightColorData = builder.iconHighlightColor ?: ICON_HIGHLIGHT_COLOR_DEFAULT
        iconHighlightColorLiveData = MutableLiveData<Int>().apply { postValue(iconHighlightColorData) }
        isDebuggableData = builder.isDebuggable ?: IS_DEBUGGABLE_DEFAULT
        isSystemAppData = builder.isSystemApp ?: IS_SYSTEM_APP_DEFAULT
        versionCodeData = builder.versionCode ?: VERSION_CODE_DEFAULT
        targetSdkVersionData = builder.targetSdkVersion ?: TARGET_SDK_VERSION_DEFAULT
    }

    override fun getComponentKey() = componentKeyData

    override fun getLabel() = labelData

    override fun getIcon() = drawableLiveData

    override fun getIconHighlightColor() = iconHighlightColorLiveData

    override fun isDebuggable() = isDebuggableData

    override fun isSystemApp() = isSystemAppData

    override fun getVersionCode() = versionCodeData

    override fun resolveIconHighlightColorSync(iconResolver: IconResolver) = iconHighlightColorData

    override fun resolveIconInfoSync(iconResolver: IconResolver) = drawableData to iconHighlightColorData

    override fun getTargetSdkVersion(): Int = targetSdkVersionData

    class Builder {
        var componentKey: ComponentKey? = null
        var label: String? = null
        var drawable: Drawable? = null
        var iconHighlightColor: Int? = null
        var isDebuggable: Boolean? = null
        var isSystemApp: Boolean? = null
        var versionCode: Long? = null
        var targetSdkVersion: Int? = null
    }

    companion object {
        private val COMPONENT_KEY_DEFAULT = ComponentKey("test", "test")
        private const val LABEL_DEFAULT = "test"
        private val DRAWABLE_DEFAULT = ColorDrawable(0)
        private const val ICON_HIGHLIGHT_COLOR_DEFAULT = 0
        private const val IS_DEBUGGABLE_DEFAULT = false
        private const val IS_SYSTEM_APP_DEFAULT = false
        private const val VERSION_CODE_DEFAULT = 0L
        private const val TARGET_SDK_VERSION_DEFAULT = 28
    }
}
