package action.devicepackage.installstate

abstract class PackageInstallStateReceiver {
    abstract fun register()

    abstract fun unregister()

    internal fun sendToListeners(
        applicationId: String,
        packageInstallState: PackageInstallState,
    ) {
        listeners.forEach { listener ->
            listener.onStateChange(applicationId, packageInstallState)
        }
    }

    internal val listeners: MutableList<PackageInstallStateListener> = mutableListOf()

    fun addListener(
        listener: PackageInstallStateListener,
    ) {
        if (!listeners.contains(listener)) {
            listeners.add(listener)
        }
    }

    fun removeListener(
        listener: PackageInstallStateListener,
    ) {
        if (listeners.contains(listener)) {
            listeners.remove(listener)
        }
    }
}
