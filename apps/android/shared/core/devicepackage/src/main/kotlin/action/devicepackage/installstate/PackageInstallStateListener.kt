package action.devicepackage.installstate

fun interface PackageInstallStateListener {
    fun onStateChange(
        applicationId: String,
        packageInstallState: PackageInstallState,
    )
}
