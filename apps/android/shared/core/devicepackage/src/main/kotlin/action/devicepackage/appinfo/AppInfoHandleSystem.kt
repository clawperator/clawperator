package action.devicepackage.appinfo

import action.system.model.ComponentKey
import android.content.pm.ResolveInfo

class AppInfoHandleSystem(
    resolveInfo: ResolveInfo,
    label: String,
) : AppInfoHandle(
        ComponentKey(
            resolveInfo.activityInfo.packageName,
            resolveInfo.activityInfo.name,
        ),
        label,
        resolveInfo,
    )
