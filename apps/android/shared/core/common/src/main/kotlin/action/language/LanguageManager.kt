package action.language

import android.content.Context

interface LanguageManager {
    /**
     * Sets the given language to the application context and returns the updated context.
     */
    fun updateLocale(context: Context): Context
}
