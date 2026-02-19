package action.system.accessibility

enum class SystemAccessibilityActionType(
    val key: String,
) {
    OpenNotificationPanel("OpenNotificationPanel"),
    OpenQuickSettingsPanel("OpenQuickSettingsPanel"),
    OpenRecentApps("OpenRecentApps"),
    LockScreen("LockScreen"),
    ;

    companion object {
        fun fromString(key: String): SystemAccessibilityActionType? = entries.find { it.key == key }
    }
}
