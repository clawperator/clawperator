package action.buildconfig

/**
 *
 */
interface BuildConfig {
    val debug: Boolean

    val appVersionCode: Long

    val appVersionName: String

    val packageName: String

    val appName: String
}
