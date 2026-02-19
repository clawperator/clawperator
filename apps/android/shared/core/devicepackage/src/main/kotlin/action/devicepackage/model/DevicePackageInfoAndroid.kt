package action.devicepackage.model

import android.content.pm.PackageInfo

class DevicePackageInfoAndroid(
    val packageInfo: PackageInfo,
) : DevicePackageInfo {
    override val applicationInfo: DeviceApplicationInfo?
        get() = packageInfo.applicationInfo?.let { DeviceApplicationInfoAndroid(it) }
}
