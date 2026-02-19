package action.devicepackage

import action.devicepackage.ComponentEnabledState.ComponentEnabledStateUnknown
import action.devicepackage.ComponentEnabledState.values
import android.content.pm.PackageManager.COMPONENT_ENABLED_STATE_DEFAULT
import android.content.pm.PackageManager.COMPONENT_ENABLED_STATE_DISABLED
import android.content.pm.PackageManager.COMPONENT_ENABLED_STATE_DISABLED_UNTIL_USED
import android.content.pm.PackageManager.COMPONENT_ENABLED_STATE_DISABLED_USER
import android.content.pm.PackageManager.COMPONENT_ENABLED_STATE_ENABLED

enum class ComponentEnabledState(
    val systemState: Int,
) {
    ComponentEnabledStateUnknown(-1),
    ComponentEnabledStateDefault(COMPONENT_ENABLED_STATE_DEFAULT),
    ComponentEnabledStateEnabled(COMPONENT_ENABLED_STATE_ENABLED),
    ComponentEnabledStateDisabled(COMPONENT_ENABLED_STATE_DISABLED),
    ComponentEnabledStateDisabledUser(COMPONENT_ENABLED_STATE_DISABLED_USER),
    ComponentEnabledStateDisabledUntilUsed(COMPONENT_ENABLED_STATE_DISABLED_UNTIL_USED),
}

fun getComponentKeyEnabledState(systemState: Int): ComponentEnabledState = values().find { it.systemState == systemState } ?: ComponentEnabledStateUnknown
