package action.devicepackage.model

import action.system.model.ComponentKey

data class ActivityData(
    val componentKey: ComponentKey,
    val label: String,
    val obj: Any? = null,
) {
    override fun toString(): String = "label: $label, componentKey: ${componentKey.applicationId}/${componentKey.className}"
}
