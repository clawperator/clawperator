package action.buildconfig

class BuildConfigMock : BuildConfig {
    var _debug = true
    override val debug: Boolean
        get() = _debug

    var _appVersionCode = 0L
    override val appVersionCode: Long
        get() = _appVersionCode

    var _appVersionName = "1.0"
    override val appVersionName: String
        get() = _appVersionName

    var _packageName = ""
    override val packageName: String
        get() = _packageName

    var _appName = ""
    override val appName: String
        get() = _appName
}
