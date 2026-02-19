@file:Suppress("UNUSED_EXPRESSION")

package action.string

import action.time.TimeExtensions.Companion.DATE_FORMAT_PATTERN
import java.text.DateFormat
import java.text.SimpleDateFormat
import java.util.Locale

open class StringRepositoryPreset(
    var useMilitaryTime: Boolean = false,
) : StringRepository() {
    private var _dateFormat = SimpleDateFormat(DATE_FORMAT_PATTERN, Locale.US)
    override val dateFormat: DateFormat
        get() = _dateFormat

    override val useMilitaryTimeFormat: Boolean
        get() = useMilitaryTime

    override fun getString(stringRes: Int): String =
        when (stringRes) {
            else -> "<not_handled_in_preset"
        }

    override fun getString(
        stringRes: Int,
        vararg formatArgs: Any,
    ): String {
        val raw = getString(stringRes)
        return String.format(Locale.getDefault(), raw, *formatArgs)
    }

    override fun getText(stringRes: Int): CharSequence =
        when (stringRes) {
            else -> "<not_handled_in_getText()_preset"
        }

    override fun getStringArray(arrayRes: Int): List<String> =
        when (arrayRes) {
            else -> listOf("not_", "handled_")
        }
}
