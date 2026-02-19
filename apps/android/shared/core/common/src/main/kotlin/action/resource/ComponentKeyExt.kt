package action.resource

import action.system.model.ComponentKey
import android.appwidget.AppWidgetProviderInfo
import android.content.ComponentName

fun ComponentKey(providerInfo: AppWidgetProviderInfo): ComponentKey =
    ComponentKey(
        componentName = providerInfo.provider,
    )

fun ComponentKey(componentName: ComponentName): ComponentKey =
    ComponentKey(
        applicationId = componentName.packageName,
        className = componentName.className,
    )
