package action.language

/**
 * https://en.wikipedia.org/wiki/List_of_ISO_3166_country_codes#UNI2
 */
typealias Iso = String

fun Iso.isEnglishLanguage(): Boolean = ENGLISH_SPEAKING_ISOS.contains(lowercase())

private val ENGLISH_SPEAKING_ISOS: List<Iso> =
    listOf(
        "as" /** American Samoa */,
        "au" /** Australia */,
        "ai" /** Anguilla */,
        "bm" /** Bermuda */,
        "cc" /** Cocos (Keeling) Islands (the) */,
        "cx" /** Christmas Island */,
        "ck" /** Cook Islands (the) */,
        "fk" /** Falkland Islands (the) **/,
        "gb" /** Great Britain / United Kingdom */,
        "gi" /** Gibraltar */,
        "gg" /** Guernsey */,
        "gu" /** Guam */,
        "je" /** Jersey */,
        "im" /** Isle of Man */,
        "io" /** British Indian Ocean Territory (the) */,
        "ky" /** Cayman Islands (the) */,
        "hm" /** Heard Island and McDonald Islands */,
        "ms" /** Montserrat */,
        "nf" /** Norfolk Island */,
        "nz" /** New Zealand */,
        "pn" /** Pitcairn **/,
        "pr" /** Puerto Rico */,
        "sh" /** Saint Helena **/,
        "sg" /** Singapore **/,
        "sb" /** Solomon Islands */,
        "tc" /** Turks and Caicos Islands (the) */,
        "um" /** United States Minor Outlying Islands (the) */,
        "us" /** USA **/,
        "vg", /** The Virgin Islands */
    )

fun String.getLanguageAndCountry(): Pair<String, String> =
    when (this) {
        "english_us" -> Pair("en", "US")
        "espanol_spain" -> Pair("es", "ES")
        "german_germany" -> Pair("de", "DE")
        else -> throw UnsupportedOperationException("Unknown language preset")
    }

const val ENGLISH_LANGUAGE_ISO = "en"
