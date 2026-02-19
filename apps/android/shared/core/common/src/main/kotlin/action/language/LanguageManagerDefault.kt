package action.language

import android.annotation.TargetApi
import android.content.Context
import android.content.SharedPreferences
import android.os.Build
import java.util.Locale

class LanguageManagerDefault(
    private val sharedPreferences: SharedPreferences,
) : LanguageManager {
    override fun updateLocale(context: Context): Context {
        val languagePreference =
            sharedPreferences
                .getString(PREFERENCE_KEY_LANGUAGE_OVERRIDE, PREFERENCE_LANGUAGE_OVERRIDE_DEFAULT)!!
        if (languagePreference == PREFERENCE_LANGUAGE_OVERRIDE_DEFAULT) return context

        val (language, country) = languagePreference.getLanguageAndCountry()
        val locale = Locale(language, country)
        Locale.setDefault(locale)

        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            updateResourcesLocale(context, locale)
        } else {
            updateResourcesLocaleLegacy(context, locale)
        }
    }

    @TargetApi(Build.VERSION_CODES.N)
    private fun updateResourcesLocale(
        context: Context,
        locale: Locale,
    ): Context =
        context.resources.configuration.run {
            setLocale(locale)
            setLayoutDirection(locale)
            context.createConfigurationContext(this)
        }

    @Suppress("DEPRECATION")
    private fun updateResourcesLocaleLegacy(
        context: Context,
        locale: Locale,
    ): Context {
        val resources = context.resources
        return resources.configuration.run {
            this.locale = locale
            setLayoutDirection(locale)
            resources.updateConfiguration(this, resources.displayMetrics)
            context
        }
    }

    companion object {
        const val PREFERENCE_KEY_LANGUAGE_OVERRIDE = "pref_language_override"
        const val PREFERENCE_LANGUAGE_OVERRIDE_DEFAULT = "default"
    }
}
