package action.preferences

import action.log.Log
import android.content.SharedPreferences
import androidx.core.content.edit

abstract class SharedPreferencesUpgrader {
    abstract val version: Int

    open val useLogging: Boolean
        get() = false

    fun update(sharedPreferences: SharedPreferences): Boolean {
        val currentVersion = sharedPreferences.getInt(VERSION_KEY, -1)
        if (currentVersion == version) {
            if (useLogging) {
                Log.d("Shared Prefs using current version: $version, no upgrading necessary...")
            }
            return false
        }

        return updateInternal(sharedPreferences, currentVersion).also {
            if (it) {
                sharedPreferences.edit(commit = true) {
                    putInt(VERSION_KEY, version)
                }
                if (useLogging) {
                    Log.d("Updated Shared Prefs version: $currentVersion -> $version")
                }
            }
        }
    }

    abstract fun updateInternal(
        sharedPreferences: SharedPreferences,
        currentVersion: Int,
    ): Boolean

    companion object {
        val VERSION_KEY = "___version"
    }
}

class SharedPreferencesUpgraderNoOp : SharedPreferencesUpgrader() {
    override val version: Int
        get() = -1

    override fun updateInternal(
        sharedPreferences: SharedPreferences,
        currentVersion: Int,
    ): Boolean = false
}
