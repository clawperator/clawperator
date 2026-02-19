package action.devicepackage

import action.system.model.ComponentKey
import android.content.ComponentName

fun ComponentKey.asComponentName() = ComponentName(applicationId, className)
