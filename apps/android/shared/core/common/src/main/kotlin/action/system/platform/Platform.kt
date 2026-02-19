package action.system.platform

interface Platform {
    val name: String
}

class PlatformAndroid : Platform {
    override val name: String = "Android ${android.os.Build.VERSION.SDK_INT}"
}

fun getPlatform(): Platform = PlatformAndroid()
