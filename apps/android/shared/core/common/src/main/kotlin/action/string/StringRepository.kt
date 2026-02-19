package action.string

import android.text.SpannableString
import android.text.Spanned
import androidx.annotation.ArrayRes
import androidx.annotation.StringRes
import androidx.core.text.HtmlCompat
import java.text.DateFormat
import java.util.Random

abstract class StringRepository {
    private val random = Random()
    abstract val dateFormat: DateFormat
    abstract val useMilitaryTimeFormat: Boolean

    abstract fun getString(
        @StringRes stringRes: Int,
    ): String

    abstract fun getString(
        @StringRes stringRes: Int,
        vararg formatArgs: Any,
    ): String

    abstract fun getText(
        @StringRes stringRes: Int,
    ): CharSequence

    abstract fun getStringArray(
        @ArrayRes arrayRes: Int,
    ): List<String>

    fun getHtmlSpanned(
        @StringRes stringRes: Int,
    ): Spanned = getHtmlSpanned(getText(stringRes))

    fun getHtmlSpanned(string: CharSequence): Spanned =
        HtmlCompat.fromHtml(string.toString(), HtmlCompat.FROM_HTML_MODE_LEGACY)

    /**
     * Converts HTML to a [SpannableString]. Helpful
     */
    fun getHtmlSpannableString(
        @StringRes stringRes: Int,
    ): SpannableString = getHtmlSpannableString(getString(stringRes))

    fun getHtmlSpannableString(string: String): SpannableString = string.asHtmlSpannableString()

    fun getDuration(duration: Long) = duration.asDurationString()

    fun getBracketedString(string: String) = "($string)"

    fun getBracketedString(
        @StringRes stringRes: Int,
    ) = getBracketedString(getString(stringRes))
}

fun String.fromHtml(): CharSequence = HtmlCompat.fromHtml(this, HtmlCompat.FROM_HTML_MODE_LEGACY)
