package action.devicepackage.installstate

import action.log.Log
import action.utils.registerReceiverEx
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter

class PackageInstallStateReceiverSystem(
    private val context: Context,
) : PackageInstallStateReceiver() {
    private val receiverIntentFilter: IntentFilter by lazy {
        IntentFilter().apply {
            addDataScheme("package")
            addAction(Intent.ACTION_PACKAGE_ADDED)
            addAction(Intent.ACTION_PACKAGE_REMOVED)
            addAction(Intent.ACTION_PACKAGE_CHANGED)
        }
    }

    private var receiverRegistered = false
    private val receiver =
        object : BroadcastReceiver() {
            override fun onReceive(
                context: Context?,
                intent: Intent?,
            ) {
                val applicationId = intent?.data?.schemeSpecificPart

                Log.d("onReceive(): ${intent?.action}, applicationId: $applicationId")
                intent?.action?.also { action ->
                    getPackageInstallStateFromAction(action)?.also { packageInstallState ->
                        if (applicationId != null) {
                            sendToListeners(applicationId, packageInstallState)
                        }
                    }
                }
            }
        }

    override fun register() {
        if (!receiverRegistered) {
            context.registerReceiverEx(receiver, receiverIntentFilter)
            receiverRegistered = true
        }
    }

    override fun unregister() {
        if (receiverRegistered) {
            context.unregisterReceiver(receiver)
            receiverRegistered = false
        }
    }
}
