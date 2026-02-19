package action.notification

import action.system.model.ApplicationId
import android.content.Context
import android.content.SharedPreferences

/**
 * Android implementation of NotificationListenerConfig using SharedPreferences.
 */
class NotificationListenerConfigAndroid(
    private val context: Context,
) : NotificationListenerConfig {
    private val prefs: SharedPreferences by lazy {
        context.getSharedPreferences("notification_prefs", Context.MODE_PRIVATE)
    }

    // Simple callback interface for configuration changes
    interface ConfigChangeListener {
        fun onConfigChanged(key: String)
    }

    private var configChangeListener: ConfigChangeListener? = null

    private val prefsListener =
        SharedPreferences.OnSharedPreferenceChangeListener { _, key ->
            if (key == "disabled_pkgs" || key == "tracking_enabled") {
                configChangeListener?.onConfigChanged(key ?: "")
            }
        }

    init {
        prefs.registerOnSharedPreferenceChangeListener(prefsListener)
    }

    /**
     * Set a listener for configuration changes.
     *
     * **IMPORTANT**: The host application MUST call this method to wire up config change
     * notifications to AppNotificationsManager:
     *
     * ```
     * config.setConfigChangeListener(object : NotificationListenerConfigAndroid.ConfigChangeListener {
     *     override fun onConfigChanged(key: String) {
     *         appManager.handleConfigChange(key)
     *     }
     * })
     * ```
     */
    fun setConfigChangeListener(listener: ConfigChangeListener?) {
        configChangeListener = listener
    }

    override val isTrackingEnabled: Boolean
        get() = prefs.getBoolean("tracking_enabled", true)

    override fun areNotificationsDisabledFor(applicationId: String): Boolean {
        val disabledPkgs = prefs.getStringSet("disabled_pkgs", emptySet()) ?: emptySet()
        return disabledPkgs.contains(applicationId)
    }

    override fun canShowNotificationForIntent(
        action: String?,
        categories: Set<String>?,
    ): Boolean {
        // If both action and categories are null (which happens with PendingIntent), default to allow
        // This is the common case since PendingIntent doesn't expose underlying Intent details
        if (action == null && categories == null) {
            return true
        }

        // Check if this is a main action intent
        val isActionAllowed = action != null && action == "android.intent.action.MAIN"
        if (isActionAllowed) {
            // Check if that's not a deep shortcut
            return categories == null || !categories.contains("android.shortcut.conversation")
        }

        // Note: This will filter out any notification with a non-null action that is not exactly
        // "android.intent.action.MAIN". If you need to support other valid actions, broaden this check.
        return false
    }

    /**
     * Set whether notification tracking is enabled.
     */
    fun setTrackingEnabled(enabled: Boolean) {
        prefs
            .edit()
            .putBoolean("tracking_enabled", enabled)
            .apply()
    }

    /**
     * Set whether notifications are disabled for a specific package.
     */
    fun setNotificationsDisabledFor(
        applicationId: ApplicationId,
        disabled: Boolean,
    ) {
        val disabledPkgs = prefs.getStringSet("disabled_pkgs", emptySet())?.toMutableSet() ?: mutableSetOf()
        if (disabled) {
            disabledPkgs.add(applicationId)
        } else {
            disabledPkgs.remove(applicationId)
        }
        prefs
            .edit()
            .putStringSet("disabled_pkgs", disabledPkgs)
            .apply()
    }

    /**
     * Clean up resources.
     */
    override fun destroy() {
        prefs.unregisterOnSharedPreferenceChangeListener(prefsListener)
        configChangeListener = null
    }
}
