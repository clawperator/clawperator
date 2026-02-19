package action.language

import action.resources.resolveLocale
import android.content.Context
import android.content.res.Resources
import android.text.TextUtils
import androidx.core.os.ConfigurationCompat

class LocaleRepositorySystem(
    context: Context,
) : LocaleRepository {
    private val resources: Resources by lazy { context.resources }

    override val localeLanguageIso: Iso?
        get() {
            val lang = resources.resolveLocale().language
            return if (TextUtils.isEmpty(lang)) null else lang
        }

    override val localeCountry: String?
        get() {
            val country = resources.resolveLocale().country
            return if (TextUtils.isEmpty(country)) null else country
        }

    override val systemLocaleLanguageIsos: List<Iso>?
        get() {
            val languages = mutableListOf<Iso>()
            val localeListCompat =
                ConfigurationCompat.getLocales(Resources.getSystem().configuration)
            for (i in 0 until localeListCompat.size()) {
                localeListCompat[i]?.language?.also {
                    languages.add(it)
                }
            }
            return if (languages.isEmpty()) null else languages
        }
}
