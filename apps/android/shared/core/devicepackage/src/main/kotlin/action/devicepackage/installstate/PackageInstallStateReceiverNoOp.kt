package action.devicepackage.installstate

class PackageInstallStateReceiverNoOp : PackageInstallStateReceiver() {
    override fun register() { }

    override fun unregister() { }
}
