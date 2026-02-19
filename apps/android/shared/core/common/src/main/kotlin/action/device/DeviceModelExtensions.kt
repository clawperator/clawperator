package action.device

import android.os.Build

fun createSystemDeviceModel() = DeviceModel(Build.MANUFACTURER, Build.MODEL)
