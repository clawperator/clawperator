package action.devicepackage.model

import action.system.model.ApplicationId
import action.system.model.IntentKey

data class DeviceShortcut(
    val applicationId: ApplicationId,
    val intentKey: IntentKey,
    val label: String,
    val resolveInfo: Any?,
)
