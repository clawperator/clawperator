package action.devicepackage

interface PackageRepositoryConfig {
    val iconDensity: Int
}

data class PackageRepositoryConfigDefault(
    override val iconDensity: Int = 640,
) : PackageRepositoryConfig
