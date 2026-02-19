package action.devicepackage.defaultapps

import action.devicepackage.appinfo.AppInfoHandle
import action.devicepackage.appinfo.AppInfoHandleSystem
import android.content.Intent
import android.content.pm.PackageManager
import android.content.pm.PackageManager.MATCH_DEFAULT_ONLY
import androidx.core.net.toUri

class DefaultAppRepositorySystem(
    private val packageManager: PackageManager,
) : DefaultAppRepository {
    private val browserIntent =
        Intent(
            "android.intent.action.VIEW",
            "https://example.com".toUri(),
        )

    override val defaultBrowser: AppInfoHandle?
        get() {
            return packageManager.resolveActivity(browserIntent, MATCH_DEFAULT_ONLY)?.let {
                AppInfoHandleSystem(it, it.loadLabel(packageManager).toString())
            }
        }
}
