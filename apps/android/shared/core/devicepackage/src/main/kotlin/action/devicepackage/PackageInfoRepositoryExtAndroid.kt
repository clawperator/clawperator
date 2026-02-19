package action.devicepackage

import action.devicepackage.model.DeviceActivityInfoAndroid
import action.devicepackage.model.DeviceApplicationInfoAndroid
import action.devicepackage.model.DevicePackageInfoAndroid
import action.system.model.ComponentKey
import android.content.pm.ActivityInfo
import android.content.pm.ApplicationInfo
import android.content.pm.PackageInfo

suspend fun PackageInfoRepository.getApplicationInfoSystem(applicationId: String): ApplicationInfo? =
    getApplicationInfo(applicationId)
        ?.let { (it as DeviceApplicationInfoAndroid).applicationInfo }

suspend fun PackageInfoRepository.getPackageInfoSystem(applicationId: String): PackageInfo? =
    getPackageInfo(applicationId)
        ?.let { (it as DevicePackageInfoAndroid).packageInfo }

suspend fun PackageInfoRepository.getActivityInfoSystem(componentKey: ComponentKey): ActivityInfo? =
    getActivityInfo(componentKey)
        ?.let { (it as DeviceActivityInfoAndroid).activityInfo }
