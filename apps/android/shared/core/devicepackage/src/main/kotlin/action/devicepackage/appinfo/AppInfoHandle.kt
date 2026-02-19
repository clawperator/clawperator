package action.devicepackage.appinfo

import action.system.model.ComponentKey

/**
 * A handle to a [AppInfo] instance.
 *
 * [AppInfo] items should be fetched via [PackageRepository.getAppInfo].
 */
open class AppInfoHandle(
    val componentKey: ComponentKey,
    val label: String,
    val obj: Any? = null,
) {
    override fun toString(): String = "label: $label, componentKey: ${componentKey.applicationId}/${componentKey.className}"
}
