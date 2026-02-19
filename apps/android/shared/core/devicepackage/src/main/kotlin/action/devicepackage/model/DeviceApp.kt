package action.devicepackage.model

import action.system.model.ApplicationId
import action.system.model.ComponentKey
import action.system.model.IntentKey

sealed interface DeviceApp {
    val label: String
    val applicationId: ApplicationId
    val canBeUninstalled: Boolean

    data class DeviceAppComponent(
        val componentKey: ComponentKey,
        override val label: String,
        override val canBeUninstalled: Boolean,
    ) : DeviceApp {
        override val applicationId: ApplicationId
            get() = componentKey.applicationId
    }

    data class DeviceAppIntent(
        override val applicationId: ApplicationId,
        override val label: String,
        val intentKey: IntentKey,
        override val canBeUninstalled: Boolean,
    ) : DeviceApp
}

fun DeviceApp(
    componentKey: ComponentKey,
    label: String,
    canBeUninstalled: Boolean,
): DeviceApp =
    DeviceApp.DeviceAppComponent(
        componentKey = componentKey,
        label = label,
        canBeUninstalled = canBeUninstalled,
    )

val DeviceApp.componentKey: ComponentKey?
    get() =
        when (this) {
            is DeviceApp.DeviceAppComponent -> componentKey
            is DeviceApp.DeviceAppIntent -> null
        }
