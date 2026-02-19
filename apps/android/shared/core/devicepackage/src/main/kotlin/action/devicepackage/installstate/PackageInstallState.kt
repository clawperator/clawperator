package action.devicepackage.installstate

import android.content.Intent

enum class PackageInstallState(
    val action: String?,
) {
    UNKNOWN(null),
    INSTALLED(Intent.ACTION_PACKAGE_ADDED),
    CHANGED(Intent.ACTION_PACKAGE_CHANGED),
    UNINSTALLED(Intent.ACTION_PACKAGE_REMOVED),
}

fun getPackageInstallStateFromAction(action: String): PackageInstallState? = PackageInstallState.values().find { it.action == action }

fun PackageInstallState.isInstalled(): Boolean? =
    when (this) {
        PackageInstallState.INSTALLED -> true
        PackageInstallState.UNINSTALLED -> false
        else -> null
    }
