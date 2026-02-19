package action.devicepackage.model

import action.system.model.ComponentKey

data class ApplicationData(
    val applicationId: String,
    val label: String,
    val activities: List<ActivityData>?,
) {
    val componentKeys: List<ComponentKey>? by lazy {
        activities?.map { it.componentKey }
    }
}
