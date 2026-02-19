package action.devicepackage.model

data class AppInfoFilter(
    val includeDebugApps: Boolean,
    val includeUninstalledApps: Boolean,
    val includeLaunchers: Boolean,
    val filterApps: Set<String> = emptySet(),
) {
    val isEmpty = includeDebugApps && includeUninstalledApps && includeLaunchers && filterApps.isEmpty()

    companion object {
        fun empty(): AppInfoFilter = AppInfoFilter(true, true, true, emptySet())
    }
}
