package action.devicepackage.appinfo

import action.icon.IconResolver
import action.system.model.ComponentKey
import android.graphics.drawable.Drawable
import android.os.Build
import androidx.lifecycle.LiveData

abstract class AppInfo {
    abstract fun getComponentKey(): ComponentKey

    abstract fun getLabel(): String

    abstract fun getIcon(): LiveData<Drawable>

    abstract fun getIconHighlightColor(): LiveData<Int>

    abstract fun isDebuggable(): Boolean

    abstract fun isSystemApp(): Boolean

    abstract fun getVersionCode(): Long

    abstract fun getTargetSdkVersion(): Int

    /**
     * Compares against the [getLabel] and [getComponentKey]. Ignores [getIcon]].
     */
    override fun equals(other: Any?): Boolean {
        if (other !is AppInfo) return false
        return getLabel() == other.getLabel() && getComponentKey() == other.getComponentKey()
    }

    override fun hashCode(): Int {
        var result = getComponentKey().hashCode()
        result = 31 * result + getLabel().hashCode()
        return result
    }

    override fun toString(): String = "${getLabel()}, ${getComponentKey()}"

    fun supportsNotificationChannels(): Boolean = getTargetSdkVersion() >= Build.VERSION_CODES.O
}

interface AppInfoItemsSyncResolver {
    fun resolveIconInfoSync(iconResolver: IconResolver): Pair<Drawable, Int>

    fun resolveIconHighlightColorSync(iconResolver: IconResolver): Int
}
