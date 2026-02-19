package action.language

/**
 * Get details about the current device [java.util.Locale].
 */
interface LocaleRepository {
    val localeLanguageIso: Iso?

    val localeCountry: String?

    val systemLocaleLanguageIsos: List<Iso>?
}

class LocaleRepositoryMock(
    override var localeLanguageIso: Iso? = "en",
    override val localeCountry: String? = "US",
    override val systemLocaleLanguageIsos: List<Iso>? = listOf("en"),
) : LocaleRepository
